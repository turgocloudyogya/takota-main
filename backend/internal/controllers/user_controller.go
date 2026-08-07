package controllers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/carakan/takota/internal/config"
	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/carakan/takota/pkg/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserController struct {
	DB     *gorm.DB
	Config *config.Config
}

type HomeResponse struct {
	Data HomeData `json:"data"`
}

type HomeData struct {
	GreetingWidget GreetingWidget       `json:"greeting_widget"`
	Today          *TodayAttendance     `json:"today"`
	Absence        []AbsenceItem        `json:"absence"`
}

type GreetingWidget struct {
	Name  string `json:"name"`
	Time  string `json:"time"`
	Title string `json:"title"`
}

type TodayAttendance struct {
	Type           string    `json:"type"`
	Timestamp      time.Time `json:"timestamp"`
	DisplayAddress *string   `json:"display_address"` // reverse-geocoded location label
}

type AbsenceItem struct {
	ID        string        `json:"id"`
	Type      string        `json:"type"`
	Option    string        `json:"option"`
	Reason    string        `json:"reason"`
	Timestamp string        `json:"timestamp"`
	Verify    *VerifierInfo `json:"verify"`
}

type VerifierInfo struct {
	UserID     string  `json:"user_id"`
	Username   string  `json:"username"`
	SignStatus *string `json:"sign_status"` // allow, reject, or null (pending)
}

type AttendanceRequest struct {
	Latitude  string `form:"latitude"`
	Longitude string `form:"longitude"`
}

type AbsenceRequest struct {
	Reason string `form:"reason"`
	Option string `form:"option"`
}

// Home returns user home dashboard data
func (ctrl *UserController) Home(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	// Get user
	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", utils.ErrUserNotFound)
		return
	}

	// Build greeting widget
	greetingWidget := GreetingWidget{
		Name:  user.Nickname,
		Time:  utils.GetGreetingTime(),
		Title: utils.GetGreetingTitle(user.Nickname),
	}

	// Get today's attendance
	var todayAttendance *TodayAttendance
	today := time.Now().UTC().Truncate(24 * time.Hour)
	var attendance models.Attendance
	err := ctrl.DB.Where("user_id = ? AND type = ? AND created_at >= ?", uid, "attendance", today).
		First(&attendance).Error
	if err == nil {
		todayAttendance = &TodayAttendance{
			Type:           attendance.Type,
			Timestamp:      attendance.CreatedAt,
			DisplayAddress: attendance.DisplayAddress,
		}
	}

	// Get recent absences (last 4, only type absence)
	var absences []models.Attendance
	ctrl.DB.Where("user_id = ? AND type = ?", uid, "absence").
		Order("created_at DESC").
		Limit(4).
		Preload("Verifier").
		Find(&absences)

	absenceItems := []AbsenceItem{}
	for _, abs := range absences {
		item := AbsenceItem{
			ID:        abs.ID.String(),
			Type:      abs.Type,
			Option:    "",
			Reason:    "",
			Timestamp: abs.CreatedAt.Format(time.RFC3339),
			Verify:    nil,
		}
		if abs.Option != nil {
			item.Option = *abs.Option
		}
		if abs.Reason != nil {
			item.Reason = *abs.Reason
		}
		if abs.SignStatus != nil {
			username := "unknown"
			var userID string
			if abs.VerifyBy != nil && abs.Verifier != nil {
				username = abs.Verifier.Username
				userID = abs.Verifier.ID.String()
			} else if abs.VerifyBy != nil {
				userID = abs.VerifyBy.String()
			}
			item.Verify = &VerifierInfo{
				UserID:     userID,
				Username:   username,
				SignStatus: abs.SignStatus,
			}
		}
		absenceItems = append(absenceItems, item)
	}

	utils.RespondSuccess(c, http.StatusOK, HomeResponse{
		Data: HomeData{
			GreetingWidget: greetingWidget,
			Today:          todayAttendance,
			Absence:        absenceItems,
		},
	})
}

