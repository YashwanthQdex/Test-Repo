package validator

import (
	"regexp"
	"strings"
)

var skuPattern = regexp.MustCompile(`^SKU-[A-Z0-9-]+$`)

func ValidateSKU(sku string) bool {
	if strings.TrimSpace(sku) == "" {
		return false
	}
	return skuPattern.MatchString(sku)
}

func ValidateQuantity(qty int) bool {
	return qty > 0 && qty <= 10000 // Max reasonable quantity
}

func ValidateProductName(name string) bool {
	return len(strings.TrimSpace(name)) > 0 && len(name) <= 200
}

func SanitizeSKU(sku string) string {
	return strings.ToUpper(strings.TrimSpace(sku))
}

