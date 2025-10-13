package main

import (
	"fmt"
	"log"
	"net/http"
	"time"
)

// This is the main entry point for the Go application
func main() {
	fmt.Println("Starting Go application...")

	// Initialize server
	server := &http.Server{
		Addr:         ":8080",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Setup routes
	http.HandleFunc("/", homeHandler)
	http.HandleFunc("/health", healthHandler)

	// Start server
	fmt.Println("Server starting on port 8080")
	log.Fatal(server.ListenAndServe())
}

// homeHandler handles the root route
func homeHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello, World!")
}

// healthHandler handles health check requests
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}

// Utility function 1
func printMessage(msg string) {
	fmt.Println(msg)
}

// Utility function 2
func getCurrentTime() time.Time {
	return time.Now()
}

// Utility function 3
func calculateSum(a, b int) int {
	return a + b
}

// Utility function 4
func isEven(num int) bool {
	return num%2 == 0
}

// Utility function 5
func reverseString(s string) string {
	runes := []rune(s)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	return string(runes)
}

// Utility function 6
func factorial(n int) int {
	if n <= 1 {
		return 1
	}
	return n * factorial(n-1)
}

// Utility function 7
func fibonacci(n int) int {
	if n <= 1 {
		return n
	}
	return fibonacci(n-1) + fibonacci(n-2)
}

// Utility function 8
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// Utility function 9
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Utility function 10
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// Comment line 51
// Comment line 52
// Comment line 53
// Comment line 54
// Comment line 55
// Comment line 56
// Comment line 57
// Comment line 58
// Comment line 59
// Comment line 60
// Comment line 61
// Comment line 62
// Comment line 63
// Comment line 64
// Comment line 65
// Comment line 66
// Comment line 67
// Comment line 68
// Comment line 69
// Comment line 70
// Comment line 71
// Comment line 72
// Comment line 73
// Comment line 74
// Comment line 75
// Comment line 76
// Comment line 77
// Comment line 78
// Comment line 79
// Comment line 80
// Comment line 81
// Comment line 82
// Comment line 83
// Comment line 84
// Comment line 85
// Comment line 86
// Comment line 87
// Comment line 88
// Comment line 89
// Comment line 90
// Comment line 91
// Comment line 92
// Comment line 93
// Comment line 94
// Comment line 95
// Comment line 96
// Comment line 97
// Comment line 98
// Comment line 99
// Comment line 100
