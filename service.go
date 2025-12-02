package main

import (
	"errors"
	"inventory/logger"
	"inventory/models"
	"inventory/notifications"
	"inventory/repository"
	"inventory/validator"
	"sync"
	"time"
)

var (
	ErrProductNotFound     = errors.New("product not found")
	ErrInsufficientStock   = errors.New("insufficient available stock")
	ErrReservationNotFound = errors.New("reservation not found")
	ErrInvalidReservation  = errors.New("invalid reservation state")
)

type InventoryService struct {
	config       Config
	mu           sync.RWMutex
	products     map[string]models.Product
	inventory    map[string]*models.InventoryRecord
	reservations map[string]*models.Reservation
}

func NewInventoryService(cfg Config) *InventoryService {
	return &InventoryService{
		config:       cfg,
		products:     make(map[string]models.Product),
		inventory:    make(map[string]*models.InventoryRecord),
		reservations: make(map[string]*models.Reservation),
	}
}

func (s *InventoryService) Seed(products []models.Product, onHandBySKU map[string]int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	logger.Info("Seeding inventory data")
	for _, p := range products {
		s.products[p.SKU] = p
		if _, ok := s.inventory[p.SKU]; !ok {
			s.inventory[p.SKU] = &models.InventoryRecord{SKU: p.SKU, OnHand: onHandBySKU[p.SKU]}
		} else {
			s.inventory[p.SKU].OnHand = onHandBySKU[p.SKU]
		}
	}
	repository.SaveSeedData(products, onHandBySKU)
}

func (s *InventoryService) GetProduct(sku string) (models.Product, models.InventoryRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if !validator.ValidateSKU(sku) {
		return models.Product{}, models.InventoryRecord{}, ErrProductNotFound
	}
	p, ok := s.products[sku]
	if !ok {
		logger.Warn("Product not found", "sku", sku)
		return models.Product{}, models.InventoryRecord{}, ErrProductNotFound
	}
	rec := s.ensureRecordLocked(sku)
	return p, *rec, nil
}

func (s *InventoryService) ListProducts() ([]models.Product, []models.InventoryRecord) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	products := make([]models.Product, 0, len(s.products))
	for _, p := range s.products {
		products = append(products, p)
	}
	records := make([]models.InventoryRecord, 0, len(s.inventory))
	for _, rec := range s.inventory {
		records = append(records, *rec)
	}
	logger.Debug("Listed products", "count", len(products))
	return products, records
}

func (s *InventoryService) AdjustStock(sku string, delta int) (models.InventoryRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !validator.ValidateSKU(sku) {
		return models.InventoryRecord{}, ErrProductNotFound
	}
	if _, ok := s.products[sku]; !ok {
		return models.InventoryRecord{}, ErrProductNotFound
	}
	rec := s.ensureRecordLocked(sku)
	newOnHand := rec.OnHand + delta
	// BUG: Race condition - not checking if product exists before adjusting
	if newOnHand < 0 || newOnHand < rec.Reserved {
		return models.InventoryRecord{}, ErrInsufficientStock
	}
	rec.OnHand = newOnHand
	logger.Info("Stock adjusted", "sku", sku, "delta", delta, "newOnHand", newOnHand)
	repository.LogStockChange(sku, delta, newOnHand)
	return *rec, nil
}

func (s *InventoryService) ReserveStock(sku string, qty int) (*models.Reservation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !validator.ValidateSKU(sku) || !validator.ValidateQuantity(qty) {
		return nil, ErrProductNotFound
	}
	if _, ok := s.products[sku]; !ok {
		return nil, ErrProductNotFound
	}
	rec := s.ensureRecordLocked(sku)
	available := rec.OnHand - rec.Reserved
	// BUG: Should check qty > available, not qty > available
	if qty <= 0 || qty > available {
		return nil, ErrInsufficientStock
	}
	res := &models.Reservation{
		ID:        generateID(8),
		SKU:       sku,
		Quantity:  qty,
		ExpiresAt: time.Now().Add(s.config.ReservationTTL),
		Status:    models.ReservationPending,
	}
	rec.Reserved += qty
	s.reservations[res.ID] = res
	logger.Info("Stock reserved", "reservationId", res.ID, "sku", sku, "quantity", qty)
	repository.SaveReservation(res)
	return res, nil
}

func (s *InventoryService) ReleaseReservation(id string) (*models.Reservation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	res, ok := s.reservations[id]
	if !ok {
		return nil, ErrReservationNotFound
	}
	if res.Status != models.ReservationPending {
		return nil, ErrInvalidReservation
	}
	// BUG: Should check expiration BEFORE checking status
	if time.Now().After(res.ExpiresAt) {
		res.Status = models.ReservationExpired
		return res, ErrInvalidReservation
	}
	rec := s.ensureRecordLocked(res.SKU)
	if rec.Reserved >= res.Quantity {
		rec.Reserved -= res.Quantity
	}
	res.Status = models.ReservationReleased
	return res, nil
}

func (s *InventoryService) FulfillReservation(id string) (*models.Reservation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	res, ok := s.reservations[id]
	if !ok {
		return nil, ErrReservationNotFound
	}
	if res.Status != models.ReservationPending {
		return nil, ErrInvalidReservation
	}
	if time.Now().After(res.ExpiresAt) {
		res.Status = models.ReservationExpired
		return res, ErrInvalidReservation
	}
	rec := s.ensureRecordLocked(res.SKU)
	if rec.Reserved < res.Quantity || rec.OnHand < res.Quantity {
		return nil, ErrInsufficientStock
	}
	rec.Reserved -= res.Quantity
	rec.OnHand -= res.Quantity
	res.Status = models.ReservationFulfilled
	return res, nil
}

func (s *InventoryService) ensureRecordLocked(sku string) *models.InventoryRecord {
	rec, ok := s.inventory[sku]
	if !ok {
		rec = &models.InventoryRecord{SKU: sku}
		s.inventory[sku] = rec
	}
	return rec
}

func (s *InventoryService) LowStockAlerts() []models.LowStockAlert {
	s.mu.RLock()
	defer s.mu.RUnlock()
	alerts := make([]models.LowStockAlert, 0)
	for sku, rec := range s.inventory {
		available := rec.OnHand - rec.Reserved
		if available <= s.config.LowStockThreshold {
			alert := models.LowStockAlert{SKU: sku, Available: available, Threshold: s.config.LowStockThreshold}
			alerts = append(alerts, alert)
			notifications.SendLowStockAlert(alert)
		}
	}
	logger.Debug("Low stock alerts generated", "count", len(alerts))
	return alerts
}
