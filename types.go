package main

import "time"

// User represents a user in the system
type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Password  string    `json:"password,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Active    bool      `json:"active"`
	Role      string    `json:"role"`
}

// Product represents a product in the catalog
type Product struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Category    string  `json:"category"`
	Stock       int     `json:"stock"`
	SKU         string  `json:"sku"`
	Weight      float64 `json:"weight"`
	Dimensions  string  `json:"dimensions"`
}

// Order represents an order in the system
type Order struct {
	ID          int           `json:"id"`
	UserID      int           `json:"user_id"`
	Items       []OrderItem   `json:"items"`
	TotalAmount float64       `json:"total_amount"`
	Status      string        `json:"status"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
	ShippingAddress Address   `json:"shipping_address"`
	BillingAddress  Address   `json:"billing_address"`
}

// OrderItem represents an item in an order
type OrderItem struct {
	ID        int     `json:"id"`
	OrderID   int     `json:"order_id"`
	ProductID int     `json:"product_id"`
	Quantity  int     `json:"quantity"`
	Price     float64 `json:"price"`
	Product   Product `json:"product,omitempty"`
}

// Address represents a physical address
type Address struct {
	ID       int    `json:"id"`
	Street   string `json:"street"`
	City     string `json:"city"`
	State    string `json:"state"`
	ZipCode  string `json:"zip_code"`
	Country  string `json:"country"`
	UserID   int    `json:"user_id"`
	Type     string `json:"type"` // shipping or billing
}

// Category represents a product category
type Category struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	ParentID    *int   `json:"parent_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Review represents a product review
type Review struct {
	ID        int       `json:"id"`
	ProductID int       `json:"product_id"`
	UserID    int       `json:"user_id"`
	Rating    int       `json:"rating"`
	Comment   string    `json:"comment"`
	CreatedAt time.Time `json:"created_at"`
	Verified  bool      `json:"verified"`
	Helpful   int       `json:"helpful"`
	User      User      `json:"user,omitempty"`
}

// Cart represents a shopping cart
type Cart struct {
	ID        int         `json:"id"`
	UserID    int         `json:"user_id"`
	Items     []CartItem  `json:"items"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

// CartItem represents an item in the shopping cart
type CartItem struct {
	ID        int     `json:"id"`
	CartID    int     `json:"cart_id"`
	ProductID int     `json:"product_id"`
	Quantity  int     `json:"quantity"`
	AddedAt   time.Time `json:"added_at"`
	Product   Product `json:"product,omitempty"`
}

// Payment represents a payment transaction
type Payment struct {
	ID            int       `json:"id"`
	OrderID       int       `json:"order_id"`
	Amount        float64   `json:"amount"`
	Method        string    `json:"method"`
	Status        string    `json:"status"`
	TransactionID string    `json:"transaction_id"`
	CreatedAt     time.Time `json:"created_at"`
	ProcessedAt   *time.Time `json:"processed_at,omitempty"`
}

// Notification represents a user notification
type Notification struct {
	ID      int       `json:"id"`
	UserID  int       `json:"user_id"`
	Type    string    `json:"type"`
	Title   string    `json:"title"`
	Message string    `json:"message"`
	Read    bool      `json:"read"`
	CreatedAt time.Time `json:"created_at"`
	Data    map[string]interface{} `json:"data,omitempty"`
}

// APIResponse represents a standard API response
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Code    int         `json:"code"`
}

// Pagination represents pagination information
type Pagination struct {
	Page     int `json:"page"`
	Limit    int `json:"limit"`
	Total    int `json:"total"`
	TotalPages int `json:"total_pages"`
	HasNext  bool `json:"has_next"`
	HasPrev  bool `json:"has_prev"`
}

// Filter represents filter parameters for queries
type Filter struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    interface{} `json:"value"`
}

// Sort represents sort parameters for queries
type Sort struct {
	Field string `json:"field"`
	Order string `json:"order"` // asc or desc
}

// QueryParams represents query parameters for API requests
type QueryParams struct {
	Filters    []Filter `json:"filters,omitempty"`
	Sort       []Sort   `json:"sort,omitempty"`
	Pagination Pagination `json:"pagination"`
	Search     string   `json:"search,omitempty"`
}

// Config represents application configuration
type Config struct {
	Database DatabaseConfig `json:"database"`
	Server   ServerConfig   `json:"server"`
	Auth     AuthConfig     `json:"auth"`
	Cache    CacheConfig    `json:"cache"`
}

// DatabaseConfig represents database configuration
type DatabaseConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	Name     string `json:"name"`
	SSLMode  string `json:"ssl_mode"`
}

// ServerConfig represents server configuration
type ServerConfig struct {
	Host string `json:"host"`
	Port int    `json:"port"`
	Env  string `json:"env"` // development, staging, production
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	JWTSecret     string `json:"jwt_secret"`
	JWTExpiryHour int    `json:"jwt_expiry_hour"`
	BcryptCost    int    `json:"bcrypt_cost"`
}

// CacheConfig represents cache configuration
type CacheConfig struct {
	RedisHost     string `json:"redis_host"`
	RedisPort     int    `json:"redis_port"`
	RedisPassword string `json:"redis_password"`
	RedisDB       int    `json:"redis_db"`
	TTL           int    `json:"ttl"`
}

// Logger represents a logger interface
type Logger interface {
	Info(msg string, args ...interface{})
	Error(msg string, args ...interface{})
	Debug(msg string, args ...interface{})
	Warn(msg string, args ...interface{})
}

// Service represents a service interface
type Service interface {
	Start() error
	Stop() error
	Status() string
}

// Repository represents a repository interface
type Repository interface {
	Create(model interface{}) error
	Update(id int, model interface{}) error
	Delete(id int) error
	FindByID(id int) (interface{}, error)
	FindAll(params QueryParams) ([]interface{}, error)
}

// Validator represents a validator interface
type Validator interface {
	Validate(model interface{}) []ValidationError
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// Comment line 151
// Comment line 152
// Comment line 153
// Comment line 154
// Comment line 155
// Comment line 156
// Comment line 157
// Comment line 158
// Comment line 159
// Comment line 160
// Comment line 161
// Comment line 162
// Comment line 163
// Comment line 164
// Comment line 165
// Comment line 166
// Comment line 167
// Comment line 168
// Comment line 169
// Comment line 170
// Comment line 171
// Comment line 172
// Comment line 173
// Comment line 174
// Comment line 175
// Comment line 176
// Comment line 177
// Comment line 178
// Comment line 179
// Comment line 180
// Comment line 181
// Comment line 182
// Comment line 183
// Comment line 184
// Comment line 185
// Comment line 186
// Comment line 187
// Comment line 188
// Comment line 189
// Comment line 190
// Comment line 191
// Comment line 192
// Comment line 193
// Comment line 194
// Comment line 195
// Comment line 196
// Comment line 197
// Comment line 198
// Comment line 199
// Comment line 200
