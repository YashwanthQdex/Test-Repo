package main

func Helper() string { return "helper" }

// CRITICAL: Panic
func dangerous() { panic("fail") }

// MEDIUM: Unused variable
// var x = 10 // DISABLED: Unused variable

// LOW: Unused function
// func y() {} // DISABLED: Unused function