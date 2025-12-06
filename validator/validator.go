package validator

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

var (
	skuPattern        = regexp.MustCompile(`^SKU-[A-Z0-9-]+$`)
	emailPattern      = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	phonePattern      = regexp.MustCompile(`^\+?[1-9]\d{1,14}$`)
	urlPattern        = regexp.MustCompile(`^https?://[^\s/$.?#].[^\s]*$`)
	alphanumericPattern = regexp.MustCompile(`^[a-zA-Z0-9]+$`)
)

type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

type ValidationResult struct {
	Valid   bool
	Errors  []ValidationError
}

func (vr *ValidationResult) AddError(field, message string) {
	vr.Errors = append(vr.Errors, ValidationError{Field: field, Message: message})
	vr.Valid = false
}

func (vr *ValidationResult) IsValid() bool {
	return vr.Valid && len(vr.Errors) == 0
}

func NewValidationResult() *ValidationResult {
	return &ValidationResult{
		Valid:  true,
		Errors: []ValidationError{},
	}
}

func ValidateSKU(sku string) bool {
	if strings.TrimSpace(sku) == "" {
		return false
	}
	return skuPattern.MatchString(sku)
}

func ValidateSKUWithError(sku string) error {
	if strings.TrimSpace(sku) == "" {
		return errors.New("SKU cannot be empty")
	}
	if len(sku) > 100 {
		return errors.New("SKU must be 100 characters or less")
	}
	if !skuPattern.MatchString(sku) {
		return errors.New("SKU must match pattern SKU-[A-Z0-9-]+")
	}
	return nil
}

func ValidateQuantity(qty int) bool {
	return qty > 0 && qty <= 10000
}

func ValidateQuantityWithError(qty int) error {
	if qty <= 0 {
		return errors.New("quantity must be positive")
	}
	if qty > 10000 {
		return errors.New("quantity exceeds maximum allowed (10000)")
	}
	return nil
}

func ValidateProductName(name string) bool {
	return len(strings.TrimSpace(name)) > 0 && len(name) <= 200
}

func ValidateProductNameWithError(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("product name cannot be empty")
	}
	if len(name) > 200 {
		return errors.New("product name must be 200 characters or less")
	}
	return nil
}

func SanitizeSKU(sku string) string {
	return strings.ToUpper(strings.TrimSpace(sku))
}

func ValidateEmail(email string) bool {
	if strings.TrimSpace(email) == "" {
		return false
	}
	return emailPattern.MatchString(email)
}

func ValidateEmailWithError(email string) error {
	if strings.TrimSpace(email) == "" {
		return errors.New("email cannot be empty")
	}
	if !emailPattern.MatchString(email) {
		return errors.New("invalid email format")
	}
	if len(email) > 254 {
		return errors.New("email exceeds maximum length")
	}
	return nil
}

func ValidatePhone(phone string) bool {
	if strings.TrimSpace(phone) == "" {
		return false
	}
	return phonePattern.MatchString(phone)
}

func ValidatePhoneWithError(phone string) error {
	if strings.TrimSpace(phone) == "" {
		return errors.New("phone number cannot be empty")
	}
	if !phonePattern.MatchString(phone) {
		return errors.New("invalid phone number format")
	}
	return nil
}

func ValidateURL(url string) bool {
	if strings.TrimSpace(url) == "" {
		return false
	}
	return urlPattern.MatchString(url)
}

func ValidateURLWithError(url string) error {
	if strings.TrimSpace(url) == "" {
		return errors.New("URL cannot be empty")
	}
	if !urlPattern.MatchString(url) {
		return errors.New("invalid URL format")
	}
	return nil
}

func ValidatePrice(price float64) error {
	if price < 0 {
		return errors.New("price cannot be negative")
	}
	if price > 1000000 {
		return errors.New("price exceeds maximum allowed")
	}
	return nil
}

func ValidateCost(cost float64) error {
	if cost < 0 {
		return errors.New("cost cannot be negative")
	}
	if cost > 1000000 {
		return errors.New("cost exceeds maximum allowed")
	}
	return nil
}

func ValidateDimensions(length, width, height float64) error {
	if length <= 0 {
		return errors.New("length must be positive")
	}
	if width <= 0 {
		return errors.New("width must be positive")
	}
	if height <= 0 {
		return errors.New("height must be positive")
	}
	if length > 1000 || width > 1000 || height > 1000 {
		return errors.New("dimensions exceed maximum allowed")
	}
	return nil
}

func ValidateWeight(weight float64) error {
	if weight < 0 {
		return errors.New("weight cannot be negative")
	}
	if weight > 10000 {
		return errors.New("weight exceeds maximum allowed")
	}
	return nil
}

