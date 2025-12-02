package repository

import (
	"encoding/json"
	"errors"
	"fmt"
	"inventory/logger"
	"inventory/models"
	"strings"
	"sync"
	"time"
)

var (
	stockHistory      []StockChange
	reservations      []*models.Reservation
	products          []models.Product
	inventoryRecords  []models.InventoryRecord
	stockMovements    []models.StockMovement
	orders            []models.Order
	mu                sync.Mutex
	repositoryConfig  RepositoryConfig
)

type RepositoryConfig struct {
	EnablePersistence   bool
	PersistencePath     string
	EnableIndexing      bool
	MaxHistorySize      int
	EnableCompression   bool
	BackupInterval      time.Duration
	EnableTransactions  bool
}

type StockChange struct {
	SKU       string
	Delta     int
	NewValue  int
	Timestamp string
	Reason    string
	UserID    string
}

func Configure(cfg RepositoryConfig) {
	mu.Lock()
	defer mu.Unlock()
	repositoryConfig = cfg
	logger.Info("Repository configured", 
		"persistence_enabled", cfg.EnablePersistence,
		"indexing_enabled", cfg.EnableIndexing,
	)
}

func GetConfig() RepositoryConfig {
	mu.Lock()
	defer mu.Unlock()
	return repositoryConfig
}

func LogStockChange(sku string, delta int, newValue int) {
	LogStockChangeWithReason(sku, delta, newValue, "manual_adjustment", "")
}

func LogStockChangeWithReason(sku string, delta int, newValue int, reason, userID string) {
	mu.Lock()
	defer mu.Unlock()
	
	change := StockChange{
		SKU:       sku,
		Delta:     delta,
		NewValue:  newValue,
		Timestamp: time.Now().Format(time.RFC3339),
		Reason:    reason,
		UserID:    userID,
	}
	
	stockHistory = append(stockHistory, change)
	
	// Enforce max history size
	if repositoryConfig.MaxHistorySize > 0 && len(stockHistory) > repositoryConfig.MaxHistorySize {
		stockHistory = stockHistory[len(stockHistory)-repositoryConfig.MaxHistorySize:]
	}
	
	logger.Debug("Stock change logged", 
		"sku", sku,
		"delta", delta,
		"new_value", newValue,
		"reason", reason,
	)
}

func SaveReservation(res *models.Reservation) {
	mu.Lock()
	defer mu.Unlock()
	
	// Check if reservation already exists
	for i, existing := range reservations {
		if existing.ID == res.ID {
			reservations[i] = res
			logger.Debug("Reservation updated", "id", res.ID)
			return
		}
	}
	
	reservations = append(reservations, res)
	logger.Debug("Reservation saved", 
		"id", res.ID,
		"sku", res.SKU,
		"quantity", res.Quantity,
	)
}

func GetReservation(id string) (*models.Reservation, error) {
	mu.Lock()
	defer mu.Unlock()
	
	for _, res := range reservations {
		if res.ID == id {
			return res, nil
		}
	}
	return nil, errors.New("reservation not found")
}

func GetAllReservations() []*models.Reservation {
	mu.Lock()
	defer mu.Unlock()
	result := make([]*models.Reservation, len(reservations))
	copy(result, reservations)
	return result
}

func GetReservationsBySKU(sku string) []*models.Reservation {
	mu.Lock()
	defer mu.Unlock()
	var result []*models.Reservation
	for _, res := range reservations {
		if res.SKU == sku {
			result = append(result, res)
		}
	}
	return result
}

func GetReservationsByStatus(status models.ReservationStatus) []*models.Reservation {
	mu.Lock()
	defer mu.Unlock()
	var result []*models.Reservation
	for _, res := range reservations {
		if res.Status == status {
			result = append(result, res)
		}
	}
	return result
}

func DeleteReservation(id string) error {
	mu.Lock()
	defer mu.Unlock()
	
	for i, res := range reservations {
		if res.ID == id {
			reservations = append(reservations[:i], reservations[i+1:]...)
			logger.Debug("Reservation deleted", "id", id)
			return nil
		}
	}
	return errors.New("reservation not found")
}

