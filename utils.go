package main

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// StringUtils contains string utility functions
type StringUtils struct{}

// ToUpper converts string to uppercase
func (s StringUtils) ToUpper(str string) string {
	return strings.ToUpper(str)
}

// ToLower converts string to lowercase
func (s StringUtils) ToLower(str string) string {
	return strings.ToLower(str)
}

// Trim removes whitespace from both ends
func (s StringUtils) Trim(str string) string {
	return strings.TrimSpace(str)
}

// Contains checks if substring exists
func (s StringUtils) Contains(str, substr string) bool {
	return strings.Contains(str, substr)
}

// Replace replaces occurrences of old with new
func (s StringUtils) Replace(str, old, new string) string {
	return strings.ReplaceAll(str, old, new)
}

// MathUtils contains mathematical utility functions
type MathUtils struct{}

// Power calculates base^exponent
func (m MathUtils) Power(base, exp float64) float64 {
	return math.Pow(base, exp)
}

// SquareRoot calculates square root
func (m MathUtils) SquareRoot(x float64) float64 {
	return math.Sqrt(x)
}

// Round rounds to nearest integer
func (m MathUtils) Round(x float64) float64 {
	return math.Round(x)
}

// Floor returns the greatest integer less than or equal to x
func (m MathUtils) Floor(x float64) float64 {
	return math.Floor(x)
}

// Ceil returns the smallest integer greater than or equal to x
func (m MathUtils) Ceil(x float64) float64 {
	return math.Ceil(x)
}

// TimeUtils contains time utility functions
type TimeUtils struct{}

// FormatTime formats time to string
func (t TimeUtils) FormatTime(tm time.Time, layout string) string {
	return tm.Format(layout)
}

// ParseTime parses string to time
func (t TimeUtils) ParseTime(layout, value string) (time.Time, error) {
	return time.Parse(layout, value)
}

// AddDays adds days to time
func (t TimeUtils) AddDays(tm time.Time, days int) time.Time {
	return tm.AddDate(0, 0, days)
}

// AddHours adds hours to time
func (t TimeUtils) AddHours(tm time.Time, hours int) time.Time {
	return tm.Add(time.Duration(hours) * time.Hour)
}

// IsWeekend checks if time is weekend
func (t TimeUtils) IsWeekend(tm time.Time) bool {
	weekday := tm.Weekday()
	return weekday == time.Saturday || weekday == time.Sunday
}

// ValidationUtils contains validation utility functions
type ValidationUtils struct{}

// IsEmail validates email format
func (v ValidationUtils) IsEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// IsPhone validates phone number format
func (v ValidationUtils) IsPhone(phone string) bool {
	phoneRegex := regexp.MustCompile(`^\+?[1-9]\d{1,14}$`)
	return phoneRegex.MatchString(phone)
}

// IsNumeric checks if string is numeric
func (v ValidationUtils) IsNumeric(str string) bool {
	_, err := strconv.Atoi(str)
	return err == nil
}

// IsAlpha checks if string contains only letters
func (v ValidationUtils) IsAlpha(str string) bool {
	alphaRegex := regexp.MustCompile(`^[a-zA-Z]+$`)
	return alphaRegex.MatchString(str)
}

// HashUtils contains hashing utility functions
type HashUtils struct{}

// MD5Hash generates MD5 hash of string
func (h HashUtils) MD5Hash(str string) string {
	hasher := md5.New()
	hasher.Write([]byte(str))
	return hex.EncodeToString(hasher.Sum(nil))
}

// SliceUtils contains slice utility functions
type SliceUtils struct{}

// ContainsInt checks if slice contains integer
func (s SliceUtils) ContainsInt(slice []int, item int) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}

// ContainsString checks if slice contains string
func (s SliceUtils) ContainsString(slice []string, item string) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}

