package controllers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/carakan/takota/internal/config"
	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	jwtpkg "github.com/carakan/takota/pkg/jwt"
	"github.com/carakan/takota/pkg/redis"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthController struct {
	DB     *gorm.DB
	Config *config.Config
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token    string `json:"token"`
	LoginAs  string `json:"login_as"`
	Redirect string `json:"redirect"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required"`
	RepeatPassword  string `json:"repeat_password" binding:"required"`
}

// Login handles user authentication
func (ctrl *AuthController) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Fill all input", utils.ErrBodyFillAll)
		return
	}

	ctx := context.Background()

	// Check if account is locked
	if redis.Enabled {
		isLocked, err := redis.IsAccountLocked(ctx, req.Username)
		if err == nil && isLocked {
			utils.RespondError(c, http.StatusBadRequest, 
				"Your account has been locked for 5 minutes. Please try again later", 
				utils.ErrUserLockLogin)
			return
		}
	}

	// Find user
	var user models.User
	if err := ctrl.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			utils.RespondError(c, http.StatusBadRequest, "User not found", utils.ErrUserNotFound)
			return
		}
		utils.RespondError(c, http.StatusInternalServerError, "Database error", "DB_ERROR")
		return
	}

	// Check password
	if !utils.CheckPasswordHash(req.Password, user.Password) {
		// Increment login attempts
		if redis.Enabled {
			attempts, err := redis.IncrementLoginAttempts(ctx, req.Username)
			if err == nil {
				remaining := ctrl.Config.App.MaxLoginAttempts - attempts
				if remaining <= 0 {
					// Lock account
					lockDuration := time.Duration(ctrl.Config.App.LoginLockDurationMinutes) * time.Minute
					redis.LockAccount(ctx, req.Username, lockDuration)
					utils.RespondError(c, http.StatusBadRequest, 
						"Your account has been locked for 5 minutes. Please try again later", 
						utils.ErrUserLockLogin)
					return
				}
				utils.RespondError(c, http.StatusBadRequest, 
					fmt.Sprintf("Incorrect password, you have %d more attempts left", remaining), 
					utils.ErrUserTryAgain)
				return
			}
		}
		utils.RespondError(c, http.StatusBadRequest, "Incorrect password", utils.ErrUserTryAgain)
		return
	}

	// Reset login attempts on successful login
	if redis.Enabled {
		redis.ResetLoginAttempts(ctx, req.Username)
	}

	// Generate new auth_id
	authID := jwtpkg.GenerateAuthID()
	user.AuthID = &authID
	user.LastLogin = &time.Time{}
	*user.LastLogin = time.Now().UTC()

	// Update user in database
	if err := ctrl.DB.Save(&user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to update user", "DB_ERROR")
		return
	}

	// Store auth_id in Redis if enabled
	if redis.Enabled {
		expiry := time.Duration(ctrl.Config.JWT.ExpiryHours) * time.Hour
		redis.SetAuthID(ctx, user.ID.String(), authID, expiry)
	}

	// Generate JWT token
	token, err := jwtpkg.GenerateToken(
		user.ID,
		user.Username,
		user.Type,
		authID,
		user.ChangeAsLogin,
		ctrl.Config.JWT.ExpiryHours,
	)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate token", "TOKEN_ERROR")
		return
	}

	// Determine redirect
	redirect := "/main"
	if user.Type == "admin" {
		redirect = "/dash"
	}
	if user.ChangeAsLogin {
		redirect = "/chpw"
	}

	utils.RespondSuccess(c, http.StatusOK, LoginResponse{
		Token:    token,
		LoginAs:  user.Type,
		Redirect: redirect,
	})
}

// ChangePassword handles password change
func (ctrl *AuthController) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Fill all input", utils.ErrBodyFillAll)
		return
	}

	// Check if passwords match
	if req.NewPassword != req.RepeatPassword {
		utils.RespondError(c, http.StatusBadRequest, 
			"The password does not match, please try again", 
			utils.ErrPasswordRepeatNotMatch)
		return
	}

	// Get user from context
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	// Get user from database
	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", utils.ErrUserNotFound)
		return
	}

	// Check current password
	if !utils.CheckPasswordHash(req.CurrentPassword, user.Password) {
		utils.RespondError(c, http.StatusBadRequest, "Incorrect current password", "PASSWORD_INCORRECT")
		return
	}

	// Check if new password is same as old
	if utils.CheckPasswordHash(req.NewPassword, user.Password) {
		utils.RespondError(c, http.StatusBadRequest, 
			"The password cannot be the same as the previous one", 
			utils.ErrPasswordSameAsOld)
		return
	}

	// Hash new password
	hashedPassword, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to hash password", "HASH_ERROR")
		return
	}

	// Generate new auth_id
	authID := jwtpkg.GenerateAuthID()
	user.Password = hashedPassword
	user.AuthID = &authID
	user.ChangeAsLogin = false

	// Update user
	if err := ctrl.DB.Save(&user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to update password", "DB_ERROR")
		return
	}

	// Update Redis if enabled
	ctx := context.Background()
	if redis.Enabled {
		expiry := time.Duration(ctrl.Config.JWT.ExpiryHours) * time.Hour
		redis.SetAuthID(ctx, user.ID.String(), authID, expiry)
	}

	// Generate new JWT token
	token, err := jwtpkg.GenerateToken(
		user.ID,
		user.Username,
		user.Type,
		authID,
		user.ChangeAsLogin,
		ctrl.Config.JWT.ExpiryHours,
	)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate token", "TOKEN_ERROR")
		return
	}

	// Determine redirect
	redirect := "/main"
	if user.Type == "admin" {
		redirect = "/dash"
	}

	utils.RespondSuccess(c, http.StatusOK, LoginResponse{
		Token:    token,
		LoginAs:  user.Type,
		Redirect: redirect,
	})
}