func ValidateStringLength(str string, min, max int) error {
	length := len(strings.TrimSpace(str))
	if length < min {
		return fmt.Errorf("string must be at least %d characters", min)
	}
	if length > max {
		return fmt.Errorf("string must be at most %d characters", max)
	}
	return nil
}

func ValidateNonEmptyString(str string) error {
	if strings.TrimSpace(str) == "" {
		return errors.New("string cannot be empty")
	}
	return nil
}

func ValidateAlphanumeric(str string) bool {
	return alphanumericPattern.MatchString(str)
}

func ValidateAlphanumericWithError(str string) error {
	if strings.TrimSpace(str) == "" {
		return errors.New("string cannot be empty")
	}
	if !alphanumericPattern.MatchString(str) {
		return errors.New("string must contain only alphanumeric characters")
	}
	return nil
}

func ValidateIntegerRange(value, min, max int) error {
	if value < min {
		return fmt.Errorf("value must be at least %d", min)
	}
	if value > max {
		return fmt.Errorf("value must be at most %d", max)
	}
	return nil
}

func ValidateFloatRange(value, min, max float64) error {
	if value < min {
		return fmt.Errorf("value must be at least %f", min)
	}
	if value > max {
		return fmt.Errorf("value must be at most %f", max)
	}
	return nil
}

func ValidateDateRange(start, end time.Time) error {
	if start.After(end) {
		return errors.New("start date must be before end date")
	}
	return nil
}

func ValidateFutureDate(date time.Time) error {
	if date.Before(time.Now()) {
		return errors.New("date must be in the future")
	}
	return nil
}

func ValidatePastDate(date time.Time) error {
	if date.After(time.Now()) {
		return errors.New("date must be in the past")
	}
	return nil
}

func ValidateReservationExpiry(expiresAt time.Time) error {
	if expiresAt.Before(time.Now()) {
		return errors.New("expiry date must be in the future")
	}
	maxExpiry := time.Now().Add(24 * time.Hour)
	if expiresAt.After(maxExpiry) {
		return errors.New("expiry date cannot be more than 24 hours in the future")
	}
	return nil
}

func ValidatePostalCode(postalCode, country string) error {
	if strings.TrimSpace(postalCode) == "" {
		return errors.New("postal code cannot be empty")
	}
	
	// Basic validation - can be extended for specific countries
	switch strings.ToUpper(country) {
	case "US":
		usPattern := regexp.MustCompile(`^\d{5}(-\d{4})?$`)
		if !usPattern.MatchString(postalCode) {
			return errors.New("invalid US postal code format")
		}
	case "CA":
		caPattern := regexp.MustCompile(`^[A-Z]\d[A-Z] ?\d[A-Z]\d$`)
		if !caPattern.MatchString(strings.ToUpper(postalCode)) {
			return errors.New("invalid Canadian postal code format")
		}
	case "UK":
		ukPattern := regexp.MustCompile(`^[A-Z]{1,2}\d{1,2}[A-Z]? ?\d[A-Z]{2}$`)
		if !ukPattern.MatchString(strings.ToUpper(postalCode)) {
			return errors.New("invalid UK postal code format")
		}
	}
	
	return nil
}

func ValidateCreditCard(cardNumber string) bool {
	cardNumber = strings.ReplaceAll(cardNumber, " ", "")
	cardNumber = strings.ReplaceAll(cardNumber, "-", "")
	
	if len(cardNumber) < 13 || len(cardNumber) > 19 {
		return false
	}
	
	sum := 0
	isEven := false
	
	for i := len(cardNumber) - 1; i >= 0; i-- {
		digit, err := strconv.Atoi(string(cardNumber[i]))
		if err != nil {
			return false
		}
		
		if isEven {
			digit *= 2
			if digit > 9 {
				digit -= 9
			}
		}
		
		sum += digit
		isEven = !isEven
	}
	
	return sum%10 == 0
}

func ValidateIPv4(ip string) bool {
	parts := strings.Split(ip, ".")
	if len(parts) != 4 {
		return false
	}
	
	for _, part := range parts {
		num, err := strconv.Atoi(part)
		if err != nil || num < 0 || num > 255 {
			return false
		}
	}
	return true
}

func ValidateIPv6(ip string) bool {
	ipv6Pattern := regexp.MustCompile(`^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$`)
	return ipv6Pattern.MatchString(ip)
}

func ValidateUUID(uuid string) bool {
	uuidPattern := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	return uuidPattern.MatchString(strings.ToLower(uuid))
}

func ValidateUUIDWithError(uuid string) error {
	if strings.TrimSpace(uuid) == "" {
		return errors.New("UUID cannot be empty")
	}
	if !ValidateUUID(uuid) {
		return errors.New("invalid UUID format")
	}
	return nil
}