// RemoveDuplicatesInt removes duplicates from int slice
func (s SliceUtils) RemoveDuplicatesInt(slice []int) []int {
	keys := make(map[int]bool)
	var result []int
	for _, item := range slice {
		if !keys[item] {
			keys[item] = true
			result = append(result, item)
		}
	}
	return result
}

// RemoveDuplicatesString removes duplicates from string slice
func (s SliceUtils) RemoveDuplicatesString(slice []string) []string {
	keys := make(map[string]bool)
	var result []string
	for _, item := range slice {
		if !keys[item] {
			keys[item] = true
			result = append(result, item)
		}
	}
	return result
}

// ReverseInt reverses int slice
func (s SliceUtils) ReverseInt(slice []int) []int {
	for i, j := 0, len(slice)-1; i < j; i, j = i+1, j-1 {
		slice[i], slice[j] = slice[j], slice[i]
	}
	return slice
}

// ReverseString reverses string slice
func (s SliceUtils) ReverseString(slice []string) []string {
	for i, j := 0, len(slice)-1; i < j; i, j = i+1, j-1 {
		slice[i], slice[j] = slice[j], slice[i]
	}
	return slice
}

// Line 101 - Comment
// Line 102 - Comment
// Line 103 - Comment
// Line 104 - Comment
// Line 105 - Comment
// Line 106 - Comment
// Line 107 - Comment
// Line 108 - Comment
// Line 109 - Comment
// Line 110 - Comment
// Line 111 - Comment
// Line 112 - Comment
// Line 113 - Comment
// Line 114 - Comment
// Line 115 - Comment
// Line 116 - Comment
// Line 117 - Comment
// Line 118 - Comment
// Line 119 - Comment
// Line 120 - Comment
// Line 121 - Comment
// Line 122 - Comment
// Line 123 - Comment
// Line 124 - Comment
// Line 125 - Comment
// Line 126 - Comment
// Line 127 - Comment
// Line 128 - Comment
// Line 129 - Comment
// Line 130 - Comment
// Line 131 - Comment
// Line 132 - Comment
// Line 133 - Comment
// Line 134 - Comment
// Line 135 - Comment
// Line 136 - Comment
// Line 137 - Comment
// Line 138 - Comment
// Line 139 - Comment
// Line 140 - Comment
// Line 141 - Comment
// Line 142 - Comment
// Line 143 - Comment
// Line 144 - Comment
// Line 145 - Comment
// Line 146 - Comment
// Line 147 - Comment
// Line 148 - Comment
// Line 149 - Comment
// Line 150 - Comment
// Line 151 - Comment
// Line 152 - Comment
// Line 153 - Comment
// Line 154 - Comment
// Line 155 - Comment
// Line 156 - Comment
// Line 157 - Comment
// Line 158 - Comment
// Line 159 - Comment
// Line 160 - Comment
// Line 161 - Comment
// Line 162 - Comment
// Line 163 - Comment
// Line 164 - Comment
// Line 165 - Comment
// Line 166 - Comment
// Line 167 - Comment
// Line 168 - Comment
// Line 169 - Comment
// Line 170 - Comment
// Line 171 - Comment
// Line 172 - Comment
// Line 173 - Comment
// Line 174 - Comment
// Line 175 - Comment
// Line 176 - Comment
// Line 177 - Comment
// Line 178 - Comment
// Line 179 - Comment
// Line 180 - Comment
// Line 181 - Comment
// Line 182 - Comment
// Line 183 - Comment
// Line 184 - Comment
// Line 185 - Comment
// Line 186 - Comment
// Line 187 - Comment
// Line 188 - Comment
// Line 189 - Comment
// Line 190 - Comment
// Line 191 - Comment
// Line 192 - Comment
// Line 193 - Comment
// Line 194 - Comment
// Line 195 - Comment
// Line 196 - Comment
// Line 197 - Comment
// Line 198 - Comment
// Line 199 - Comment
// Line 200 - Comment
