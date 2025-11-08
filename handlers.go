package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

type API struct {
	service *InventoryService
}

func NewAPI(service *InventoryService) *API {
	return &API{service: service}
}

func (a *API) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", a.handleHealth)
	mux.HandleFunc("/products", a.handleProducts)
	mux.HandleFunc("/products/", a.handleProductBySKU)
	mux.HandleFunc("/stock/adjust", a.handleAdjustStock)
	mux.HandleFunc("/stock/reserve", a.handleReserve)
	mux.HandleFunc("/stock/release", a.handleRelease)
	mux.HandleFunc("/stock/fulfill", a.handleFulfill)
	mux.HandleFunc("/alerts", a.handleAlerts)
}

func (a *API) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *API) handleProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		products, records := a.service.ListProducts()
		writeJSON(w, http.StatusOK, map[string]any{
			"products":  products,
			"inventory": records,
		})
		return
	}
	writeError(w, http.StatusMethodNotAllowed, "method not allowed")
}

func (a *API) handleProductBySKU(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	// URL pattern: /products/{sku}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/products/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusBadRequest, "missing sku")
		return
	}
	sku := parts[0]
	_, rec, err := a.service.GetProduct(sku)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

func (a *API) handleAdjustStock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req AdjustStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	// BUG: Not validating that SKU field is not empty
	rec, err := a.service.AdjustStock(req.SKU, req.Delta)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrProductNotFound {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

func (a *API) handleReserve(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req ReserveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	res, err := a.service.ReserveStock(req.SKU, req.Quantity)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrProductNotFound {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, res)
}

func (a *API) handleRelease(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req ReleaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	res, err := a.service.ReleaseReservation(req.ReservationID)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrReservationNotFound {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (a *API) handleFulfill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req FulfillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	res, err := a.service.FulfillReservation(req.ReservationID)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrReservationNotFound {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (a *API) handleAlerts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	// BUG: Missing Content-Type header before writing response
	writeJSON(w, http.StatusOK, a.service.LowStockAlerts())
}
