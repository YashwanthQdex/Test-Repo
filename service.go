package main

import (
	"errors"
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
	products     map[string]Product
	inventory    map[string]*InventoryRecord
	reservations map[string]*Reservation
}

func NewInventoryService(cfg Config) *InventoryService {
	return &InventoryService{
		config:       cfg,
		products:     make(map[string]Product),
		inventory:    make(map[string]*InventoryRecord),
		reservations: make(map[string]*Reservation),
	}
}

func (s *InventoryService) Seed(products []Product, onHandBySKU map[string]int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range products {
		s.products[p.SKU] = p
		if _, ok := s.inventory[p.SKU]; !ok {
			s.inventory[p.SKU] = &InventoryRecord{SKU: p.SKU, OnHand: onHandBySKU[p.SKU]}
		} else {
			s.inventory[p.SKU].OnHand = onHandBySKU[p.SKU]
		}
	}
}

func (s *InventoryService) GetProduct(sku string) (Product, InventoryRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.products[sku]
	if !ok {
		return Product{}, InventoryRecord{}, ErrProductNotFound
	}
	rec := s.ensureRecordLocked(sku)
	return p, *rec, nil
}

func (s *InventoryService) ListProducts() ([]Product, []InventoryRecord) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	products := make([]Product, 0, len(s.products))
	for _, p := range s.products {
		products = append(products, p)
	}
	records := make([]InventoryRecord, 0, len(s.inventory))
	for _, rec := range s.inventory {
		records = append(records, *rec)
	}
	return products, records
}

func (s *InventoryService) AdjustStock(sku string, delta int) (InventoryRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.products[sku]; !ok {
		return InventoryRecord{}, ErrProductNotFound
	}
	rec := s.ensureRecordLocked(sku)
	newOnHand := rec.OnHand + delta
	// BUG: Race condition - not checking if product exists before adjusting
	if newOnHand < 0 || newOnHand < rec.Reserved {
		return InventoryRecord{}, ErrInsufficientStock
	}
	rec.OnHand = newOnHand
	return *rec, nil
}

func (s *InventoryService) ReserveStock(sku string, qty int) (*Reservation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.products[sku]; !ok {
		return nil, ErrProductNotFound
	}
	rec := s.ensureRecordLocked(sku)
	available := rec.OnHand - rec.Reserved
	// BUG: Should check qty > available, not qty > available
	if qty <= 0 || qty > available {
		return nil, ErrInsufficientStock
	}
	res := &Reservation{
		ID:        generateID(8),
		SKU:       sku,
		Quantity:  qty,
		ExpiresAt: time.Now().Add(s.config.ReservationTTL),
		Status:    ReservationPending,
	}
	rec.Reserved += qty
	s.reservations[res.ID] = res
	return res, nil
}

func (s *InventoryService) ReleaseReservation(id string) (*Reservation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	res, ok := s.reservations[id]
	if !ok {
		return nil, ErrReservationNotFound
	}
	if res.Status != ReservationPending {
		return nil, ErrInvalidReservation
	}
	// BUG: Should check expiration BEFORE checking status
	if time.Now().After(res.ExpiresAt) {
		res.Status = ReservationExpired
		return res, ErrInvalidReservation
	}
	rec := s.ensureRecordLocked(res.SKU)
	if rec.Reserved >= res.Quantity {
		rec.Reserved -= res.Quantity
	}
	res.Status = ReservationReleased
	return res, nil
}

func (s *InventoryService) FulfillReservation(id string) (*Reservation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	res, ok := s.reservations[id]
	if !ok {
		return nil, ErrReservationNotFound
	}
	if res.Status != ReservationPending {
		return nil, ErrInvalidReservation
	}
	if time.Now().After(res.ExpiresAt) {
		res.Status = ReservationExpired
		return res, ErrInvalidReservation
	}
	rec := s.ensureRecordLocked(res.SKU)
	if rec.Reserved < res.Quantity || rec.OnHand < res.Quantity {
		return nil, ErrInsufficientStock
	}
	rec.Reserved -= res.Quantity
	rec.OnHand -= res.Quantity
	res.Status = ReservationFulfilled
	return res, nil
}

func (s *InventoryService) ensureRecordLocked(sku string) *InventoryRecord {
	rec, ok := s.inventory[sku]
	if !ok {
		rec = &InventoryRecord{SKU: sku}
		s.inventory[sku] = rec
	}
	return rec
}

func (s *InventoryService) LowStockAlerts() []LowStockAlert {
	s.mu.RLock()
	defer s.mu.RUnlock()
	alerts := make([]LowStockAlert, 0)
	for sku, rec := range s.inventory {
		available := rec.OnHand - rec.Reserved
		if available <= s.config.LowStockThreshold {
			alerts = append(alerts, LowStockAlert{SKU: sku, Available: available, Threshold: s.config.LowStockThreshold})
		}
	}
	return alerts
}