func ValidatePassword(password string) *ValidationResult {
	result := NewValidationResult()
	
	if len(password) < 8 {
		result.AddError("password", "password must be at least 8 characters")
	}
	if len(password) > 128 {
		result.AddError("password", "password must be at most 128 characters")
	}
	
	hasUpper := false
	hasLower := false
	hasDigit := false
	hasSpecial := false
	
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}
	
	if !hasUpper {
		result.AddError("password", "password must contain at least one uppercase letter")
	}
	if !hasLower {
		result.AddError("password", "password must contain at least one lowercase letter")
	}
	if !hasDigit {
		result.AddError("password", "password must contain at least one digit")
	}
	if !hasSpecial {
		result.AddError("password", "password must contain at least one special character")
	}
	
	return result
}

func ValidateOrderStatus(status string) error {
	validStatuses := []string{"PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"}
	for _, vs := range validStatuses {
		if status == vs {
			return nil
		}
	}
	return fmt.Errorf("invalid order status: %s", status)
}

func ValidateReservationStatus(status string) error {
	validStatuses := []string{"PENDING", "RELEASED", "FULFILLED", "EXPIRED", "CANCELLED"}
	for _, vs := range validStatuses {
		if status == vs {
			return nil
		}
	}
	return fmt.Errorf("invalid reservation status: %s", status)
}

func ValidateStockMovementType(movementType string) error {
	validTypes := []string{
		"RECEIVE", "ADJUSTMENT", "SALE", "RETURN",
		"TRANSFER", "DAMAGE", "THEFT", "CYCLE_COUNT",
	}
	for _, vt := range validTypes {
		if movementType == vt {
			return nil
		}
	}
	return fmt.Errorf("invalid stock movement type: %s", movementType)
}

func ValidateCountryCode(code string) error {
	if len(code) != 2 {
		return errors.New("country code must be 2 characters")
	}
	if !ValidateAlphanumeric(strings.ToUpper(code)) {
		return errors.New("country code must be alphabetic")
	}
	return nil
}

func ValidateCurrencyCode(code string) error {
	if len(code) != 3 {
		return errors.New("currency code must be 3 characters")
	}
	if !ValidateAlphanumeric(strings.ToUpper(code)) {
		return errors.New("currency code must be alphabetic")
	}
	return nil
}

func ValidatePercentage(value float64) error {
	if value < 0 || value > 100 {
		return errors.New("percentage must be between 0 and 100")
	}
	return nil
}

func ValidatePositiveInteger(value int) error {
	if value <= 0 {
		return errors.New("value must be positive")
	}
	return nil
}

func ValidateNonNegativeInteger(value int) error {
	if value < 0 {
		return errors.New("value must be non-negative")
	}
	return nil
}

func ValidatePositiveFloat(value float64) error {
	if value <= 0 {
		return errors.New("value must be positive")
	}
	return nil
}

func ValidateNonNegativeFloat(value float64) error {
	if value < 0 {
		return errors.New("value must be non-negative")
	}
	return nil
}

func SanitizeString(str string) string {
	return strings.TrimSpace(str)
}

func SanitizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func SanitizePhone(phone string) string {
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	phone = strings.ReplaceAll(phone, "(", "")
	phone = strings.ReplaceAll(phone, ")", "")
	return phone
}

func ValidateAndSanitizeSKU(sku string) (string, error) {
	sanitized := SanitizeSKU(sku)
	if err := ValidateSKUWithError(sanitized); err != nil {
		return "", err
	}
	return sanitized, nil
}

func ValidateAndSanitizeEmail(email string) (string, error) {
	sanitized := SanitizeEmail(email)
	if err := ValidateEmailWithError(sanitized); err != nil {
		return "", err
	}
	return sanitized, nil
}

func ValidateMultipleSKUs(skus []string) *ValidationResult {
	result := NewValidationResult()
	for i, sku := range skus {
		if err := ValidateSKUWithError(sku); err != nil {
			result.AddError(fmt.Sprintf("sku[%d]", i), err.Error())
		}
	}
	return result
}

func ValidateMultipleQuantities(quantities []int) *ValidationResult {
	result := NewValidationResult()
	for i, qty := range quantities {
		if err := ValidateQuantityWithError(qty); err != nil {
			result.AddError(fmt.Sprintf("quantity[%d]", i), err.Error())
		}
	}
	return result
}

