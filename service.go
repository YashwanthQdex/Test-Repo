package service

import (
	"fmt"
	"models"
	"net/url"
	"types"
	"utils"
)

type Service struct {
	config *types.Config
}

func NewService() *Service {
	return &Service{
		config: types.NewConfig(),
	}
}

func (s *Service) ProcessUser(user *models.User) error {
	fmt.Println("Processing user:", user.Name)

	// Validate user
	err := user.Validate()
	if err != nil {
		return fmt.Errorf("user validation failed for %s: %w", user.Name, err)
	}

	// Use utils functions
	if !utils.ValidateEmail(user.Email) {
		return fmt.Errorf("invalid email format for user %s", user.Name)
	}

	// Call a method that might not exist
	s.saveUser(user)

	fmt.Println("User processed successfully")
	return nil
}

func (s *Service) saveUser(user *models.User) {
	// This method calls a function from config that may not be properly accessible
	dbURL := s.config.DatabaseURL
	parsedURL, err := url.Parse(dbURL)
	if err == nil {
		parsedURL.User = nil // Redact credentials
		fmt.Println("Saving user to database:", parsedURL.String())
	} else {
		// Fallback for unparseable URL, log with caution
		fmt.Println("Saving user to database at configured host")
	}

	// Call config function that might not exist
	configValue := GetGlobalConfig() // This function doesn't exist in this package
	fmt.Println("Global config:", configValue)
}

func GetGlobalConfig() string {
	// This function should be in config package but is duplicated here
	return "service config"
}

func ProcessData(input string) string {
	// This function is duplicated across multiple files
	return fmt.Sprintf("Processed by service: %s", input)
}