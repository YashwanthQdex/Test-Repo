package models

import (
	"fmt"
	"types"
)

type User struct {
	Name string
	Age  int
}

func NewUser(name string, age int) *User {
	return &User{
		Name: name,
		Age:  age,
	}
}

func (u *User) Validate() error {
	// Use a type from types package
	userType := types.GetUserType(u.Age)
	fmt.Println("User type:", userType)

	// Call a function that might not exist
	u.processValidation()

	return nil
}

func (u *User) processValidation() {
	// This will create a dependency issue - calling utils function without proper import
	validated := ValidateUserData(u.Name) // This function doesn't exist in this package
	fmt.Println("User validated:", validated)
}

func ValidateUserData(name string) bool {
	// This function should be in utils but is duplicated here
	return len(name) > 0
}

func ProcessData(input string) string {
	// This function is duplicated across multiple files
	return fmt.Sprintf("Processed by models: %s", input)
}
