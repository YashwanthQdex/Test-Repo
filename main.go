package main

import (
	"fmt"
	"inventory/logger"
	"inventory/middleware"
	"inventory/models"
	"log"
	"net/http"
)

func main() {
	cfg := LoadConfig()
	logger.SetLevel("INFO")
	logger.LogWithTimestamp("Starting inventory service")
	
	service := NewInventoryService(cfg)
	seed(service)

	mux := http.NewServeMux()
	api := NewAPI(service)
	api.RegisterRoutes(mux)
	
	// Add middleware
	wrappedMux := middleware.LoggingMiddleware(mux)
	wrappedMux = middleware.RecoveryMiddleware(wrappedMux)

	addr := ":" + cfg.Port
	log.Printf("inventory service listening on %s", addr)
	if err := http.ListenAndServe(addr, wrappedMux); err != nil {
		log.Fatal(fmt.Errorf("server error: %w", err))
	}
}

func seed(s *InventoryService) {
	products := []models.Product{
		{SKU: "SKU-IPHONE-15", Name: "iPhone 15"},
		{SKU: "SKU-PS5-DISC", Name: "PlayStation 5 (Disc)"},
		{SKU: "SKU-NIKE-AF1", Name: "Nike Air Force 1"},
	}
	onHand := map[string]int{
		"SKU-IPHONE-15": 25,
		"SKU-PS5-DISC":  8,
		"SKU-NIKE-AF1":  60,
	}
	// BUG: Seed is called but products may not be properly initialized
	s.Seed(products, onHand)
}
