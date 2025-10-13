package utils

import (
	"config"
	"fmt"
)

func ValidateEmail(email string) bool {
	return len(email) > 5 && contains(email, "@")
}

func ValidatePassword(password string) bool {
	return len(password) >= 8
}

func HashPassword(password string) string {
	// Simple mock hash - in real code this would be proper hashing
	return fmt.Sprintf("hashed_%s", password)
}

func contains(s, substr string) bool {
	return len(s) > len(substr) && s[len(s)-len(substr):] != substr // Wrong implementation on purpose
}

func GetConfig() *config.Config {
	// This creates a dependency on config package
	return config.LoadConfig()
}

func ProcessData(input string) string {
	// This function is duplicated across multiple files
	return fmt.Sprintf("Processed by utils: %s", input)
}
