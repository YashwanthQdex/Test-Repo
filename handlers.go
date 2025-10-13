package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// UserHandler handles user-related operations
type UserHandler struct {
	userService UserService
}

// NewUserHandler creates a new user handler
func NewUserHandler(service UserService) *UserHandler {
	return &UserHandler{userService: service}
}

// GetUsers handles GET /users
func (h *UserHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.userService.GetAllUsers()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    users,
		Code:    http.StatusOK,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetUser handles GET /users/{id}
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/users/"):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	user, err := h.userService.GetUserByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    user,
		Code:    http.StatusOK,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateUser handles POST /users
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.userService.CreateUser(&user); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    user,
		Code:    http.StatusCreated,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// UpdateUser handles PUT /users/{id}
func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/users/"):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	user.ID = id

	if err := h.userService.UpdateUser(&user); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    user,
		Code:    http.StatusOK,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// DeleteUser handles DELETE /users/{id}
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/users/"):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	if err := h.userService.DeleteUser(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := APIResponse{
		Success: true,
		Message: "User deleted successfully",
		Code:    http.StatusOK,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ProductHandler handles product-related operations
type ProductHandler struct {
	productService ProductService
}

// NewProductHandler creates a new product handler
func NewProductHandler(service ProductService) *ProductHandler {
	return &ProductHandler{productService: service}
}

// GetProducts handles GET /products
func (h *ProductHandler) GetProducts(w http.ResponseWriter, r *http.Request) {
	products, err := h.productService.GetAllProducts()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    products,
		Code:    http.StatusOK,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetProduct handles GET /products/{id}
func (h *ProductHandler) GetProduct(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/products/"):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid product ID", http.StatusBadRequest)
		return
	}

	product, err := h.productService.GetProductByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    product,
		Code:    http.StatusOK,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// OrderHandler handles order-related operations
type OrderHandler struct {
	orderService OrderService
}

// NewOrderHandler creates a new order handler
func NewOrderHandler(service OrderService) *OrderHandler {
	return &OrderHandler{orderService: service}
}

// CreateOrder handles POST /orders
func (h *OrderHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var order Order
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.orderService.CreateOrder(&order); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    order,
		Code:    http.StatusCreated,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// GetOrder handles GET /orders/{id}
func (h *OrderHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/orders/"):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	order, err := h.orderService.GetOrderByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    order,
		Code:    http.StatusOK,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// AuthHandler handles authentication operations
type AuthHandler struct {
	authService AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(service AuthService) *AuthHandler {
	return &AuthHandler{authService: service}
}

// Login handles POST /login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var credentials struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&credentials); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	token, err := h.authService.Login(credentials.Username, credentials.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    map[string]string{"token": token},
		Code:    http.StatusOK,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Register handles POST /register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.authService.Register(&user); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    user,
		Code:    http.StatusCreated,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// Middleware functions

// LoggingMiddleware logs HTTP requests
func LoggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next(w, r)
		fmt.Printf("[%s] %s %s %v\n", r.Method, r.URL.Path, r.RemoteAddr, time.Since(start))
	}
}

// AuthMiddleware validates JWT tokens
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("Authorization")
		if token == "" {
			http.Error(w, "Missing authorization token", http.StatusUnauthorized)
			return
		}

		// Validate token logic would go here
		// For now, just pass through
		next(w, r)
	}
}

// CORSMiddleware handles CORS headers
func CORSMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// Service interfaces (for dependency injection)
type UserService interface {
	GetAllUsers() ([]User, error)
	GetUserByID(id int) (*User, error)
	CreateUser(user *User) error
	UpdateUser(user *User) error
	DeleteUser(id int) error
}

type ProductService interface {
	GetAllProducts() ([]Product, error)
	GetProductByID(id int) (*Product, error)
	CreateProduct(product *Product) error
	UpdateProduct(product *Product) error
	DeleteProduct(id int) error
}

type OrderService interface {
	GetAllOrders() ([]Order, error)
	GetOrderByID(id int) (*Order, error)
	CreateOrder(order *Order) error
	UpdateOrder(order *Order) error
	DeleteOrder(id int) error
}

type AuthService interface {
	Login(username, password string) (string, error)
	Register(user *User) error
	ValidateToken(token string) (*User, error)
}

// Comment line 251
// Comment line 252
// Comment line 253
// Comment line 254
// Comment line 255
// Comment line 256
// Comment line 257
// Comment line 258
// Comment line 259
// Comment line 260
// Comment line 261
// Comment line 262
// Comment line 263
// Comment line 264
// Comment line 265
// Comment line 266
// Comment line 267
// Comment line 268
// Comment line 269
// Comment line 270
// Comment line 271
// Comment line 272
// Comment line 273
// Comment line 274
// Comment line 275
// Comment line 276
// Comment line 277
// Comment line 278
// Comment line 279
// Comment line 280
// Comment line 281
// Comment line 282
// Comment line 283
// Comment line 284
// Comment line 285
// Comment line 286
// Comment line 287
// Comment line 288
// Comment line 289
// Comment line 290
// Comment line 291
// Comment line 292
// Comment line 293
// Comment line 294
// Comment line 295
// Comment line 296
// Comment line 297
// Comment line 298
// Comment line 299
// Comment line 300
