package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/carakan/takota/internal/config"
	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/carakan/takota/pkg/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AllController struct {
	DB     *gorm.DB
	Config *config.Config
}

type InfoResponse struct {
	Data     *InfoData `json:"data,omitempty"`
	Unvalid  bool      `json:"unvalid,omitempty"`
	Redirect string    `json:"redirect,omitempty"`
}

type InfoData struct {
	Account      AccountInfo `json:"account"`
	Role         string      `json:"role"`
	RedirectHome string      `json:"redirect_home"`
}

type AccountInfo struct {
	UserID    string    `json:"user_id"`
	Username  string    `json:"username"`
	Nickname  string    `json:"nickname"`
	Callname  string    `json:"callname"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PhotosResponse struct {
	Data   []PhotoItem `json:"data"`
	LastID *string     `json:"last_id"`
}

type PhotoItem struct {
	ID          string `json:"id"`
	URL         string `json:"url"`
	Description string `json:"description"`
}

// GetInfo returns global user info with validation check
func (ctrl *AllController) GetInfo(c *gin.Context) {
	// This endpoint handles auth validation differently
	// It returns unvalid: true if auth fails, instead of error
	
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusOK, InfoResponse{
			Unvalid:  true,
			Redirect: "/",
		})
		return
	}

	// Try to get user info from context (set by auth middleware if valid)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusOK, InfoResponse{
			Unvalid:  true,
			Redirect: "/",
		})
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusOK, InfoResponse{
			Unvalid:  true,
			Redirect: "/",
		})
		return
	}

	// Get user from database
	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, InfoResponse{
			Unvalid:  true,
			Redirect: "/",
		})
		return
	}

	// Build response
	redirectHome := "/main"
	if user.Type == "admin" {
		redirectHome = "/dash"
	}

	utils.RespondSuccess(c, http.StatusOK, InfoResponse{
		Data: &InfoData{
			Account: AccountInfo{
				UserID:    user.ID.String(),
				Username:  user.Username,
				Nickname:  user.Nickname,
				Callname:  user.Callname,
				CreatedAt: user.CreatedAt,
				UpdatedAt: user.UpdatedAt,
			},
			Role:         user.Type,
			RedirectHome: redirectHome,
		},
	})
}

// GetPhotos returns gallery of attendance photos
func (ctrl *AllController) GetPhotos(c *gin.Context) {
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	lastID := c.Query("last_id")

	query := ctrl.DB.Model(&models.Attendance{}).
		Where("type = ? AND photo IS NOT NULL", "attendance")

	// Apply cursor pagination
	if lastID != "" {
		query = query.Where("id < ?", lastID)
	}

	var attendances []models.Attendance
	query.Order("created_at DESC").
		Preload("User").
		Limit(limit + 1).
		Find(&attendances)

	// Check if there are more results
	hasMore := len(attendances) > limit
	if hasMore {
		attendances = attendances[:limit]
	}

	// Build response
	ctx := context.Background()
	items := []PhotoItem{}
	for _, att := range attendances {
		if att.Photo == nil {
			continue
		}

		photoURL, err := s3.GetSignedURL(ctx, *att.Photo, 30*time.Minute)
		if err != nil {
			continue
		}

		description := fmt.Sprintf("Attendance by %s on %s",
			att.User.Nickname,
			att.CreatedAt.Format("2006-01-02 15:04:05"))

		items = append(items, PhotoItem{
			ID:          att.ID.String(),
			URL:         photoURL,
			Description: description,
		})
	}

	var nextLastID *string
	if hasMore && len(items) > 0 {
		lastItem := items[len(items)-1]
		nextLastID = &lastItem.ID
	}

	utils.RespondSuccess(c, http.StatusOK, PhotosResponse{
		Data:   items,
		LastID: nextLastID,
	})
}