// Attendance handles attendance submission
func (ctrl *UserController) Attendance(c *gin.Context) {
	var req AttendanceRequest
	if err := c.ShouldBind(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Fill all input", utils.ErrBodyFillAll)
		return
	}

	// Manual validation for required fields
	if req.Latitude == "" || req.Longitude == "" {
		utils.RespondError(c, http.StatusBadRequest, "Fill all input", utils.ErrBodyFillAll)
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	// VALIDATION: Check if user already has attendance today
	today := time.Now().UTC().Truncate(24 * time.Hour)
	var existingAttendance models.Attendance
	err := ctrl.DB.Where("user_id = ? AND type = ? AND DATE(created_at) = DATE(?)", uid, "attendance", today).
		First(&existingAttendance).Error
	if err == nil {
		// User has already submitted attendance today
		utils.RespondError(c, http.StatusBadRequest, "You have already submitted attendance today", "ATTENDANCE_ALREADY_SUBMITTED")
		return
	} else if err != nil && err.Error() != "record not found" {
		utils.RespondError(c, http.StatusInternalServerError, "Database error", "DB_ERROR")
		return
	}

	// Handle photo upload
	var photoPath *string
	file, fileHeader, err := c.Request.FormFile("photo")
	if err == nil {
		defer file.Close()

		// Validate file type
		contentType := fileHeader.Header.Get("Content-Type")
		if !s3.ValidateFileType(contentType, s3.GetAllowedAttendanceTypes()) {
			utils.RespondError(c, http.StatusBadRequest, "Invalid file format. Allowed formats: JPG, JPEG, PNG", utils.ErrInvalidFileFormat)
			return
		}

		// Validate file size
		if !s3.ValidateFileSize(fileHeader.Size, ctrl.Config.FileUpload.MaxAttendanceFileSizeMB) {
			utils.RespondError(c, http.StatusBadRequest, 
				fmt.Sprintf("Photo file size exceeds maximum limit of %d MB", ctrl.Config.FileUpload.MaxAttendanceFileSizeMB), 
				utils.ErrInvalidFileFormat)
			return
		}

		// Upload to S3
		ctx := context.Background()
		objectKey, err := s3.UploadFile(ctx, file, fileHeader, "attendance")
		if err != nil {
			utils.RespondError(c, http.StatusInternalServerError, "Failed to upload file", "UPLOAD_ERROR")
			return
		}
		photoPath = &objectKey
	}

	// Generate Google Maps link
	gmapsLink := utils.GenerateGoogleMapsLink(req.Latitude, req.Longitude)

	// Resolve human-readable address (best-effort, does not block submission)
	displayAddress, geoErr := utils.ReverseGeocode(req.Latitude, req.Longitude)
	if geoErr != nil {
		displayAddress = nil
	}

	// Create attendance record
	attendance := models.Attendance{
		ID:             uuid.New(),
		UserID:         uid,
		Type:           "attendance",
		Latitude:       &req.Latitude,
		Longitude:      &req.Longitude,
		Photo:          photoPath,
		GmapsEmbed:     &gmapsLink,
		DisplayAddress: displayAddress,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	if err := ctrl.DB.Create(&attendance).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to create attendance", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"id":      attendance.ID.String(),
		"message": "Attendance successfully recorded",
	})
}

