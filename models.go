package main

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// BaseModel represents common fields for all models
type BaseModel struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty" gorm:"index"`
}

// UserModel represents the user table in database
type UserModel struct {
	BaseModel
	Username     string       `json:"username" gorm:"uniqueIndex;not null"`
	Email        string       `json:"email" gorm:"uniqueIndex;not null"`
	Password     string       `json:"-" gorm:"not null"` // Don't serialize password
	FirstName    string       `json:"first_name"`
	LastName     string       `json:"last_name"`
	Phone        string       `json:"phone"`
	DateOfBirth  *time.Time   `json:"date_of_birth"`
	IsActive     bool         `json:"is_active" gorm:"default:true"`
	IsVerified   bool         `json:"is_verified" gorm:"default:false"`
	LastLoginAt  *time.Time   `json:"last_login_at"`
	Role         UserRole     `json:"role" gorm:"type:varchar(20);default:'user'"`
	Profile      UserProfile  `json:"profile,omitempty" gorm:"foreignKey:UserID"`
	Addresses    []AddressModel `json:"addresses,omitempty" gorm:"foreignKey:UserID"`
}

// UserRole represents user roles
type UserRole string

const (
	RoleUser      UserRole = "user"
	RoleAdmin     UserRole = "admin"
	RoleModerator UserRole = "moderator"
	RoleSeller    UserRole = "seller"
)

// Scan implements the Scanner interface for UserRole
func (ur *UserRole) Scan(value interface{}) error {
	if value == nil {
		*ur = RoleUser
		return nil
	}
	*ur = UserRole(value.(string))
	return nil
}

// Value implements the driver Valuer interface for UserRole
func (ur UserRole) Value() (driver.Value, error) {
	return string(ur), nil
}

// UserProfile represents user profile information
type UserProfile struct {
	BaseModel
	UserID      uint   `json:"user_id" gorm:"uniqueIndex;not null"`
	Bio         string `json:"bio" gorm:"type:text"`
	AvatarURL   string `json:"avatar_url"`
	Website     string `json:"website"`
	Location    string `json:"location"`
	SocialLinks JSONB  `json:"social_links" gorm:"type:jsonb"`
}

// AddressModel represents the address table
type AddressModel struct {
	BaseModel
	UserID    uint   `json:"user_id" gorm:"not null"`
	Type      string `json:"type" gorm:"type:varchar(20);default:'shipping'"` // shipping, billing
	Street    string `json:"street" gorm:"not null"`
	City      string `json:"city" gorm:"not null"`
	State     string `json:"state" gorm:"not null"`
	ZipCode   string `json:"zip_code" gorm:"not null"`
	Country   string `json:"country" gorm:"not null"`
	IsDefault bool   `json:"is_default" gorm:"default:false"`
}

// ProductModel represents the product table
type ProductModel struct {
	BaseModel
	Name            string          `json:"name" gorm:"not null"`
	Description     string          `json:"description" gorm:"type:text"`
	Price           float64         `json:"price" gorm:"type:decimal(10,2);not null"`
	ComparePrice    float64         `json:"compare_price" gorm:"type:decimal(10,2)"`
	SKU             string          `json:"sku" gorm:"uniqueIndex"`
	StockQuantity   int             `json:"stock_quantity" gorm:"default:0"`
	Weight          float64         `json:"weight" gorm:"type:decimal(8,2)"`
	Dimensions      JSONB           `json:"dimensions" gorm:"type:jsonb"`
	CategoryID      uint            `json:"category_id"`
	Category        CategoryModel   `json:"category,omitempty"`
	Images          []ProductImage  `json:"images,omitempty" gorm:"foreignKey:ProductID"`
	Variants        []ProductVariant `json:"variants,omitempty" gorm:"foreignKey:ProductID"`
	IsActive        bool            `json:"is_active" gorm:"default:true"`
	IsFeatured      bool            `json:"is_featured" gorm:"default:false"`
	Tags            []TagModel      `json:"tags,omitempty" gorm:"many2many:product_tags;"`
	Reviews         []ReviewModel   `json:"reviews,omitempty" gorm:"foreignKey:ProductID"`
	AverageRating   float64         `json:"average_rating" gorm:"type:decimal(3,2)"`
	ReviewCount     int             `json:"review_count"`
}

// ProductImage represents product images
type ProductImage struct {
	BaseModel
	ProductID uint   `json:"product_id" gorm:"not null"`
	URL       string `json:"url" gorm:"not null"`
	AltText   string `json:"alt_text"`
	IsPrimary bool   `json:"is_primary" gorm:"default:false"`
	SortOrder int    `json:"sort_order" gorm:"default:0"`
}

