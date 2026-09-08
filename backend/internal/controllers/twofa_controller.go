package controllers

import (
	"encoding/base64"
	"net/http"

	"github.com/carakan/takota/internal/config"
	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"gorm.io/gorm"
)

type TwoFAController struct {
	DB     *gorm.DB
	Config *config.Config
}

type SetupTwoFARequest struct {
	Code string `json:"code" binding:"required"`
}

type SetupTwoFAResponse struct {
	Secret    string `json:"secret"`
	QRCode    string `json:"qr_code"`
	Message   string `json:"message"`
}

type VerifyTwoFAResponse struct {
	Enabled bool   `json:"enabled"`
	Message string `json:"message"`
}

type DisableTwoFARequest struct {
	Code string `json:"code" binding:"required"`
}

// Setup2FA generates TOTP secret and returns QR code
func (ctrl *TwoFAController) Setup2FA(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	// Get user
	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}

	// Generate new TOTP secret
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Takota",
		AccountName: user.Username,
	})
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate 2FA secret", "GENERATION_FAILED")
		return
	}

	// Encode QR code as PNG image data URL
	image, err := key.Image(200, 200)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate QR code", "QR_GENERATION_FAILED")
		return
	}

	// Convert image to PNG bytes
	var buf []byte
	buf, err = utils.ImageToPNG(image)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to encode QR code", "QR_ENCODING_FAILED")
		return
	}

	// Convert to data URL
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf)

	utils.RespondSuccess(c, http.StatusOK, SetupTwoFAResponse{
		Secret:  key.Secret(),
		QRCode:  dataURL,
		Message: "Scan the QR code with your authenticator app, then verify with the code",
	})
}

// Verify2FA validates the TOTP code and enables 2FA
func (ctrl *TwoFAController) Verify2FA(c *gin.Context) {
	var req SetupTwoFARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", "INVALID_REQUEST")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	// Get secret from request header (should be provided by frontend during setup)
	secret := c.GetHeader("X-TOTP-Secret")
	if secret == "" {
		utils.RespondError(c, http.StatusBadRequest, "TOTP secret not provided", "SECRET_MISSING")
		return
	}

	// Validate the provided code
	valid, err := totp.ValidateCustom(req.Code, secret, utils.GetNowInUTC(), totp.ValidateOpts{
		Period:    30,
		Skew:      1,
		Digits:    otp.DigitsSix,
	})
	if err != nil || !valid {
		utils.RespondError(c, http.StatusBadRequest, "Invalid verification code", "INVALID_CODE")
		return
	}

	// Update user with TOTP secret and enable 2FA
	if err := ctrl.DB.Model(&models.User{}).
		Where("id = ?", uid).
		Updates(map[string]interface{}{
			"totp_enabled": true,
			"totp_secret":  secret,
		}).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to enable 2FA", "UPDATE_FAILED")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, VerifyTwoFAResponse{
		Enabled: true,
		Message: "2FA has been enabled successfully",
	})
}

// Disable2FA disables 2FA after verifying the current code
func (ctrl *TwoFAController) Disable2FA(c *gin.Context) {
	var req DisableTwoFARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", "INVALID_REQUEST")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	// Get user
	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}

	// Check if 2FA is enabled
	if !user.TOTPEnabled || user.TOTPSecret == nil {
		utils.RespondError(c, http.StatusBadRequest, "2FA is not enabled", "2FA_NOT_ENABLED")
		return
	}

	// Validate the provided code
	valid, err := totp.ValidateCustom(req.Code, *user.TOTPSecret, utils.GetNowInUTC(), totp.ValidateOpts{
		Period:    30,
		Skew:      1,
		Digits:    otp.DigitsSix,
	})
	if err != nil || !valid {
		utils.RespondError(c, http.StatusBadRequest, "Invalid verification code", "INVALID_CODE")
		return
	}

	// Disable 2FA
	if err := ctrl.DB.Model(&models.User{}).
		Where("id = ?", uid).
		Updates(map[string]interface{}{
			"totp_enabled": false,
			"totp_secret":  nil,
		}).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to disable 2FA", "UPDATE_FAILED")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"message": "2FA has been disabled successfully",
	})
}

// Check2FAStatus returns current 2FA status
func (ctrl *TwoFAController) Check2FAStatus(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"enabled": user.TOTPEnabled,
	})
}
