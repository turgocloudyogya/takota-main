package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Generate hash untuk password "admin123"
	adminHash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	fmt.Printf("admin123 hash: %s\n", adminHash)

	// Generate hash untuk password "user123"
	userHash, err := bcrypt.GenerateFromPassword([]byte("user123"), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	fmt.Printf("user123 hash: %s\n", userHash)
}