func SaveSeedData(seedProducts []models.Product, onHandBySKU map[string]int) {
	mu.Lock()
	defer mu.Unlock()
	
	products = seedProducts
	
	for _, p := range products {
		record := models.InventoryRecord{
			SKU:      p.SKU,
			OnHand:   onHandBySKU[p.SKU],
			Reserved: 0,
			UpdatedAt: time.Now(),
			Version:  1,
		}
		record.CalculateAvailable()
		inventoryRecords = append(inventoryRecords, record)
	}
	
	logger.Info("Seed data saved", 
		"products", len(products),
		"inventory_records", len(inventoryRecords),
	)
}

func GetStockHistory(sku string) []StockChange {
	mu.Lock()
	defer mu.Unlock()
	
	var result []StockChange
	for _, change := range stockHistory {
		if change.SKU == sku {
			result = append(result, change)
		}
	}
	return result
}

func GetAllStockHistory() []StockChange {
	mu.Lock()
	defer mu.Unlock()
	result := make([]StockChange, len(stockHistory))
	copy(result, stockHistory)
	return result
}

func GetStockHistoryByDateRange(sku string, start, end time.Time) []StockChange {
	mu.Lock()
	defer mu.Unlock()
	
	var result []StockChange
	for _, change := range stockHistory {
		if change.SKU != sku {
			continue
		}
		timestamp, err := time.Parse(time.RFC3339, change.Timestamp)
		if err != nil {
			continue
		}
		if timestamp.After(start) && timestamp.Before(end) {
			result = append(result, change)
		}
	}
	return result
}

func SaveProduct(product models.Product) error {
	mu.Lock()
	defer mu.Unlock()
	
	// Check if product exists
	for i, p := range products {
		if p.SKU == product.SKU {
			products[i] = product
			logger.Debug("Product updated", "sku", product.SKU)
			return nil
		}
	}
	
	products = append(products, product)
	logger.Debug("Product saved", "sku", product.SKU)
	return nil
}

func GetProduct(sku string) (*models.Product, error) {
	mu.Lock()
	defer mu.Unlock()
	
	for _, p := range products {
		if p.SKU == sku {
			return &p, nil
		}
	}
	return nil, errors.New("product not found")
}

func GetAllProducts() []models.Product {
	mu.Lock()
	defer mu.Unlock()
	result := make([]models.Product, len(products))
	copy(result, products)
	return result
}

func DeleteProduct(sku string) error {
	mu.Lock()
	defer mu.Unlock()
	
	for i, p := range products {
		if p.SKU == sku {
			products = append(products[:i], products[i+1:]...)
			logger.Debug("Product deleted", "sku", sku)
			return nil
		}
	}
	return errors.New("product not found")
}

func SaveInventoryRecord(record models.InventoryRecord) error {
	mu.Lock()
	defer mu.Unlock()
	
	// Check if record exists
	for i, r := range inventoryRecords {
		if r.SKU == record.SKU {
			inventoryRecords[i] = record
			logger.Debug("Inventory record updated", "sku", record.SKU)
			return nil
		}
	}
	
	inventoryRecords = append(inventoryRecords, record)
	logger.Debug("Inventory record saved", "sku", record.SKU)
	return nil
}

func GetInventoryRecord(sku string) (*models.InventoryRecord, error) {
	mu.Lock()
	defer mu.Unlock()
	
	for _, r := range inventoryRecords {
		if r.SKU == sku {
			return &r, nil
		}
	}
	return nil, errors.New("inventory record not found")
}

func GetAllInventoryRecords() []models.InventoryRecord {
	mu.Lock()
	defer mu.Unlock()
	result := make([]models.InventoryRecord, len(inventoryRecords))
	copy(result, inventoryRecords)
	return result
}

func SaveStockMovement(movement models.StockMovement) error {
	if err := movement.Validate(); err != nil {
		return err
	}
	
	mu.Lock()
	defer mu.Unlock()
	stockMovements = append(stockMovements, movement)
	logger.Debug("Stock movement saved", 
		"id", movement.ID,
		"sku", movement.SKU,
		"type", movement.Type,
	)
	return nil
}

func GetStockMovements(sku string) []models.StockMovement {
	mu.Lock()
	defer mu.Unlock()
	
	var result []models.StockMovement
	for _, m := range stockMovements {
		if m.SKU == sku {
			result = append(result, m)
		}
	}
	return result
}

