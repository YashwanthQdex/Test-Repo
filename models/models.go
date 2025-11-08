package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

type Product struct {
	SKU          string    `json:"sku"`
	Name         string    `json:"name"`
	Description  string    `json:"description,omitempty"`
	Category     string    `json:"category,omitempty"`
	Price        float64   `json:"price,omitempty"`
	Cost         float64   `json:"cost,omitempty"`
	Weight       float64   `json:"weight,omitempty"`
	Dimensions   Dimensions `json:"dimensions,omitempty"`
	CreatedAt    time.Time `json:"createdAt,omitempty"`
	UpdatedAt    time.Time `json:"updatedAt,omitempty"`
	IsActive     bool      `json:"isActive"`
	SupplierID   string    `json:"supplierId,omitempty"`
	Manufacturer string    `json:"manufacturer,omitempty"`
	Tags         []string  `json:"tags,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

type Dimensions struct {
	Length float64 `json:"length"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
	Unit   string  `json:"unit"`
}

func (d *Dimensions) GetVolume() float64 {
	return d.Length * d.Width * d.Height
}

func (d *Dimensions) Validate() error {
	if d.Length <= 0 || d.Width <= 0 || d.Height <= 0 {
		return errors.New("dimensions must be positive")
	}
	if d.Unit == "" {
		return errors.New("unit is required")
	}
	return nil
}

func (p *Product) Validate() error {
	if strings.TrimSpace(p.SKU) == "" {
		return errors.New("SKU is required")
	}
	if strings.TrimSpace(p.Name) == "" {
		return errors.New("name is required")
	}
	if len(p.SKU) > 100 {
		return errors.New("SKU must be 100 characters or less")
	}
	if len(p.Name) > 200 {
		return errors.New("name must be 200 characters or less")
	}
	if p.Price < 0 {
		return errors.New("price cannot be negative")
	}
	if p.Cost < 0 {
		return errors.New("cost cannot be negative")
	}
	if p.Dimensions != (Dimensions{}) {
		if err := p.Dimensions.Validate(); err != nil {
			return err
		}
	}
	return nil
}

func (p *Product) GetMargin() float64 {
	if p.Price == 0 {
		return 0
	}
	return ((p.Price - p.Cost) / p.Price) * 100
}

func (p *Product) GetProfit() float64 {
	return p.Price - p.Cost
}

func (p *Product) HasTag(tag string) bool {
	for _, t := range p.Tags {
		if t == tag {
			return true
		}
	}
	return false
}

func (p *Product) AddTag(tag string) {
	if !p.HasTag(tag) {
		p.Tags = append(p.Tags, tag)
	}
}

func (p *Product) RemoveTag(tag string) {
	for i, t := range p.Tags {
		if t == tag {
			p.Tags = append(p.Tags[:i], p.Tags[i+1:]...)
			return
		}
	}
}

func (p *Product) ToJSON() ([]byte, error) {
	return json.Marshal(p)
}

func (p *Product) FromJSON(data []byte) error {
	return json.Unmarshal(data, p)
}

func (p *Product) String() string {
	return fmt.Sprintf("Product{SKU: %s, Name: %s}", p.SKU, p.Name)
}

func (p *Product) Clone() *Product {
	clone := *p
	clone.Tags = make([]string, len(p.Tags))
	copy(clone.Tags, p.Tags)
	if p.Metadata != nil {
		clone.Metadata = make(map[string]string)
		for k, v := range p.Metadata {
			clone.Metadata[k] = v
		}
	}
	return &clone
}

func (p *Product) SetMetadata(key, value string) {
	if p.Metadata == nil {
		p.Metadata = make(map[string]string)
	}
	p.Metadata[key] = value
}

func (p *Product) GetMetadata(key string) (string, bool) {
	if p.Metadata == nil {
		return "", false
	}
	val, ok := p.Metadata[key]
	return val, ok
}

