package main

func Helper() string { return "helper" }

// CRITICAL: Panic
func dangerous() { panic("fail") }

// MEDIUM: Unused variable
var x = 10

// LOW: Unused function
func y() {}