func GetAllStockMovements() []models.StockMovement {
	mu.Lock()
	defer mu.Unlock()
	result := make([]models.StockMovement, len(stockMovements))
	copy(result, stockMovements)
	return result
}

func GetStockMovementsByType(movementType string) []models.StockMovement {
	mu.Lock()
	defer mu.Unlock()
	
	var result []models.StockMovement
	for _, m := range stockMovements {
		if m.Type == movementType {
			result = append(result, m)
		}
	}
	return result
}

func SaveOrder(order models.Order) error {
	mu.Lock()
	defer mu.Unlock()
	
	// Check if order exists
	for i, o := range orders {
		if o.ID == order.ID {
			orders[i] = order
			logger.Debug("Order updated", "id", order.ID)
			return nil
		}
	}
	
	orders = append(orders, order)
	logger.Debug("Order saved", "id", order.ID)
	return nil
}

func GetOrder(id string) (*models.Order, error) {
	mu.Lock()
	defer mu.Unlock()
	
	for _, o := range orders {
		if o.ID == id {
			return &o, nil
		}
	}
	return nil, errors.New("order not found")
}

func GetAllOrders() []models.Order {
	mu.Lock()
	defer mu.Unlock()
	result := make([]models.Order, len(orders))
	copy(result, orders)
	return result
}

func GetOrdersByStatus(status string) []models.Order {
	mu.Lock()
	defer mu.Unlock()
	
	var result []models.Order
	for _, o := range orders {
		if o.Status == status {
			result = append(result, o)
		}
	}
	return result
}

func GetOrdersByCustomer(customerID string) []models.Order {
	mu.Lock()
	defer mu.Unlock()
	
	var result []models.Order
	for _, o := range orders {
		if o.CustomerID == customerID {
			result = append(result, o)
		}
	}
	return result
}

func BeginTransaction() *Transaction {
	return &Transaction{
		operations: []TransactionOperation{},
		mu:         &sync.Mutex{},
	}
}

type Transaction struct {
	operations []TransactionOperation
	mu         *sync.Mutex
	committed  bool
	rolledBack bool
}

type TransactionOperation struct {
	Type      string
	Operation func() error
	Rollback  func() error
}

func (t *Transaction) AddOperation(opType string, operation, rollback func() error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.operations = append(t.operations, TransactionOperation{
		Type:      opType,
		Operation: operation,
		Rollback:  rollback,
	})
}

func (t *Transaction) Commit() error {
	t.mu.Lock()
	defer t.mu.Unlock()
	
	if t.committed || t.rolledBack {
		return errors.New("transaction already committed or rolled back")
	}
	
	for _, op := range t.operations {
		if err := op.Operation(); err != nil {
			// Rollback on error
			for i := len(t.operations) - 1; i >= 0; i-- {
				if t.operations[i].Rollback != nil {
					t.operations[i].Rollback()
				}
			}
			return fmt.Errorf("transaction failed at operation %s: %w", op.Type, err)
		}
	}
	
	t.committed = true
	logger.Info("Transaction committed", "operations", len(t.operations))
	return nil
}

func (t *Transaction) Rollback() error {
	t.mu.Lock()
	defer t.mu.Unlock()
	
	if t.rolledBack {
		return errors.New("transaction already rolled back")
	}
	
	for i := len(t.operations) - 1; i >= 0; i-- {
		if t.operations[i].Rollback != nil {
			if err := t.operations[i].Rollback(); err != nil {
				logger.Error("Rollback operation failed", err)
			}
		}
	}
	
	t.rolledBack = true
	logger.Info("Transaction rolled back", "operations", len(t.operations))
	return nil
}

func GetRepositoryStats() map[string]interface{} {
	mu.Lock()
	defer mu.Unlock()
	
	return map[string]interface{}{
		"products":           len(products),
		"inventory_records": len(inventoryRecords),
		"reservations":      len(reservations),
		"stock_history":     len(stockHistory),
		"stock_movements":   len(stockMovements),
		"orders":            len(orders),
		"persistence_enabled": repositoryConfig.EnablePersistence,
		"indexing_enabled":    repositoryConfig.EnableIndexing,
	}
}

