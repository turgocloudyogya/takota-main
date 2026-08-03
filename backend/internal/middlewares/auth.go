package middlewares

import (
	"context"
	"net/http"
	"strings"

	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	jwtpkg "github.com/carakan/takota/pkg/jwt"
	"github.com/carakan/takota/pkg/redis"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AuthMiddleware validates JWT token
func AuthMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			utils.RespondError(c, http.StatusUnauthorized, "Need Authorization", utils.ErrHeaderAuthReq)
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		tokenString := jwtpkg.ExtractTokenFromHeader(authHeader)
		if tokenString == "" {
			utils.RespondError(c, http.StatusUnauthorized, "JWT not valid", utils.ErrTokenInvalid)
			c.Abort()
			return
		}

		// Validate token
		claims, err := jwtpkg.ValidateToken(tokenString)
		if err != nil {
			if strings.Contains(err.Error(), "expired") {
				utils.RespondError(c, http.StatusUnauthorized, "JWT expired, please try login", utils.ErrTokenExpired)
			} else {
				utils.RespondError(c, http.StatusUnauthorized, "JWT not valid", utils.ErrTokenInvalid)
			}
			c.Abort()
			return
		}

		// Validate auth_id
		ctx := context.Background()
		isValid := false

		// Try Redis first if enabled
		if redis.Enabled {
			valid, err := redis.ValidateAuthID(ctx, claims.UserID, claims.AuthID)
			if err == nil {
				isValid = valid
			} else {
				// Fallback to database
				isValid = validateAuthIDFromDB(db, claims.UserID, claims.AuthID)
			}
		} else {
			// Use database directly
			isValid = validateAuthIDFromDB(db, claims.UserID, claims.AuthID)
		}

		if !isValid {
			utils.RespondError(c, http.StatusUnauthorized, "JWT not valid", utils.ErrTokenInvalid)
			c.Abort()
			return
		}

		// Set user info in context
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("user_type", claims.Type)
		c.Set("change_as_login", claims.ChangeAsLogin)
		c.Set("auth_id", claims.AuthID)

		c.Next()
	}
}

// validateAuthIDFromDB validates auth_id from database
func validateAuthIDFromDB(db *gorm.DB, userID string, authID string) bool {
	var user models.User
	uid, err := uuid.Parse(userID)
	if err != nil {
		return false
	}

	if err := db.Where("id = ?", uid).First(&user).Error; err != nil {
		return false
	}

	if user.AuthID == nil {
		return false
	}

	return *user.AuthID == authID
}

// RequireRole middleware ensures user has specific role
func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userType, exists := c.Get("user_type")
		if !exists {
			utils.RespondError(c, http.StatusForbidden, "Access denied", utils.ErrOnlyAdmin)
			c.Abort()
			return
		}

		if userType.(string) != role {
			if role == "admin" {
				utils.RespondError(c, http.StatusForbidden, "Only admin can here!", utils.ErrOnlyAdmin)
			} else {
				utils.RespondError(c, http.StatusForbidden, "Only user can here!", utils.ErrOnlyUser)
			}
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequirePasswordChanged middleware blocks access if user hasn't changed password.
// It checks the database value (not just JWT claims) so admin changes take effect immediately.
func RequirePasswordChanged(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		changeAsLogin, exists := c.Get("change_as_login")
		if !exists {
			c.Next()
			return
		}

		// If JWT says no password change needed, trust it (fast path)
		if !changeAsLogin.(bool) {
			c.Next()
			return
		}

		// JWT says password change needed - verify against database in case
		// admin has since unchecked the flag via edit user
		userID, _ := c.Get("user_id")
		if uid, ok := userID.(string); ok {
			var user models.User
			if parsedUID, err := uuid.Parse(uid); err == nil {
				if db.Where("id = ?", parsedUID).First(&user).Error == nil {
					// Database is the source of truth - if admin unchecked it, allow access
					if !user.ChangeAsLogin {
						// Update the context value so downstream handlers see the corrected value
						c.Set("change_as_login", false)
						c.Next()
						return
					}
				}
			}
		}

		utils.RespondError(c, http.StatusForbidden, "Please change your password first", "CHANGE_PASSWORD_REQUIRED")
		c.Abort()
	}
}

// KeyRequestMiddleware validates Key-Request header
func KeyRequestMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		keyRequest := c.GetHeader("Key-Request")
		if keyRequest == "" {
			keyRequest = "unknown"
		}
		c.Set("key_request", keyRequest)
		c.Next()
	}
}
