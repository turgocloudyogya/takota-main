package controllers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/carakan/takota/internal/config"
	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AdminSettingsController struct {
	DB     *gorm.DB
	Config *config.Config
}

type SettingsRequest struct {
	AttendanceOpenTime  string   `json:"attendance_open_time"`   // HH:MM format
	AttendanceCloseTime string   `json:"attendance_close_time"`  // HH:MM format
	OpenDays            []string `json:"open_days"`              // ["monday", "tuesday", ...]
}

type SettingsResponse struct {
	ID                  string   `json:"id"`
	AttendanceOpenTime  string   `json:"attendance_open_time"`
	AttendanceCloseTime string   `json:"attendance_close_time"`
	OpenDays            []string `json:"open_days"`
}

// GetSettings retrieves current attendance settings
func (ctrl *AdminSettingsController) GetSettings(c *gin.Context) {
	var settings models.Settings
	if err := ctrl.DB.First(&settings).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			utils.RespondSuccess(c, http.StatusOK, gin.H{
				"data": SettingsResponse{
					AttendanceOpenTime:  "06:00:00",
					AttendanceCloseTime: "21:00:00",
					OpenDays:            []string{"monday", "tuesday", "wednesday", "thursday", "friday"},
				},
			})
			return
		}
		utils.RespondError(c, http.StatusInternalServerError, "Database error", "DB_ERROR")
		return
	}

	response := SettingsResponse{
		ID:                  settings.ID.String(),
		AttendanceOpenTime:  settings.AttendanceOpenTime,
		AttendanceCloseTime: settings.AttendanceCloseTime,
		OpenDays:            settings.OpenDays,
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"data": response,
	})
}

// GetPublicStatus returns open/closed status plus next open time for countdown UIs
func (ctrl *AdminSettingsController) GetPublicStatus(c *gin.Context) {
	var settings models.Settings
	openTime := "06:00:00"
	closeTime := "21:00:00"
	openDays := []string{"monday", "tuesday", "wednesday", "thursday", "friday"}
	if err := ctrl.DB.First(&settings).Error; err == nil {
		openTime = settings.AttendanceOpenTime
		closeTime = settings.AttendanceCloseTime
		if len(settings.OpenDays) > 0 {
			openDays = settings.OpenDays
		}
	}
	now := utils.Now()
	isOpen := false
	tmp := models.Settings{AttendanceOpenTime: openTime, AttendanceCloseTime: closeTime}
	isOpen = tmp.IsAttendanceOpen(now, openDays)
	nextOpen := tmp.NextOpen(now, openDays)
	closeAt := nextClose(now, openTime, closeTime, openDays)
	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"data": gin.H{
			"is_open":               isOpen,
			"now":                   now.Format(time.RFC3339),
			"next_open":             nextOpen.Format(time.RFC3339),
			"next_open_day":         nextOpen.Weekday().String(),
			"next_open_time":        nextOpen.Format("15:04"),
			"close_at":              closeAt.Format(time.RFC3339),
			"attendance_open_time":  openTime,
			"attendance_close_time": closeTime,
			"open_days":             openDays,
		},
	})
}

// nextClose returns the upcoming closing datetime in server time: today's
// close time when still ahead, otherwise the close time of the next open day.
func nextClose(now time.Time, openTime, closeTime string, openDays []string) time.Time {
	valid := map[string]bool{}
	for _, d := range openDays {
		valid[strings.ToLower(strings.TrimSpace(d))] = true
	}
	oh, om := parseHM(openTime)
	ch, cm := parseHM(closeTime)
	_ = oh
	_ = om
	base := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	for i := 0; i < 8; i++ {
		day := base.AddDate(0, 0, i)
		if !valid[strings.ToLower(day.Weekday().String())] {
			continue
		}
		candidate := time.Date(day.Year(), day.Month(), day.Day(), ch, cm, 0, 0, day.Location())
		if candidate.After(now) {
			return candidate
		}
	}
	fallback := time.Date(base.Year(), base.Month(), base.Day(), ch, cm, 0, 0, base.Location())
	return fallback.AddDate(0, 0, 1)
}

func parseHM(s string) (int, int) {
	parts := strings.Split(s, ":")
	h, _ := strconv.Atoi(firstOr(parts, 0, "0"))
	m, _ := strconv.Atoi(firstOr(parts, 1, "0"))
	return h, m
}

func firstOr(parts []string, i int, fallback string) string {
	if i < len(parts) && parts[i] != "" {
		return parts[i]
	}
	return fallback
}

// UpdateSettings updates attendance settings
func (ctrl *AdminSettingsController) UpdateSettings(c *gin.Context) {
	var req SettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request body", "INVALID_REQUEST")
		return
	}

	// Validate times are in HH:MM format
	openTime, err := time.Parse("15:04", req.AttendanceOpenTime)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid open time format, use HH:MM", "INVALID_TIME_FORMAT")
		return
	}

	closeTime, err := time.Parse("15:04", req.AttendanceCloseTime)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid close time format, use HH:MM", "INVALID_TIME_FORMAT")
		return
	}

	// Convert to HH:MM:SS format for storage
	openTimeStr := openTime.Format("15:04:00")
	closeTimeStr := closeTime.Format("15:04:00")

	// Validate open_days
	validDays := map[string]bool{
		"monday":    true,
		"tuesday":   true,
		"wednesday": true,
		"thursday":  true,
		"friday":    true,
		"saturday":  true,
		"sunday":    true,
	}

	for _, day := range req.OpenDays {
		normalized := ""
		for _, r := range day {
			if r >= 'A' && r <= 'Z' {
				normalized += string(r + 32)
			} else {
				normalized += string(r)
			}
		}
		normalized = strings.TrimSpace(normalized)
		if !validDays[normalized] {
			utils.RespondError(c, http.StatusBadRequest, "Invalid day name", "INVALID_DAY")
			return
		}
	}

	if !closeTime.After(openTime) {
		utils.RespondError(c, http.StatusBadRequest, "Close time must be after open time", "INVALID_TIME_RANGE")
		return
	}

	if len(req.OpenDays) == 0 {
		utils.RespondError(c, http.StatusBadRequest, "At least one open day is required", "INVALID_OPEN_DAYS")
		return
	}

	// Get current settings (update the singleton row)
	var settings models.Settings
	result := ctrl.DB.First(&settings)
	if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
		utils.RespondError(c, http.StatusInternalServerError, "Database error", "DB_ERROR")
		return
	}

	// Update settings
	settings.AttendanceOpenTime = openTimeStr
	settings.AttendanceCloseTime = closeTimeStr
	settings.OpenDays = req.OpenDays
	settings.UpdatedAt = time.Now().UTC()

	if err := ctrl.DB.Save(&settings).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to update settings", "DB_ERROR")
		return
	}

	response := SettingsResponse{
		ID:                  settings.ID.String(),
		AttendanceOpenTime:  settings.AttendanceOpenTime,
		AttendanceCloseTime: settings.AttendanceCloseTime,
		OpenDays:            settings.OpenDays,
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"data":    response,
		"message": "Settings updated successfully",
	})
}
