package controllers

import (
	"encoding/base64"
	"net/http"

	"github.com/carakan/takota/internal/config"
	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/twofactor"
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

type SetupTwoFAResponse struct {
	Secret    string `json:"secret"`
	QRCode    string `json:"qr_code"`
	Message   string `json:"message"`
}

type EnableTwoFAResponse struct {
	Enabled     bool     `json:"enabled"`
	BackupCodes []string `json:"backup_codes"`
	Message     string   `json:"message"`
}

type CodeRequest struct {
	Code string `json:"code" binding:"required"`
}

func validateTOTP(code, secret string) bool {
	valid, err := totp.ValidateCustom(code, secret, utils.GetNowInUTC(), totp.ValidateOpts{
		Period: 30,
		Skew:   1,
		Digits: otp.DigitsSix,
	})
	return err == nil && valid
}

// Setup2FA generates a TOTP secret, keeps it server-side as pending, and
// returns the QR code. Nothing is enabled until Verify2FA succeeds.
func (ctrl *TwoFAController) Setup2FA(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Takota",
		AccountName: user.Username,
	})
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate 2FA secret", "GENERATION_FAILED")
		return
	}

	image, err := key.Image(200, 200)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate QR code", "QR_GENERATION_FAILED")
		return
	}

	var buf []byte
	buf, err = utils.ImageToPNG(image)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to encode QR code", "QR_ENCODING_FAILED")
		return
	}

	secret := key.Secret()
	if err := ctrl.DB.Model(&models.User{}).
		Where("id = ?", uid).
		Update("totp_pending_secret", secret).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to start 2FA setup", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, SetupTwoFAResponse{
		Secret:  secret,
		QRCode:  "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf),
		Message: "Scan the QR code with your authenticator app, then verify with the code",
	})
}

// Verify2FA confirms the code against the pending secret, enables TOTP, and
// issues fresh backup codes (shown exactly once).
func (ctrl *TwoFAController) Verify2FA(c *gin.Context) {
	var req CodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", "INVALID_REQUEST")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}
	if user.TOTPPendingSecret == nil || *user.TOTPPendingSecret == "" {
		utils.RespondError(c, http.StatusBadRequest, "No 2FA setup in progress", "NO_PENDING_SETUP")
		return
	}
	if !validateTOTP(req.Code, *user.TOTPPendingSecret) {
		utils.RespondError(c, http.StatusBadRequest, "Invalid verification code", "INVALID_CODE")
		return
	}

	plain, hashes, err := twofactor.GenerateBackupCodes()
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate backup codes", "BACKUP_FAILED")
		return
	}

	secret := *user.TOTPPendingSecret
	if err := ctrl.DB.Model(&models.User{}).
		Where("id = ?", uid).
		Select("totp_enabled", "totp_secret", "totp_pending_secret", "backup_codes").
		Updates(&models.User{
			TOTPEnabled:       true,
			TOTPSecret:        &secret,
			TOTPPendingSecret: nil,
			BackupCodes:       hashes,
		}).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to enable 2FA", "UPDATE_FAILED")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, EnableTwoFAResponse{
		Enabled:     true,
		BackupCodes: plain,
		Message:     "2FA enabled. Save these backup codes - each works once and they will never be shown again",
	})
}

// RegenerateBackupCodes issues a fresh set of backup codes after verifying
// a current TOTP code or an unused backup code.
func (ctrl *TwoFAController) RegenerateBackupCodes(c *gin.Context) {
	var req CodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", "INVALID_REQUEST")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}
	if !user.TOTPEnabled && !user.PasskeyEnabled {
		utils.RespondError(c, http.StatusBadRequest, "2FA is not enabled", "2FA_NOT_ENABLED")
		return
	}
	if !ctrl.verifySecondFactor(&user, req.Code) {
		utils.RespondError(c, http.StatusBadRequest, "Invalid verification code", "INVALID_CODE")
		return
	}

	plain, hashes, err := twofactor.GenerateBackupCodes()
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate backup codes", "BACKUP_FAILED")
		return
	}

	if err := ctrl.DB.Model(&models.User{}).
		Where("id = ?", uid).
		Select("backup_codes").
		Updates(&models.User{BackupCodes: hashes}).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to save backup codes", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"backup_codes": plain,
		"message":      "New backup codes generated. Old codes no longer work - save these now",
	})
}

// verifySecondFactor accepts a TOTP code or an unused backup code (without
// consuming the backup code - callers consume when appropriate).
func (ctrl *TwoFAController) verifySecondFactor(user *models.User, code string) bool {
	if user.TOTPEnabled && user.TOTPSecret != nil && validateTOTP(code, *user.TOTPSecret) {
		return true
	}
	return twofactor.MatchBackupCode(code, []string(user.BackupCodes))
}

// Disable2FA turns off TOTP after verifying a current code. Passkeys and
// backup codes are left untouched unless nothing remains.
func (ctrl *TwoFAController) Disable2FA(c *gin.Context) {
	var req CodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", "INVALID_REQUEST")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}
	if !user.TOTPEnabled || user.TOTPSecret == nil {
		utils.RespondError(c, http.StatusBadRequest, "2FA is not enabled", "2FA_NOT_ENABLED")
		return
	}
	if !ctrl.verifySecondFactor(&user, req.Code) {
		utils.RespondError(c, http.StatusBadRequest, "Invalid verification code", "INVALID_CODE")
		return
	}

	updates := &models.User{TOTPEnabled: false, TOTPSecret: nil}
	columns := []string{"totp_enabled", "totp_secret"}
	// A spent backup code must not survive.
	if remaining, consumed := twofactor.ConsumeBackupCode(req.Code, []string(user.BackupCodes)); consumed {
		updates.BackupCodes = remaining
		columns = append(columns, "backup_codes")
	}

	if err := ctrl.DB.Model(&models.User{}).
		Where("id = ?", uid).
		Select(columns).
		Updates(updates).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to disable 2FA", "UPDATE_FAILED")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"message": "Authenticator 2FA disabled successfully",
	})
}

// Check2FAStatus returns the current second-factor state (self only).
func (ctrl *TwoFAController) Check2FAStatus(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}

	var passkeyCount int64
	ctrl.DB.Model(&models.WebauthnCredential{}).Where("user_id = ?", uid).Count(&passkeyCount)

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"enabled":          user.TOTPEnabled,
		"totp_enabled":     user.TOTPEnabled,
		"passkey_enabled":  user.PasskeyEnabled && passkeyCount > 0,
		"passkey_count":    passkeyCount,
		"backup_remaining": len(user.BackupCodes),
	})
}
