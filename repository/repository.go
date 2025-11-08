package repository

import (
	"fmt"
	"inventory/models"
	"sync"
)

var (
	stockHistory []StockChange
	reservations []*models.Reservation
	mu           sync.Mutex
)

type StockChange struct {
	SKU      string
	Delta    int
	NewValue int
	Timestamp string
}

func LogStockChange(sku string, delta int, newValue int) {
	mu.Lock()
	defer mu.Unlock()
	change := StockChange{
		SKU:       sku,
		Delta:     delta,
		NewValue:  newValue,
		Timestamp: fmt.Sprintf("%d", 0), // Placeholder
	}
	stockHistory = append(stockHistory, change)
}

func SaveReservation(res *models.Reservation) {
	mu.Lock()
	defer mu.Unlock()
	reservations = append(reservations, res)
}

func SaveSeedData(products []models.Product, onHandBySKU map[string]int) {
	mu.Lock()
	defer mu.Unlock()
	// Placeholder for persistence
}

func GetStockHistory(sku string) []StockChange {
	mu.Lock()
	defer mu.Unlock()
	result := []StockChange{}
	for _, change := range stockHistory {
		if change.SKU == sku {
			result = append(result, change)
		}
	}
	return result
}

func GetAllReservations() []*models.Reservation {
	mu.Lock()
	defer mu.Unlock()
	return reservations
}

