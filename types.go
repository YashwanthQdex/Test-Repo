package types

import (
	"fmt"
)

type UserType string

const (
	Adult UserType = "adult"
	Teen  UserType = "teen"
	Child UserType = "child"
)

func GetUserType(age int) UserType {
	if age >= 18 {
		return Adult
	} else if age >= 13 {
		return Teen
	}
	return Child
}

type Config struct {
	DatabaseURL string
	Port        int
}

func NewConfig() *Config {
	return &Config{
		DatabaseURL: "localhost:5432",
		Port:        8080,
	}
}

func (c *Config) LoadFromEnv() {
	// This will call a function from utils that may not be properly imported
	envValue := GetEnvValue("DATABASE_URL") // This function doesn't exist in this package
	if envValue != "" {
		c.DatabaseURL = envValue
	}
}

func GetEnvValue(key string) string {
	// This function should be in utils but is duplicated here
	// In a real scenario, this would use os.Getenv
	return fmt.Sprintf("mock_%s_value", key)
}

func ProcessData(input string) string {
	// This function is duplicated across multiple files
	return fmt.Sprintf("Processed by types: %s", input)
}
