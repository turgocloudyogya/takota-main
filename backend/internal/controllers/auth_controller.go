package controllers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/carakan/takota/internal/config"
	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/twofactor"
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

// AuthCookieName is the HttpOnly session cookie carrying the JWT.
// The SPA never touches it via JS; the browser attaches it automatically
// (fetch credentials:"include"), which also keeps it working behind the
// nginx proxy in Docker without extra config.
const AuthCookieName = "takota_token"

// UIProfileCookie carries non-sensitive display info (username/role) so the
// SPA can gate routes without reading the token from JS.
const UIProfileCookieName = "takota_profile"

func setAuthCookies(c *gin.Context, token, username, userType string, expiryHours int) {
	maxAge := expiryHours * 3600
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(AuthCookieName, token, maxAge, "/", "", false, true)
	c.SetCookie(UIProfileCookieName, username+"|"+userType, maxAge, "/", "", false, false)
}

func clearAuthCookies(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(AuthCookieName, "", -1, "/", "", false, true)
	c.SetCookie(UIProfileCookieName, "", -1, "/", "", false, false)
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
			utils.RespondError(c, http.StatusTooManyRequests, 
				fmt.Sprintf("Account locked due to too many failed attempts. Please wait %d minutes before trying again", ctrl.Config.App.LoginLockDurationMinutes), 
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
					utils.RespondError(c, http.StatusTooManyRequests, 
						fmt.Sprintf("Too many failed attempts. Account locked for %d minutes. Please try again later", ctrl.Config.App.LoginLockDurationMinutes), 
						utils.ErrUserLockLogin)
					return
				}
				utils.RespondError(c, http.StatusUnauthorized, 
					fmt.Sprintf("Incorrect password. %d attempts remaining before account lockout", remaining), 
					utils.ErrUserTryAgain)
				return
			}
		}
		utils.RespondError(c, http.StatusUnauthorized, "Incorrect password", utils.ErrUserTryAgain)
		return
	}

	// Reset login attempts on successful login
	if redis.Enabled {
		redis.ResetLoginAttempts(ctx, req.Username)
	}

	// Second factor required? Issue a short-lived challenge instead of
	// a session. Backup codes ride along with TOTP.
	if user.TOTPEnabled || user.PasskeyEnabled {
		methods := []string{}
		if user.TOTPEnabled {
			methods = append(methods, "totp")
		}
		if user.PasskeyEnabled {
			methods = append(methods, "passkey")
		}
		challenge := twofactor.New(user.ID, twofactor.KindLogin2FA, nil)
		c.JSON(http.StatusAccepted, gin.H{
			"require_2fa": true,
			"challenge":   challenge,
			"methods":     methods,
		})
		return
	}

	issueSessionForUser(c, ctrl.DB, ctrl.Config, &user)
}

// issueSessionForUser creates a fresh session (auth_id rotation, JWT,
// cookies) and responds with the login payload including redirect.
func issueSessionForUser(c *gin.Context, db *gorm.DB, cfg *config.Config, user *models.User) {
	ctx := context.Background()

	authID := jwtpkg.GenerateAuthID()
	user.AuthID = &authID
	now := time.Now().UTC()
	user.LastLogin = &now

	if err := db.Save(user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to update user", "DB_ERROR")
		return
	}

	if redis.Enabled {
		expiry := time.Duration(cfg.JWT.ExpiryHours) * time.Hour
		redis.SetAuthID(ctx, user.ID.String(), authID, expiry)
	}

	token, err := jwtpkg.GenerateToken(
		user.ID,
		user.Username,
		user.Type,
		authID,
		user.ChangeAsLogin,
		cfg.JWT.ExpiryHours,
	)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate token", "TOKEN_ERROR")
		return
	}

	redirect := "/main"
	if user.Type == "admin" {
		redirect = "/admin"
	}
	if user.ChangeAsLogin {
		redirect = "/chpw"
	}

	setAuthCookies(c, token, user.Username, user.Type, cfg.JWT.ExpiryHours)
	utils.RespondSuccess(c, http.StatusOK, LoginResponse{
		Token:    token,
		LoginAs:  user.Type,
		Redirect: redirect,
	})
}

type VerifyLogin2FARequest struct {
	Challenge string `json:"challenge" binding:"required"`
	Code      string `json:"code" binding:"required"`
}

// VerifyLogin2FA completes a password login with a TOTP code or an unused
// backup code (which is consumed).
func (ctrl *AuthController) VerifyLogin2FA(c *gin.Context) {
	var req VerifyLogin2FARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", "INVALID_REQUEST")
		return
	}

	ch, ok := twofactor.Peek(req.Challenge, twofactor.KindLogin2FA)
	if !ok {
		utils.RespondError(c, http.StatusUnauthorized, "Login challenge expired, please log in again", "CHALLENGE_EXPIRED")
		return
	}

	var user models.User
	if err := ctrl.DB.Where("id = ?", ch.UserID).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}

	authenticated := false
	if user.TOTPEnabled && user.TOTPSecret != nil && validateTOTP(req.Code, *user.TOTPSecret) {
		authenticated = true
	}
	if !authenticated {
		if remaining, consumed := twofactor.ConsumeBackupCode(req.Code, []string(user.BackupCodes)); consumed {
			authenticated = true
			ctrl.DB.Model(&models.User{}).Where("id = ?", user.ID).
				Select("backup_codes").
				Updates(&models.User{BackupCodes: remaining})
			user.BackupCodes = remaining
		}
	}
	if !authenticated {
		utils.RespondError(c, http.StatusUnauthorized, "Invalid verification code", "INVALID_CODE")
		return
	}

	twofactor.Take(req.Challenge, twofactor.KindLogin2FA)
	issueSessionForUser(c, ctrl.DB, ctrl.Config, &user)
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
		redirect = "/admin"
	}

	setAuthCookies(c, token, user.Username, user.Type, ctrl.Config.JWT.ExpiryHours)
	utils.RespondSuccess(c, http.StatusOK, LoginResponse{
		Token:    token,
		LoginAs:  user.Type,
		Redirect: redirect,
	})
}

// Logout invalidates the current session by rotating the user's auth_id,
// so any previously issued JWT can no longer pass AuthMiddleware validation.
func (ctrl *AuthController) Logout(c *gin.Context) {
	ctx := context.Background()

	// Get user from context (set by AuthMiddleware)
	userID, _ := c.Get("user_id")
	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		utils.RespondError(c, http.StatusUnauthorized, "JWT not valid", utils.ErrTokenInvalid)
		return
	}

	// Get user from database
	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", utils.ErrUserNotFound)
		return
	}

	// Rotate auth_id to invalidate all existing tokens
	authID := jwtpkg.GenerateAuthID()
	user.AuthID = &authID
	if err := ctrl.DB.Save(&user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to update user", "DB_ERROR")
		return
	}

	// Update Redis if enabled
	if redis.Enabled {
		expiry := time.Duration(ctrl.Config.JWT.ExpiryHours) * time.Hour
		redis.SetAuthID(ctx, user.ID.String(), authID, expiry)
	}

	clearAuthCookies(c)
	utils.RespondSuccess(c, http.StatusOK, gin.H{"message": "Logout successful"})
}
