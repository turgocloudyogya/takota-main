package controllers

import (
	"context"
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
	Type      string    `json:"type"`
	Timestamp time.Time `json:"timestamp"`
}

type AbsenceItem struct {
	Type   string        `json:"type"`
	Option string        `json:"option"`
	Verify *VerifierInfo `json:"verify"`
}

type VerifierInfo struct {
	UserID     string  `json:"user_id"`
	Username   string  `json:"username"`
	SignStatus *string `json:"sign_status"` // allow, reject, atau null (pending)
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
		Name:  user.Callname,
		Time:  utils.GetGreetingTime(),
		Title: utils.GetGreetingTitle(user.Callname),
	}

	// Get today's attendance
	var todayAttendance *TodayAttendance
	today := time.Now().UTC().Truncate(24 * time.Hour)
	var attendance models.Attendance
	err := ctrl.DB.Where("user_id = ? AND type = ? AND created_at >= ?", uid, "attendance", today).
		First(&attendance).Error
	if err == nil {
		todayAttendance = &TodayAttendance{
			Type:      attendance.Type,
			Timestamp: attendance.CreatedAt,
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
			Type:   abs.Type,
			Option: "",
			Verify: nil,
		}
		if abs.Option != nil {
			item.Option = *abs.Option
		}
		if abs.VerifyBy != nil && abs.Verifier != nil {
			item.Verify = &VerifierInfo{
				UserID:     abs.Verifier.ID.String(),
				Username:   abs.Verifier.Username,
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
		// User sudah absen hari ini
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
			utils.RespondError(c, http.StatusBadRequest, "Invalid file format", utils.ErrInvalidFileFormat)
			return
		}

		// Validate file size
		if !s3.ValidateFileSize(fileHeader.Size, ctrl.Config.FileUpload.MaxAttendanceFileSizeMB) {
			utils.RespondError(c, http.StatusBadRequest, "File size exceeds limit", utils.ErrInvalidFileFormat)
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

	// Generate Google Maps embed
	gmapsEmbed := utils.GenerateGoogleMapsEmbed(req.Latitude, req.Longitude)

	// Create attendance record
	attendance := models.Attendance{
		ID:         uuid.New(),
		UserID:     uid,
		Type:       "attendance",
		Latitude:   &req.Latitude,
		Longitude:  &req.Longitude,
		Photo:      photoPath,
		GmapsEmbed: &gmapsEmbed,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
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
		// User sudah absen normal hari ini, tidak boleh ngajuin perizinan
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
		// User masih punya perizinan yang pending (belum di-verify)
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
			utils.RespondError(c, http.StatusBadRequest, "Invalid file format", utils.ErrInvalidFileFormat)
			return
		}

		// Validate file size
		if !s3.ValidateFileSize(fileHeader.Size, ctrl.Config.FileUpload.MaxAbsenceFileSizeMB) {
			utils.RespondError(c, http.StatusBadRequest, "File size exceeds limit", utils.ErrInvalidFileFormat)
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
