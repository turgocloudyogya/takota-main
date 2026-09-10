package controllers

import (
	"net/http"

	"github.com/carakan/takota/internal/config"
	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type NotificationController struct {
	DB     *gorm.DB
	Config *config.Config
}

type PushSubscriptionRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	Auth     string `json:"auth" binding:"required"`
	P256DH   string `json:"p256dh" binding:"required"`
}

// RegisterPushSubscription registers a device for push notifications
func (ctrl *NotificationController) RegisterPushSubscription(c *gin.Context) {
	var req PushSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", "INVALID_REQUEST")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	// Store push subscription
	subscription := &models.PushSubscription{
		Endpoint: req.Endpoint,
		Auth:     req.Auth,
		P256DH:   req.P256DH,
	}

	if err := ctrl.DB.Model(&models.User{}).
		Where("id = ?", uid).
		Update("push_subscription", subscription).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to register push subscription", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"message": "Push subscription registered successfully",
	})
}

// UnregisterPushSubscription unregisters device from push notifications
func (ctrl *NotificationController) UnregisterPushSubscription(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	if err := ctrl.DB.Model(&models.User{}).
		Where("id = ?", uid).
		Update("push_subscription", nil).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to unregister push subscription", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"message": "Push subscription unregistered successfully",
	})
}

// GetPushSubscriptionStatus returns whether device has push enabled
func (ctrl *NotificationController) GetPushSubscriptionStatus(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}

	enabled := user.PushSubscription != nil

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"enabled": enabled,
	})
}
