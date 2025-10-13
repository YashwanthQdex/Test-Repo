package main

import (
	"fmt"
	"handlers"
)

func main() {
	fmt.Println("Starting application...")
	h := handlers.NewHandler()
	h.HandleRequest("test data")

	// This function is repeated in multiple files
	result := ProcessData("main input")
	fmt.Println("Main result:", result)
}

func GetVersion() string {
	// This function is called from config package, creating circular dependency
	return "1.0.0"
}

func ProcessData(input string) string {
	// This function is duplicated across multiple files
	return fmt.Sprintf("Processed by main: %s", input)
}