func ValidateAddress(address map[string]string) *ValidationResult {
	result := NewValidationResult()
	
	if err := ValidateNonEmptyString(address["street1"]); err != nil {
		result.AddError("street1", err.Error())
	}
	if err := ValidateNonEmptyString(address["city"]); err != nil {
		result.AddError("city", err.Error())
	}
	if err := ValidateNonEmptyString(address["country"]); err != nil {
		result.AddError("country", err.Error())
	}
	if err := ValidateCountryCode(address["country"]); err != nil {
		result.AddError("country", err.Error())
	}
	
	return result
}

func ValidateTimeRange(start, end time.Time, minDuration, maxDuration time.Duration) error {
	if start.After(end) {
		return errors.New("start time must be before end time")
	}
	duration := end.Sub(start)
	if duration < minDuration {
		return fmt.Errorf("duration must be at least %v", minDuration)
	}
	if duration > maxDuration {
		return fmt.Errorf("duration must be at most %v", maxDuration)
	}
	return nil
}

func ValidateRegex(pattern, value string) bool {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return false
	}
	return re.MatchString(value)
}

func ValidateRegexWithError(pattern, value string) error {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return fmt.Errorf("invalid regex pattern: %w", err)
	}
	if !re.MatchString(value) {
		return fmt.Errorf("value does not match pattern: %s", pattern)
	}
	return nil
}

func ValidateInList(value string, allowedValues []string) error {
	for _, allowed := range allowedValues {
		if value == allowed {
			return nil
		}
	}
	return fmt.Errorf("value '%s' is not in allowed list", value)
}

func ValidateNotInList(value string, disallowedValues []string) error {
	for _, disallowed := range disallowedValues {
		if value == disallowed {
			return fmt.Errorf("value '%s' is in disallowed list", value)
		}
	}
	return nil
}

func ValidateStringContains(str, substr string) error {
	if !strings.Contains(str, substr) {
		return fmt.Errorf("string must contain '%s'", substr)
	}
	return nil
}

func ValidateStringStartsWith(str, prefix string) error {
	if !strings.HasPrefix(str, prefix) {
		return fmt.Errorf("string must start with '%s'", prefix)
	}
	return nil
}

func ValidateStringEndsWith(str, suffix string) error {
	if !strings.HasSuffix(str, suffix) {
		return fmt.Errorf("string must end with '%s'", suffix)
	}
	return nil
}

func ValidateArrayLength(arr []interface{}, min, max int) error {
	length := len(arr)
	if length < min {
		return fmt.Errorf("array must have at least %d elements", min)
	}
	if length > max {
		return fmt.Errorf("array must have at most %d elements", max)
	}
	return nil
}

func ValidateMapKeys(m map[string]interface{}, requiredKeys []string) *ValidationResult {
	result := NewValidationResult()
	for _, key := range requiredKeys {
		if _, exists := m[key]; !exists {
			result.AddError(key, fmt.Sprintf("required key '%s' is missing", key))
		}
	}
	return result
}

func ValidateNumericString(str string) bool {
	_, err := strconv.Atoi(str)
	return err == nil
}

func ValidateNumericStringWithError(str string) error {
	if strings.TrimSpace(str) == "" {
		return errors.New("string cannot be empty")
	}
	if _, err := strconv.Atoi(str); err != nil {
		return errors.New("string must be numeric")
	}
	return nil
}

func ValidateFloatString(str string) bool {
	_, err := strconv.ParseFloat(str, 64)
	return err == nil
}

func ValidateFloatStringWithError(str string) error {
	if strings.TrimSpace(str) == "" {
		return errors.New("string cannot be empty")
	}
	if _, err := strconv.ParseFloat(str, 64); err != nil {
		return errors.New("string must be a valid float")
	}
	return nil
}

func ValidateHexColor(color string) bool {
	hexPattern := regexp.MustCompile(`^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`)
	return hexPattern.MatchString(color)
}

func ValidateBase64(str string) bool {
	base64Pattern := regexp.MustCompile(`^[A-Za-z0-9+/]*={0,2}$`)
	if !base64Pattern.MatchString(str) {
		return false
	}
	return len(str)%4 == 0
}

func ValidateJSON(str string) bool {
	var js interface{}
	return json.Unmarshal([]byte(str), &js) == nil
}

func ValidateJSONWithError(str string) error {
	var js interface{}
	if err := json.Unmarshal([]byte(str), &js); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	return nil
}

func ValidateTimeFormat(str, format string) error {
	_, err := time.Parse(format, str)
	if err != nil {
		return fmt.Errorf("invalid time format: %w", err)
	}
	return nil
}

func ValidateDate(str string) error {
	formats := []string{
		time.RFC3339,
		"2006-01-02",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	}
	for _, format := range formats {
		if _, err := time.Parse(format, str); err == nil {
			return nil
		}
	}
	return errors.New("invalid date format")
}
