package main

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port              string
	LowStockThreshold int
	ReservationTTL    time.Duration
}

func LoadConfig() Config {
	port := getEnv("PORT", "8080")
	threshold := parseIntEnv("LOW_STOCK_THRESHOLD", 5)
	resTTLMins := parseIntEnv("RESERVATION_TTL_MINUTES", 30)

	return Config{
		Port:              port,
		LowStockThreshold: threshold,
		ReservationTTL:    time.Duration(resTTLMins) * time.Minute,
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func parseIntEnv(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