type InventoryRecord struct {
	SKU              string    `json:"sku"`
	OnHand           int       `json:"onHand"`
	Reserved         int       `json:"reserved"`
	Available        int       `json:"available"`
	OnOrder          int       `json:"onOrder,omitempty"`
	Allocated        int       `json:"allocated,omitempty"`
	Backordered      int       `json:"backordered,omitempty"`
	ReorderPoint     int       `json:"reorderPoint,omitempty"`
	ReorderQuantity  int       `json:"reorderQuantity,omitempty"`
	LastRestocked    time.Time `json:"lastRestocked,omitempty"`
	LastSold         time.Time `json:"lastSold,omitempty"`
	WarehouseID      string    `json:"warehouseId,omitempty"`
	BinLocation      string    `json:"binLocation,omitempty"`
	Cost             float64   `json:"cost,omitempty"`
	TotalValue       float64   `json:"totalValue,omitempty"`
	UpdatedAt        time.Time `json:"updatedAt"`
	Version          int       `json:"version"`
}

func (ir *InventoryRecord) CalculateAvailable() int {
	ir.Available = ir.OnHand - ir.Reserved - ir.Allocated
	if ir.Available < 0 {
		ir.Available = 0
	}
	return ir.Available
}

func (ir *InventoryRecord) CalculateTotalValue() float64 {
	ir.TotalValue = float64(ir.OnHand) * ir.Cost
	return ir.TotalValue
}

func (ir *InventoryRecord) NeedsReorder() bool {
	return ir.Available <= ir.ReorderPoint && ir.ReorderPoint > 0
}

func (ir *InventoryRecord) CanReserve(quantity int) bool {
	return ir.CalculateAvailable() >= quantity
}

func (ir *InventoryRecord) Reserve(quantity int) error {
	if !ir.CanReserve(quantity) {
		return errors.New("insufficient available stock")
	}
	ir.Reserved += quantity
	ir.Version++
	ir.UpdatedAt = time.Now()
	return nil
}

func (ir *InventoryRecord) Release(quantity int) error {
	if ir.Reserved < quantity {
		return errors.New("cannot release more than reserved")
	}
	ir.Reserved -= quantity
	ir.Version++
	ir.UpdatedAt = time.Now()
	return nil
}

func (ir *InventoryRecord) Fulfill(quantity int) error {
	if ir.Reserved < quantity || ir.OnHand < quantity {
		return errors.New("insufficient stock for fulfillment")
	}
	ir.Reserved -= quantity
	ir.OnHand -= quantity
	ir.Version++
	ir.UpdatedAt = time.Now()
	ir.LastSold = time.Now()
	return nil
}

func (ir *InventoryRecord) Adjust(delta int) error {
	newOnHand := ir.OnHand + delta
	if newOnHand < 0 {
		return errors.New("cannot adjust to negative stock")
	}
	if newOnHand < ir.Reserved {
		return errors.New("cannot adjust below reserved quantity")
	}
	ir.OnHand = newOnHand
	ir.Version++
	ir.UpdatedAt = time.Now()
	return nil
}

func (ir *InventoryRecord) Restock(quantity int) {
	ir.OnHand += quantity
	ir.Version++
	ir.UpdatedAt = time.Now()
	ir.LastRestocked = time.Now()
}

type ReservationStatus string

const (
	ReservationPending   ReservationStatus = "PENDING"
	ReservationReleased  ReservationStatus = "RELEASED"
	ReservationFulfilled ReservationStatus = "FULFILLED"
	ReservationExpired   ReservationStatus = "EXPIRED"
	ReservationCancelled ReservationStatus = "CANCELLED"
)

func (rs ReservationStatus) IsValid() bool {
	switch rs {
	case ReservationPending, ReservationReleased, ReservationFulfilled, ReservationExpired, ReservationCancelled:
		return true
	}
	return false
}

func (rs ReservationStatus) String() string {
	return string(rs)
}

