package config

import (
	"fmt"
	"main" // This creates a circular dependency: main imports handlers, handlers imports service, service imports utils, utils imports config, config imports main
)

type Config struct {
	DatabaseURL string
	Port        int
	Debug       bool
}

var globalConfig *Config

func init() {
	globalConfig = &Config{
		DatabaseURL: "postgres://localhost/db",
		Port:        8080,
		Debug:       true,
	}
}

func LoadConfig() *Config {
	// This function is called from utils
	fmt.Println("Loading configuration...")

	// Call a function from main package - this creates circular dependency
	appVersion := main.GetVersion() // This function doesn't exist in main package yet
	fmt.Println("App version:", appVersion)

	return globalConfig
}

func GetConfigValue(key string) string {
	// This function is called from handlers but implemented here
	switch key {
	case "database_url":
		return globalConfig.DatabaseURL
	case "port":
		return fmt.Sprintf("%d", globalConfig.Port)
	default:
		return "default_value"
	}
}

func ProcessData(input string) string {
	// This function is duplicated across multiple files
	return fmt.Sprintf("Processed by config: %s", input)
}
