package main

type AdjustStockRequest struct {
	SKU   string `json:"sku"`
	Delta int    `json:"delta"`
}

type ReserveRequest struct {
	SKU      string `json:"sku"`
	Quantity int    `json:"quantity"`
}

type ReleaseRequest struct {
	ReservationID string `json:"reservationId"`
}

type FulfillRequest struct {
	ReservationID string `json:"reservationId"`
}