type Reservation struct {
	ID            string            `json:"id"`
	SKU           string            `json:"sku"`
	Quantity      int               `json:"quantity"`
	ExpiresAt     time.Time         `json:"expiresAt"`
	Status        ReservationStatus `json:"status"`
	OrderID       string            `json:"orderId,omitempty"`
	CustomerID    string            `json:"customerId,omitempty"`
	CreatedAt     time.Time         `json:"createdAt"`
	UpdatedAt     time.Time         `json:"updatedAt"`
	FulfilledAt   time.Time         `json:"fulfilledAt,omitempty"`
	ReleasedAt    time.Time         `json:"releasedAt,omitempty"`
	Reason        string            `json:"reason,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
	Version       int               `json:"version"`
}

func (r *Reservation) IsExpired() bool {
	return time.Now().After(r.ExpiresAt)
}

func (r *Reservation) IsValid() bool {
	return r.Status == ReservationPending && !r.IsExpired()
}

func (r *Reservation) CanFulfill() bool {
	return r.IsValid()
}

func (r *Reservation) CanRelease() bool {
	return r.Status == ReservationPending
}

func (r *Reservation) MarkFulfilled() {
	r.Status = ReservationFulfilled
	r.FulfilledAt = time.Now()
	r.UpdatedAt = time.Now()
	r.Version++
}

func (r *Reservation) MarkReleased(reason string) {
	r.Status = ReservationReleased
	r.ReleasedAt = time.Now()
	r.UpdatedAt = time.Now()
	r.Reason = reason
	r.Version++
}

func (r *Reservation) MarkExpired() {
	r.Status = ReservationExpired
	r.UpdatedAt = time.Now()
	r.Version++
}

func (r *Reservation) MarkCancelled(reason string) {
	r.Status = ReservationCancelled
	r.ReleasedAt = time.Now()
	r.UpdatedAt = time.Now()
	r.Reason = reason
	r.Version++
}

func (r *Reservation) SetMetadata(key, value string) {
	if r.Metadata == nil {
		r.Metadata = make(map[string]string)
	}
	r.Metadata[key] = value
}

func (r *Reservation) GetMetadata(key string) (string, bool) {
	if r.Metadata == nil {
		return "", false
	}
	val, ok := r.Metadata[key]
	return val, ok
}

func (r *Reservation) Validate() error {
	if strings.TrimSpace(r.SKU) == "" {
		return errors.New("SKU is required")
	}
	if r.Quantity <= 0 {
		return errors.New("quantity must be positive")
	}
	if r.ExpiresAt.IsZero() {
		return errors.New("expiresAt is required")
	}
	if !r.Status.IsValid() {
		return errors.New("invalid status")
	}
	return nil
}

type LowStockAlert struct {
	SKU              string    `json:"sku"`
	Available        int       `json:"available"`
	Threshold        int       `json:"threshold"`
	OnHand           int       `json:"onHand"`
	Reserved         int       `json:"reserved"`
	AlertLevel       string    `json:"alertLevel"`
	CreatedAt        time.Time `json:"createdAt"`
	ProductName      string    `json:"productName,omitempty"`
	DaysUntilStockout int      `json:"daysUntilStockout,omitempty"`
	SuggestedReorder int       `json:"suggestedReorder,omitempty"`
	WarehouseID      string    `json:"warehouseId,omitempty"`
}

func (lsa *LowStockAlert) GetAlertLevel() string {
	if lsa.Threshold == 0 {
		return "UNKNOWN"
	}
	percentage := float64(lsa.Available) / float64(lsa.Threshold) * 100
	if percentage <= 25 {
		return "CRITICAL"
	} else if percentage <= 50 {
		return "HIGH"
	} else if percentage <= 75 {
		return "MEDIUM"
	}
	return "LOW"
}

func (lsa *LowStockAlert) CalculateDaysUntilStockout(avgDailySales float64) int {
	if avgDailySales <= 0 {
		return -1
	}
	days := float64(lsa.Available) / avgDailySales
	return int(days)
}

func (lsa *LowStockAlert) CalculateSuggestedReorder(reorderQuantity int) int {
	if reorderQuantity > 0 {
		return reorderQuantity
	}
	return lsa.Threshold * 2
}

type StockMovement struct {
	ID          string    `json:"id"`
	SKU         string    `json:"sku"`
	Type        string    `json:"type"`
	Quantity    int       `json:"quantity"`
	BeforeQty   int       `json:"beforeQty"`
	AfterQty    int       `json:"afterQty"`
	Reason      string    `json:"reason"`
	ReferenceID string    `json:"referenceId,omitempty"`
	CreatedBy   string    `json:"createdBy,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	Notes       string    `json:"notes,omitempty"`
	WarehouseID string    `json:"warehouseId,omitempty"`
}

