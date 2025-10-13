package service

import (
	"fmt"
	"models"
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

func (s *Service) ProcessUser(user *models.User) {
	fmt.Println("Processing user:", user.Name)

	// Validate user
	err := user.Validate()
	if err != nil {
		fmt.Println("Validation error:", err)
		return
	}

	// Use utils functions
	if !utils.ValidateEmail(user.Name + "@example.com") {
		fmt.Println("Invalid email format")
	}

	// Call a method that might not exist
	s.saveUser(user)

	fmt.Println("User processed successfully")
}

func (s *Service) saveUser(user *models.User) {
	// This method calls a function from config that may not be properly accessible
	dbURL := s.config.DatabaseURL
	fmt.Println("Saving user to database:", dbURL)

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