// ProductVariant represents product variants
type ProductVariant struct {
	BaseModel
	ProductID     uint    `json:"product_id" gorm:"not null"`
	Name          string  `json:"name" gorm:"not null"`
	SKU           string  `json:"sku"`
	PriceModifier float64 `json:"price_modifier" gorm:"type:decimal(10,2);default:0"`
	StockQuantity int     `json:"stock_quantity" gorm:"default:0"`
	Attributes    JSONB   `json:"attributes" gorm:"type:jsonb"`
}

// CategoryModel represents product categories
type CategoryModel struct {
	BaseModel
	Name        string           `json:"name" gorm:"uniqueIndex;not null"`
	Slug        string           `json:"slug" gorm:"uniqueIndex;not null"`
	Description string           `json:"description" gorm:"type:text"`
	ParentID    *uint            `json:"parent_id"`
	Parent      *CategoryModel   `json:"parent,omitempty" gorm:"foreignKey:ParentID"`
	Children    []CategoryModel  `json:"children,omitempty"`
	ImageURL    string           `json:"image_url"`
	SortOrder   int              `json:"sort_order" gorm:"default:0"`
	IsActive    bool             `json:"is_active" gorm:"default:true"`
	Products    []ProductModel   `json:"products,omitempty"`
}

// TagModel represents product tags
type TagModel struct {
	BaseModel
	Name     string        `json:"name" gorm:"uniqueIndex;not null"`
	Slug     string        `json:"slug" gorm:"uniqueIndex;not null"`
	Color    string        `json:"color" gorm:"type:varchar(7)"` // Hex color code
	Products []ProductModel `json:"products,omitempty" gorm:"many2many:product_tags;"`
}

// OrderModel represents the order table
type OrderModel struct {
	BaseModel
	UserID            uint            `json:"user_id" gorm:"not null"`
	User              UserModel       `json:"user,omitempty"`
	OrderNumber       string          `json:"order_number" gorm:"uniqueIndex;not null"`
	Status            OrderStatus     `json:"status" gorm:"type:varchar(20);default:'pending'"`
	Subtotal          float64         `json:"subtotal" gorm:"type:decimal(10,2);not null"`
	TaxAmount         float64         `json:"tax_amount" gorm:"type:decimal(10,2);default:0"`
	ShippingAmount    float64         `json:"shipping_amount" gorm:"type:decimal(10,2);default:0"`
	DiscountAmount    float64         `json:"discount_amount" gorm:"type:decimal(10,2);default:0"`
	TotalAmount       float64         `json:"total_amount" gorm:"type:decimal(10,2);not null"`
	Currency          string          `json:"currency" gorm:"type:varchar(3);default:'USD'"`
	ShippingAddressID uint            `json:"shipping_address_id"`
	ShippingAddress   AddressModel    `json:"shipping_address,omitempty"`
	BillingAddressID  *uint           `json:"billing_address_id"`
	BillingAddress    *AddressModel   `json:"billing_address,omitempty"`
	PaymentMethod     string          `json:"payment_method"`
	PaymentStatus     PaymentStatus   `json:"payment_status" gorm:"type:varchar(20);default:'pending'"`
	Items             []OrderItemModel `json:"items,omitempty" gorm:"foreignKey:OrderID"`
	Notes             string          `json:"notes" gorm:"type:text"`
	ShippedAt         *time.Time      `json:"shipped_at"`
	DeliveredAt       *time.Time      `json:"delivered_at"`
}

// OrderStatus represents order statuses
type OrderStatus string

const (
	OrderPending    OrderStatus = "pending"
	OrderConfirmed  OrderStatus = "confirmed"
	OrderProcessing OrderStatus = "processing"
	OrderShipped    OrderStatus = "shipped"
	OrderDelivered  OrderStatus = "delivered"
	OrderCancelled  OrderStatus = "cancelled"
	OrderRefunded   OrderStatus = "refunded"
)

// PaymentStatus represents payment statuses
type PaymentStatus string

const (
	PaymentPending   PaymentStatus = "pending"
	PaymentPaid      PaymentStatus = "paid"
	PaymentFailed    PaymentStatus = "failed"
	PaymentRefunded  PaymentStatus = "refunded"
)

// OrderItemModel represents order items
type OrderItemModel struct {
	BaseModel
	OrderID     uint         `json:"order_id" gorm:"not null"`
	ProductID   uint         `json:"product_id" gorm:"not null"`
	Product     ProductModel `json:"product,omitempty"`
	VariantID   *uint        `json:"variant_id"`
	Variant     *ProductVariant `json:"variant,omitempty"`
	Quantity    int          `json:"quantity" gorm:"not null"`
	UnitPrice   float64      `json:"unit_price" gorm:"type:decimal(10,2);not null"`
	TotalPrice  float64      `json:"total_price" gorm:"type:decimal(10,2);not null"`
}

