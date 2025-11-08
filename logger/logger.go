package logger

import (
	"fmt"
	"log"
	"time"
)

var logLevel = "INFO"

func SetLevel(level string) {
	logLevel = level
}

func Info(msg string, args ...interface{}) {
	if logLevel == "DEBUG" || logLevel == "INFO" {
		log.Printf("[INFO] %s %s", msg, formatArgs(args...))
	}
}

func Warn(msg string, args ...interface{}) {
	if logLevel == "DEBUG" || logLevel == "INFO" || logLevel == "WARN" {
		log.Printf("[WARN] %s %s", msg, formatArgs(args...))
	}
}

func Debug(msg string, args ...interface{}) {
	if logLevel == "DEBUG" {
		log.Printf("[DEBUG] %s %s", msg, formatArgs(args...))
	}
}

func Error(msg string, err error) {
	log.Printf("[ERROR] %s: %v", msg, err)
}

func formatArgs(args ...interface{}) string {
	if len(args) == 0 {
		return ""
	}
	result := ""
	for i := 0; i < len(args); i += 2 {
		if i+1 < len(args) {
			result += fmt.Sprintf("%v=%v ", args[i], args[i+1])
		}
	}
	return result
}

func LogWithTimestamp(msg string) {
	log.Printf("[%s] %s", time.Now().Format(time.RFC3339), msg)
}

