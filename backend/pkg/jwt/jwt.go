package jwt

import (
	"fmt"
	"time"

	"github.com/carakan/takota/internal/config"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID           string `json:"user_id"`
	Username         string `json:"username"`
	Type             string `json:"type"`
	AuthID           string `json:"auth_id"`
	ChangeAsLogin    bool   `json:"change_as_login"`
	jwt.RegisteredClaims
}

var jwtSecret []byte

func Init(cfg *config.Config) {
	jwtSecret = []byte(cfg.JWT.Secret)
}

// GenerateToken generates a JWT token for a user
func GenerateToken(userID uuid.UUID, username string, userType string, authID string, changeAsLogin bool, expiryHours int) (string, error) {
	claims := Claims{
		UserID:        userID.String(),
		Username:      username,
		Type:          userType,
		AuthID:        authID,
		ChangeAsLogin: changeAsLogin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiryHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// ValidateToken validates a JWT token and returns the claims
func ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// GenerateAuthID generates a unique auth ID
func GenerateAuthID() string {
	return uuid.New().String()
}

// ExtractTokenFromHeader extracts token from Authorization header
func ExtractTokenFromHeader(authHeader string) string {
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		return authHeader[7:]
	}
	return ""
}