// ReviewModel represents product reviews
type ReviewModel struct {
	BaseModel
	ProductID   uint        `json:"product_id" gorm:"not null"`
	Product     ProductModel `json:"product,omitempty"`
	UserID      uint        `json:"user_id" gorm:"not null"`
	User        UserModel   `json:"user,omitempty"`
	Rating      int         `json:"rating" gorm:"not null;check:rating >= 1 AND rating <= 5"`
	Title       string      `json:"title"`
	Comment     string      `json:"comment" gorm:"type:text"`
	IsVerified  bool        `json:"is_verified" gorm:"default:false"`
	Helpful     int         `json:"helpful" gorm:"default:0"`
	NotHelpful  int         `json:"not_helpful" gorm:"default:0"`
	Images      []ReviewImage `json:"images,omitempty" gorm:"foreignKey:ReviewID"`
}

// ReviewImage represents review images
type ReviewImage struct {
	BaseModel
	ReviewID uint   `json:"review_id" gorm:"not null"`
	URL      string `json:"url" gorm:"not null"`
	AltText  string `json:"alt_text"`
}

// CartModel represents the shopping cart
type CartModel struct {
	BaseModel
	UserID    uint            `json:"user_id" gorm:"not null"`
	User      UserModel       `json:"user,omitempty"`
	SessionID string          `json:"session_id"`
	Items     []CartItemModel `json:"items,omitempty" gorm:"foreignKey:CartID"`
	ExpiresAt time.Time       `json:"expires_at"`
}

// CartItemModel represents cart items
type CartItemModel struct {
	BaseModel
	CartID    uint           `json:"cart_id" gorm:"not null"`
	ProductID uint           `json:"product_id" gorm:"not null"`
	Product   ProductModel   `json:"product,omitempty"`
	VariantID *uint          `json:"variant_id"`
	Variant   *ProductVariant `json:"variant,omitempty"`
	Quantity  int            `json:"quantity" gorm:"not null"`
	AddedAt   time.Time      `json:"added_at"`
}

// JSONB represents a JSONB type for PostgreSQL
type JSONB map[string]interface{}

// Scan implements the Scanner interface for JSONB
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("cannot scan non-byte value into JSONB")
	}

	return json.Unmarshal(bytes, j)
}

// Value implements the driver Valuer interface for JSONB
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// TableName returns the table name for BaseModel
func (BaseModel) TableName() string {
	return "base_models"
}

// BeforeCreate hook for BaseModel
func (bm *BaseModel) BeforeCreate() error {
	if bm.CreatedAt.IsZero() {
		bm.CreatedAt = time.Now()
	}
	if bm.UpdatedAt.IsZero() {
		bm.UpdatedAt = time.Now()
	}
	return nil
}

// BeforeUpdate hook for BaseModel
func (bm *BaseModel) BeforeUpdate() error {
	bm.UpdatedAt = time.Now()
	return nil
}

// Comment line 301
// Comment line 302
// Comment line 303
// Comment line 304
// Comment line 305
// Comment line 306
// Comment line 307
// Comment line 308
// Comment line 309
// Comment line 310
// Comment line 311
// Comment line 312
// Comment line 313
// Comment line 314
// Comment line 315
// Comment line 316
// Comment line 317
// Comment line 318
// Comment line 319
// Comment line 320
// Comment line 321
// Comment line 322
// Comment line 323
// Comment line 324
// Comment line 325
// Comment line 326
// Comment line 327
// Comment line 328
// Comment line 329
// Comment line 330
// Comment line 331
// Comment line 332
// Comment line 333
// Comment line 334
// Comment line 335
// Comment line 336
// Comment line 337
// Comment line 338
// Comment line 339
// Comment line 340
// Comment line 341
// Comment line 342
// Comment line 343
// Comment line 344
// Comment line 345
// Comment line 346
// Comment line 347
// Comment line 348
// Comment line 349
// Comment line 350
// Comment line 351
// Comment line 352
// Comment line 353
// Comment line 354
// Comment line 355
// Comment line 356
// Comment line 357
// Comment line 358
// Comment line 359
// Comment line 360
// Comment line 361
// Comment line 362
// Comment line 363
// Comment line 364
// Comment line 365
// Comment line 366
// Comment line 367
// Comment line 368
// Comment line 369
// Comment line 370
// Comment line 371
// Comment line 372
// Comment line 373
// Comment line 374
// Comment line 375
// Comment line 376
// Comment line 377
// Comment line 378
// Comment line 379
// Comment line 380
// Comment line 381
// Comment line 382
// Comment line 383
// Comment line 384
// Comment line 385
// Comment line 386
// Comment line 387
// Comment line 388
// Comment line 389
// Comment line 390
// Comment line 391
// Comment line 392
// Comment line 393
// Comment line 394
// Comment line 395
// Comment line 396
// Comment line 397
// Comment line 398
// Comment line 399
// Comment line 400
