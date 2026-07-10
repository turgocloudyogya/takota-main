package utils

import (
	"fmt"
	"math"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(bytes), err
}

// CheckPasswordHash compares a password with a hash
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GetGreetingTime returns greeting based on server time
func GetGreetingTime() string {
	hour := time.Now().Hour()
	
	if hour >= 5 && hour < 12 {
		return "morning"
	} else if hour >= 12 && hour < 17 {
		return "afternoon"
	} else if hour >= 17 && hour < 21 {
		return "evening"
	}
	return "night"
}

// GetGreetingTitle returns greeting title with emoji
func GetGreetingTitle(name string) string {
	timeOfDay := GetGreetingTime()
	var greeting string
	
	switch timeOfDay {
	case "morning":
		greeting = "Good Morning"
	case "afternoon":
		greeting = "Good Afternoon"
	case "evening":
		greeting = "Good Evening"
	case "night":
		greeting = "Good Night"
	default:
		greeting = "Hello"
	}
	
	return fmt.Sprintf("%s, %s 👋", greeting, name)
}

// CalculateDistance calculates distance between two coordinates using Haversine formula
func CalculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000 // meters

	// Convert to radians
	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	deltaLat := (lat2 - lat1) * math.Pi / 180
	deltaLon := (lon2 - lon1) * math.Pi / 180

	// Haversine formula
	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
		math.Sin(deltaLon/2)*math.Sin(deltaLon/2)
	
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}

// GenerateGoogleMapsEmbed generates Google Maps embed URL
func GenerateGoogleMapsEmbed(latitude, longitude string) string {
	return fmt.Sprintf("https://maps.google.com/maps?q=%s,%s&z=15&output=embed", latitude, longitude)
}

// ParseFloat64 safely parses string to float64
func ParseFloat64(s string) (float64, error) {
	var f float64
	_, err := fmt.Sscanf(s, "%f", &f)
	return f, err
}

// GetMonthNumber returns month number from month name
func GetMonthNumber(monthName string) int {
	months := map[string]int{
		"january": 1, "jan": 1,
		"february": 2, "feb": 2,
		"march": 3, "mar": 3,
		"april": 4, "apr": 4,
		"may": 5,
		"june": 6, "jun": 6,
		"july": 7, "jul": 7,
		"august": 8, "aug": 8,
		"september": 9, "sep": 9,
		"october": 10, "oct": 10,
		"november": 11, "nov": 11,
		"december": 12, "dec": 12,
	}
	
	if month, ok := months[monthName]; ok {
		return month
	}
	return 0
}
