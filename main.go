package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Inventory Service OK"))
	})
	log.Fatal(http.ListenAndServe(":8083", nil))
}

// Added for PR test

func NewInventoryItem() string { return "new item" }

// CRITICAL: Hardcoded credentials
var password = "123456"

// MEDIUM: Unused function
func temp() {}

// LOW: Unused import
var _ = os.Getenv