// Absence handles absence submission
func (ctrl *UserController) Absence(c *gin.Context) {
	var req AbsenceRequest
	if err := c.ShouldBind(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Fill all input", utils.ErrBodyFillAll)
		return
	}

	// Manual validation for required fields
	if req.Reason == "" || req.Option == "" {
		utils.RespondError(c, http.StatusBadRequest, "Fill all input", utils.ErrBodyFillAll)
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	// VALIDATION 1: Check if user already has normal attendance today
	today := time.Now().UTC().Truncate(24 * time.Hour)
	var attendanceToday models.Attendance
	err := ctrl.DB.Where("user_id = ? AND type = ? AND DATE(created_at) = DATE(?)", uid, "attendance", today).
		First(&attendanceToday).Error
	if err == nil {
		// User already has normal attendance today, cannot submit absence
		utils.RespondError(c, http.StatusBadRequest, "Cannot submit absence after normal attendance", "CANNOT_SUBMIT_ABSENCE_AFTER_ATTENDANCE")
		return
	} else if err != nil && err.Error() != "record not found" {
		utils.RespondError(c, http.StatusInternalServerError, "Database error", "DB_ERROR")
		return
	}

	// VALIDATION 2: Check if user has pending absence verification
	var pendingAbsence models.Attendance
	err = ctrl.DB.Where("user_id = ? AND type = ? AND verify_by IS NULL", uid, "absence").
		First(&pendingAbsence).Error
	if err == nil {
		// User still has a pending absence that has not been verified
		utils.RespondError(c, http.StatusBadRequest, "You have pending absence verification, cannot submit new request", "PENDING_ABSENCE_VERIFICATION")
		return
	} else if err != nil && err.Error() != "record not found" {
		utils.RespondError(c, http.StatusInternalServerError, "Database error", "DB_ERROR")
		return
	}

	// Handle file upload
	var filePath *string
	file, fileHeader, err := c.Request.FormFile("file")
	if err == nil {
		defer file.Close()

		// Validate file type
		contentType := fileHeader.Header.Get("Content-Type")
		if !s3.ValidateFileType(contentType, s3.GetAllowedAbsenceTypes()) {
			utils.RespondError(c, http.StatusBadRequest, "Invalid file format. Allowed formats: PDF, DOC, DOCX", utils.ErrInvalidFileFormat)
			return
		}

		// Validate file size
		if !s3.ValidateFileSize(fileHeader.Size, ctrl.Config.FileUpload.MaxAbsenceFileSizeMB) {
			utils.RespondError(c, http.StatusBadRequest, 
				fmt.Sprintf("Document file size exceeds maximum limit of %d MB", ctrl.Config.FileUpload.MaxAbsenceFileSizeMB), 
				utils.ErrInvalidFileFormat)
			return
		}

		// Upload to S3
		ctx := context.Background()
		objectKey, err := s3.UploadFile(ctx, file, fileHeader, "absence")
		if err != nil {
			utils.RespondError(c, http.StatusInternalServerError, "Failed to upload file", "UPLOAD_ERROR")
			return
		}
		filePath = &objectKey
	}

	// Create absence record
	absence := models.Attendance{
		ID:        uuid.New(),
		UserID:    uid,
		Type:      "absence",
		Option:    &req.Option,
		Reason:    &req.Reason,
		File:      filePath,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	if err := ctrl.DB.Create(&absence).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to create absence", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"id":      absence.ID.String(),
		"message": "Absence successfully submitted",
	})
}

// DeleteAbsence deletes one of the user's own pending absence records.
// A record can only be removed while it is still pending; once an admin has
// accepted or rejected it, it can no longer be deleted.
func (ctrl *UserController) DeleteAbsence(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	id, err := uuid.Parse(c.Param("absence_id"))
	if err != nil {
		utils.RespondError(c, http.StatusNotFound, "Data not found", utils.ErrDataNotFound)
		return
	}

	// Ownership is enforced at the query level: users can only delete their own records
	var absence models.Attendance
	if err := ctrl.DB.Where("id = ? AND user_id = ?", id, uid).First(&absence).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "Data not found", utils.ErrDataNotFound)
		return
	}

	// Only absence records can be deleted via this endpoint
	if absence.Type != "absence" {
		utils.RespondError(c, http.StatusNotFound, "Data not found", utils.ErrDataNotFound)
		return
	}

	// Pending requests can be deleted; accepted/rejected ones cannot
	if absence.SignStatus != nil {
		utils.RespondError(c, http.StatusBadRequest, "Cannot delete absence that has already been verified", utils.ErrCannotDeleteVerifiedAbsence)
		return
	}

	// Delete file from S3 if present
	if absence.File != nil {
		ctx := context.Background()
		s3.DeleteFile(ctx, *absence.File)
	}

	// Delete absence
	if err := ctrl.DB.Delete(&absence).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to delete", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"message": "Absence deleted successfully",
	})
}
