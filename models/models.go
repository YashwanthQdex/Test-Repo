package models

import "time"

type Product struct {
	SKU  string `json:"sku"`
	Name string `json:"name"`
}

type InventoryRecord struct {
	SKU      string `json:"sku"`
	OnHand   int    `json:"onHand"`
	Reserved int    `json:"reserved"`
}

type ReservationStatus string

const (
	ReservationPending   ReservationStatus = "PENDING"
	ReservationReleased  ReservationStatus = "RELEASED"
	ReservationFulfilled ReservationStatus = "FULFILLED"
	ReservationExpired   ReservationStatus = "EXPIRED"
)

type Reservation struct {
	ID        string            `json:"id"`
	SKU       string            `json:"sku"`
	Quantity  int               `json:"quantity"`
	ExpiresAt time.Time         `json:"expiresAt"`
	Status    ReservationStatus `json:"status"`
}

type LowStockAlert struct {
	SKU       string `json:"sku"`
	Available int    `json:"available"`
	Threshold int    `json:"threshold"`
}

