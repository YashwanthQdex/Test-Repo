package handlers

import (
	"fmt"
	"models"
	"service"
)

type Handler struct {
	service *service.Service
}

func NewHandler() *Handler {
	return &Handler{
		service: service.NewService(),
	}
}

func (h *Handler) HandleRequest(data string) {
	fmt.Println("Handling request:", data)

	// Create a model and use service
	user := models.NewUser("John", 30)
	h.service.ProcessUser(user)

	// Call a function that depends on types from other files
	h.processInternal(data)

	// This function is repeated in multiple files
	result := ProcessData("handler input")
	fmt.Println("Handler result:", result)
}

func (h *Handler) processInternal(data string) {
	// This function will have dependency issues
	configValue := GetConfigValue() // This function doesn't exist in this package
	fmt.Println("Config value:", configValue)
}

func GetConfigValue() string {
	// This function should be in config package but is duplicated here
	return "handler config"
}

func ProcessData(input string) string {
	// This function is duplicated across multiple files
	return fmt.Sprintf("Processed by handler: %s", input)
}