const (
	MovementTypeReceive    = "RECEIVE"
	MovementTypeAdjustment = "ADJUSTMENT"
	MovementTypeSale       = "SALE"
	MovementTypeReturn     = "RETURN"
	MovementTypeTransfer   = "TRANSFER"
	MovementTypeDamage     = "DAMAGE"
	MovementTypeTheft      = "THEFT"
	MovementTypeCycleCount = "CYCLE_COUNT"
)

func (sm *StockMovement) Validate() error {
	if strings.TrimSpace(sm.SKU) == "" {
		return errors.New("SKU is required")
	}
	if sm.Quantity == 0 {
		return errors.New("quantity cannot be zero")
	}
	if strings.TrimSpace(sm.Type) == "" {
		return errors.New("type is required")
	}
	validTypes := []string{
		MovementTypeReceive, MovementTypeAdjustment, MovementTypeSale,
		MovementTypeReturn, MovementTypeTransfer, MovementTypeDamage,
		MovementTypeTheft, MovementTypeCycleCount,
	}
	valid := false
	for _, vt := range validTypes {
		if sm.Type == vt {
			valid = true
			break
		}
	}
	if !valid {
		return errors.New("invalid movement type")
	}
	return nil
}

type Order struct {
	ID              string            `json:"id"`
	OrderNumber     string            `json:"orderNumber"`
	CustomerID      string            `json:"customerId"`
	Status          string            `json:"status"`
	Items           []OrderItem       `json:"items"`
	TotalAmount     float64           `json:"totalAmount"`
	ShippingAddress Address           `json:"shippingAddress"`
	BillingAddress  Address           `json:"billingAddress"`
	CreatedAt       time.Time         `json:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt"`
	ShippedAt       time.Time         `json:"shippedAt,omitempty"`
	DeliveredAt     time.Time         `json:"deliveredAt,omitempty"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

type OrderItem struct {
	SKU         string  `json:"sku"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unitPrice"`
	TotalPrice  float64 `json:"totalPrice"`
	ProductName string  `json:"productName,omitempty"`
}

func (o *Order) CalculateTotal() {
	total := 0.0
	for i := range o.Items {
		o.Items[i].TotalPrice = o.Items[i].UnitPrice * float64(o.Items[i].Quantity)
		total += o.Items[i].TotalPrice
	}
	o.TotalAmount = total
}

func (o *Order) AddItem(item OrderItem) {
	o.Items = append(o.Items, item)
	o.CalculateTotal()
}

func (o *Order) GetItemCount() int {
	count := 0
	for _, item := range o.Items {
		count += item.Quantity
	}
	return count
}

func (o *Order) IsShippable() bool {
	return o.Status == "CONFIRMED" || o.Status == "PROCESSING"
}

func (o *Order) MarkShipped() {
	o.Status = "SHIPPED"
	o.ShippedAt = time.Now()
	o.UpdatedAt = time.Now()
}

func (o *Order) MarkDelivered() {
	o.Status = "DELIVERED"
	o.DeliveredAt = time.Now()
	o.UpdatedAt = time.Now()
}

type Address struct {
	Street1    string `json:"street1"`
	Street2    string `json:"street2,omitempty"`
	City       string `json:"city"`
	State      string `json:"state"`
	PostalCode string `json:"postalCode"`
	Country    string `json:"country"`
}

func (a *Address) Validate() error {
	if strings.TrimSpace(a.Street1) == "" {
		return errors.New("street1 is required")
	}
	if strings.TrimSpace(a.City) == "" {
		return errors.New("city is required")
	}
	if strings.TrimSpace(a.Country) == "" {
		return errors.New("country is required")
	}
	return nil
}

