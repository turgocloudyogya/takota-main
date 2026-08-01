package controllers

import (
	"context"
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

type AdminController struct {
	DB     *gorm.DB
	Config *config.Config
}

type AttendanceListResponse struct {
	Data   []AttendanceListItem `json:"data"`
	LastID *string              `json:"last_id"`
}

type AttendanceListItem struct {
	ID             string `json:"id"`
	UserID         string `json:"user_id"`
	Photo          string `json:"photo"`
	GmapsEmbed     string `json:"gmaps_embed"`
	DisplayAddress string `json:"display_address"`
	Latitude       string `json:"latitude"`
	Longitude      string `json:"longitude"`
	Timestamp      string `json:"timestamp"`
}

type AbsenceListResponse struct {
	Data   []AbsenceListItem `json:"data"`
	LastID *string           `json:"last_id"`
}

type AbsenceListItem struct {
	ID        string        `json:"id"`
	UserID    string        `json:"user_id"`
	File      string        `json:"file"`
	Reason    string        `json:"reason"`
	Option    string        `json:"option"`
	Verify    *VerifyDetail `json:"verify"`
	Timestamp string        `json:"timestamp"`
}

type VerifyDetail struct {
	UserID     string  `json:"user_id"`
	Username   string  `json:"username"`
	SignStatus *string `json:"sign_status"` // allow, reject, atau null (pending)
}

type DeleteRequest struct {
	ID string `json:"id" binding:"required"`
}

type SignatureRequest struct {
	ID   string `json:"id" binding:"required"`
	Sign string `json:"sign" binding:"required"`
}

// ListAttendances returns list of all attendances
func (ctrl *AdminController) ListAttendances(c *gin.Context) {
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	lastID := c.Query("last_id")
	search := c.Query("search")

	query := ctrl.DB.Model(&models.Attendance{}).Where("type = ?", "attendance")

	// Apply search filter
	if search != "" {
		query = query.Joins("JOIN users ON users.id = attendance.user_id").
			Where("users.username LIKE ? OR users.nickname LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// Apply cursor pagination
	if lastID != "" {
		query = query.Where("attendance.id < ?", lastID)
	}

	var attendances []models.Attendance
	query.Order("attendance.created_at DESC").Limit(limit + 1).Find(&attendances)

	// Check if there are more results
	hasMore := len(attendances) > limit
	if hasMore {
		attendances = attendances[:limit]
	}

	// Build response
	ctx := context.Background()
	items := []AttendanceListItem{}
	for _, att := range attendances {
		photoURL := ""
		if att.Photo != nil {
			url, _ := s3.GetSignedURL(ctx, *att.Photo, 1*time.Minute)
			photoURL = url
		}

		gmapsEmbed := ""
		if att.GmapsEmbed != nil {
			gmapsEmbed = *att.GmapsEmbed
		}

		displayAddress := ""
		if att.DisplayAddress != nil {
			displayAddress = *att.DisplayAddress
		}

		lat := ""
		if att.Latitude != nil {
			lat = *att.Latitude
		}

		lon := ""
		if att.Longitude != nil {
			lon = *att.Longitude
		}

		items = append(items, AttendanceListItem{
			ID:             att.ID.String(),
			UserID:         att.UserID.String(),
			Photo:          photoURL,
			GmapsEmbed:     gmapsEmbed,
			DisplayAddress: displayAddress,
			Latitude:       lat,
			Longitude:      lon,
			Timestamp:      att.CreatedAt.Format(time.RFC3339),
		})
	}

	var nextLastID *string
	if hasMore && len(items) > 0 {
		lastItem := items[len(items)-1]
		nextLastID = &lastItem.ID
	}

	utils.RespondSuccess(c, http.StatusOK, AttendanceListResponse{
		Data:   items,
		LastID: nextLastID,
	})
}

// ListAbsences returns list of all absences
func (ctrl *AdminController) ListAbsences(c *gin.Context) {
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	lastID := c.Query("last_id")
	search := c.Query("search")

	query := ctrl.DB.Model(&models.Attendance{}).Where("type = ?", "absence")

	// Apply search filter
	if search != "" {
		query = query.Joins("JOIN users ON users.id = attendance.user_id").
			Where("users.username LIKE ? OR users.nickname LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// Apply cursor pagination
	if lastID != "" {
		query = query.Where("attendance.id < ?", lastID)
	}

	var absences []models.Attendance
	query.Order("attendance.created_at DESC").
		Limit(limit + 1).
		Preload("Verifier").
		Find(&absences)

	// Check if there are more results
	hasMore := len(absences) > limit
	if hasMore {
		absences = absences[:limit]
	}

	// Build response
	ctx := context.Background()
	items := []AbsenceListItem{}
	for _, abs := range absences {
		fileURL := ""
		if abs.File != nil {
			url, _ := s3.GetSignedURL(ctx, *abs.File, 30*time.Minute)
			fileURL = url
		}

		reason := ""
		if abs.Reason != nil {
			reason = *abs.Reason
		}

		option := ""
		if abs.Option != nil {
			option = *abs.Option
		}

		var verify *VerifyDetail
		if abs.VerifyBy != nil && abs.Verifier != nil {
			verify = &VerifyDetail{
				UserID:     abs.Verifier.ID.String(),
				Username:   abs.Verifier.Username,
				SignStatus: abs.SignStatus,
			}
		}

		items = append(items, AbsenceListItem{
			ID:        abs.ID.String(),
			UserID:    abs.UserID.String(),
			File:      fileURL,
			Reason:    reason,
			Option:    option,
			Verify:    verify,
			Timestamp: abs.CreatedAt.Format(time.RFC3339),
		})
	}

	var nextLastID *string
	if hasMore && len(items) > 0 {
		lastItem := items[len(items)-1]
		nextLastID = &lastItem.ID
	}

	utils.RespondSuccess(c, http.StatusOK, AbsenceListResponse{
		Data:   items,
		LastID: nextLastID,
	})
}

// DeleteAttendance deletes an attendance record
func (ctrl *AdminController) DeleteAttendance(c *gin.Context) {
	var req DeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Fill all input", utils.ErrBodyFillAll)
		return
	}

	id, err := uuid.Parse(req.ID)
	if err != nil {
		utils.RespondError(c, http.StatusNotFound, "Data not found", utils.ErrDataNotFound)
		return
	}

	// Find attendance
	var attendance models.Attendance
	if err := ctrl.DB.Where("id = ?", id).First(&attendance).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Data not found", utils.ErrDataNotFound)
		return
	}

	// Delete photo from S3 if exists
	if attendance.Photo != nil {
		ctx := context.Background()
		s3.DeleteFile(ctx, *attendance.Photo)
	}

	// Delete attendance
	if err := ctrl.DB.Delete(&attendance).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to delete", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"message": "Attendance deleted successfully",
	})
}

// SignatureAbsence signs an absence record with allow/reject
func (ctrl *AdminController) SignatureAbsence(c *gin.Context) {
	var req SignatureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Fill all input", utils.ErrBodyFillAll)
		return
	}

	// Validate sign value
	if req.Sign != "allow" && req.Sign != "reject" {
		utils.RespondError(c, http.StatusBadRequest, "Sign must be 'allow' or 'reject'", utils.ErrBodyFillAll)
		return
	}

	id, err := uuid.Parse(req.ID)
	if err != nil {
		utils.RespondError(c, http.StatusNotFound, "Data not found", utils.ErrDataNotFound)
		return
	}

	// Find absence
	var absence models.Attendance
	if err := ctrl.DB.Where("id = ?", id).First(&absence).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Data not found", utils.ErrDataNotFound)
		return
	}

	// Check if it's an absence
	if absence.Type != "absence" {
		utils.RespondError(c, http.StatusNotFound, "Can only sign the absence form", utils.ErrOnlyAbsence)
		return
	}

	// Get admin user ID
	adminUserID, _ := c.Get("user_id")
	adminUID, _ := uuid.Parse(adminUserID.(string))

	// Update verify_by and sign_status
	absence.VerifyBy = &adminUID
	signStatus := req.Sign // "allow" atau "reject"
	absence.SignStatus = &signStatus

	if err := ctrl.DB.Save(&absence).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to update", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"message": "Absence signature updated successfully",
	})
}