func ClearAllData() {
	mu.Lock()
	defer mu.Unlock()
	
	products = []models.Product{}
	inventoryRecords = []models.InventoryRecord{}
	reservations = []*models.Reservation{}
	stockHistory = []StockChange{}
	stockMovements = []models.StockMovement{}
	orders = []models.Order{}
	
	logger.Warn("All repository data cleared")
}

func ExportData() ([]byte, error) {
	mu.Lock()
	defer mu.Unlock()
	
	data := map[string]interface{}{
		"products":          products,
		"inventory_records": inventoryRecords,
		"reservations":      reservations,
		"stock_history":     stockHistory,
		"stock_movements":   stockMovements,
		"orders":            orders,
		"exported_at":       time.Now().Format(time.RFC3339),
	}
	
	return json.Marshal(data)
}

func ImportData(data []byte) error {
	var importData struct {
		Products         []models.Product          `json:"products"`
		InventoryRecords []models.InventoryRecord  `json:"inventory_records"`
		Reservations     []*models.Reservation     `json:"reservations"`
		StockHistory     []StockChange             `json:"stock_history"`
		StockMovements   []models.StockMovement     `json:"stock_movements"`
		Orders           []models.Order            `json:"orders"`
	}
	
	if err := json.Unmarshal(data, &importData); err != nil {
		return err
	}
	
	mu.Lock()
	defer mu.Unlock()
	
	products = importData.Products
	inventoryRecords = importData.InventoryRecords
	reservations = importData.Reservations
	stockHistory = importData.StockHistory
	stockMovements = importData.StockMovements
	orders = importData.Orders
	
	logger.Info("Data imported successfully",
		"products", len(products),
		"inventory_records", len(inventoryRecords),
		"reservations", len(reservations),
	)
	
	return nil
}

func SearchProducts(query string) []models.Product {
	mu.Lock()
	defer mu.Unlock()
	
	var result []models.Product
	queryLower := strings.ToLower(query)
	
	for _, p := range products {
		if strings.Contains(strings.ToLower(p.SKU), queryLower) ||
			strings.Contains(strings.ToLower(p.Name), queryLower) ||
			strings.Contains(strings.ToLower(p.Description), queryLower) {
			result = append(result, p)
		}
	}
	return result
}

func GetLowStockRecords(threshold int) []models.InventoryRecord {
	mu.Lock()
	defer mu.Unlock()
	
	var result []models.InventoryRecord
	for _, r := range inventoryRecords {
		available := r.CalculateAvailable()
		if available <= threshold {
			result = append(result, r)
		}
	}
	return result
}

func GetExpiredReservations() []*models.Reservation {
	mu.Lock()
	defer mu.Unlock()
	
	var result []*models.Reservation
	now := time.Now()
	
	for _, res := range reservations {
		if res.Status == models.ReservationPending && now.After(res.ExpiresAt) {
			result = append(result, res)
		}
	}
	return result
}

func CleanupExpiredReservations() int {
	expired := GetExpiredReservations()
	count := 0
	
	mu.Lock()
	defer mu.Unlock()
	
	for _, res := range expired {
		res.MarkExpired()
		count++
	}
	
	logger.Info("Expired reservations cleaned up", "count", count)
	return count
}

func GetInventoryValue() float64 {
	mu.Lock()
	defer mu.Unlock()
	
	total := 0.0
	for _, r := range inventoryRecords {
		total += r.CalculateTotalValue()
	}
	return total
}

func GetReservationStats() map[string]interface{} {
	mu.Lock()
	defer mu.Unlock()
	
	stats := map[string]interface{}{
		"total":            len(reservations),
		"pending":          0,
		"fulfilled":        0,
		"released":         0,
		"expired":          0,
		"cancelled":        0,
	}
	
	for _, res := range reservations {
		switch res.Status {
		case models.ReservationPending:
			stats["pending"] = stats["pending"].(int) + 1
		case models.ReservationFulfilled:
			stats["fulfilled"] = stats["fulfilled"].(int) + 1
		case models.ReservationReleased:
			stats["released"] = stats["released"].(int) + 1
		case models.ReservationExpired:
			stats["expired"] = stats["expired"].(int) + 1
		case models.ReservationCancelled:
			stats["cancelled"] = stats["cancelled"].(int) + 1
		}
	}
	
	return stats
}