func (a *Address) String() string {
	parts := []string{a.Street1}
	if a.Street2 != "" {
		parts = append(parts, a.Street2)
	}
	parts = append(parts, a.City, a.State, a.PostalCode, a.Country)
	return strings.Join(parts, ", ")
}

type Supplier struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	ContactName string    `json:"contactName,omitempty"`
	Email       string    `json:"email,omitempty"`
	Phone       string    `json:"phone,omitempty"`
	Address     Address   `json:"address,omitempty"`
	IsActive    bool      `json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (s *Supplier) Validate() error {
	if strings.TrimSpace(s.Name) == "" {
		return errors.New("name is required")
	}
	return nil
}

type Warehouse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Code        string    `json:"code"`
	Address     Address   `json:"address"`
	IsActive    bool      `json:"isActive"`
	Capacity    int       `json:"capacity,omitempty"`
	CurrentStock int      `json:"currentStock,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (w *Warehouse) Validate() error {
	if strings.TrimSpace(w.Name) == "" {
		return errors.New("name is required")
	}
	if strings.TrimSpace(w.Code) == "" {
		return errors.New("code is required")
	}
	if err := w.Address.Validate(); err != nil {
		return err
	}
	return nil
}

type InventorySnapshot struct {
	ID          string             `json:"id"`
	SnapshotAt  time.Time          `json:"snapshotAt"`
	Records     []InventoryRecord  `json:"records"`
	TotalSKUs   int                `json:"totalSKUs"`
	TotalValue  float64            `json:"totalValue"`
	TotalOnHand int                `json:"totalOnHand"`
	TotalReserved int              `json:"totalReserved"`
	CreatedAt   time.Time          `json:"createdAt"`
}

func (is *InventorySnapshot) CalculateTotals() {
	is.TotalSKUs = len(is.Records)
	is.TotalOnHand = 0
	is.TotalReserved = 0
	is.TotalValue = 0
	
	for _, record := range is.Records {
		is.TotalOnHand += record.OnHand
		is.TotalReserved += record.Reserved
		is.TotalValue += record.TotalValue
	}
}

type ProductCategory struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	ParentID    string    `json:"parentId,omitempty"`
	IsActive    bool      `json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (pc *ProductCategory) Validate() error {
	if strings.TrimSpace(pc.Name) == "" {
		return errors.New("name is required")
	}
	return nil
}

type InventoryTransaction struct {
	ID            string    `json:"id"`
	SKU           string    `json:"sku"`
	TransactionType string  `json:"transactionType"`
	Quantity      int       `json:"quantity"`
	BeforeQty     int       `json:"beforeQty"`
	AfterQty      int       `json:"afterQty"`
	Reason        string    `json:"reason"`
	ReferenceID   string    `json:"referenceId,omitempty"`
	CreatedBy     string    `json:"createdBy,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	Notes         string    `json:"notes,omitempty"`
}

func (it *InventoryTransaction) Validate() error {
	if strings.TrimSpace(it.SKU) == "" {
		return errors.New("SKU is required")
	}
	if it.Quantity == 0 {
		return errors.New("quantity cannot be zero")
	}
	return nil
}

type ReorderPoint struct {
	SKU           string    `json:"sku"`
	ReorderPoint  int       `json:"reorderPoint"`
	ReorderQuantity int     `json:"reorderQuantity"`
	LeadTimeDays  int       `json:"leadTimeDays"`
	SafetyStock   int       `json:"safetyStock"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func (rp *ReorderPoint) CalculateSafetyStock(avgDailySales float64, leadTimeDays int) int {
	if avgDailySales <= 0 {
		return 0
	}
	return int(avgDailySales * float64(leadTimeDays) * 1.5)
}

func (rp *ReorderPoint) CalculateReorderPoint(avgDailySales float64, leadTimeDays int) int {
	safetyStock := rp.CalculateSafetyStock(avgDailySales, leadTimeDays)
	return int(avgDailySales*float64(leadTimeDays)) + safetyStock
}
