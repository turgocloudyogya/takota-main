package middlewares

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AttendanceTimeMiddleware checks if attendance submission is currently allowed
func AttendanceTimeMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var settings models.Settings
		if err := db.First(&settings).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				// No settings found, allow attendance by default
				c.Next()
				return
			}
			utils.RespondError(c, http.StatusInternalServerError, "Failed to check attendance time", "DB_ERROR")
			c.Abort()
			return
		}

		now := utils.Now()
		isOpen := settings.IsAttendanceOpen(now, settings.OpenDays)

		if !isOpen {
			nextOpen := getNextAttendanceOpen(now, settings)
			c.JSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"status":     http.StatusForbidden,
					"message":    "Attendance is currently closed",
					"code":       "ATTENDANCE_CLOSED",
					"next_open":  nextOpen.Format(time.RFC3339),
					"open_time":  settings.AttendanceOpenTime,
					"close_time": settings.AttendanceCloseTime,
					"open_days":  settings.OpenDays,
				},
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// getNextAttendanceOpen calculates when attendance will next be open
func getNextAttendanceOpen(now time.Time, settings models.Settings) time.Time {
	validDays := make(map[string]bool)
	for _, day := range settings.OpenDays {
		validDays[day] = true
	}

	checkTime := now

	for {
		dayName := strings.ToLower(checkTime.Weekday().String())

		if validDays[dayName] {
			// Parse open time from string (HH:MM:SS)
			openTimeParts := strings.Split(settings.AttendanceOpenTime, ":")
			openHour, _ := strconv.Atoi(openTimeParts[0])
			openMin, _ := strconv.Atoi(openTimeParts[1])

			nextOpen := time.Date(checkTime.Year(), checkTime.Month(), checkTime.Day(),
				openHour, openMin, 0, 0, checkTime.Location())

			if nextOpen.After(checkTime) {
				return nextOpen
			}
		}

		// Move to next day
		checkTime = checkTime.AddDate(0, 0, 1)
		checkTime = time.Date(checkTime.Year(), checkTime.Month(), checkTime.Day(),
			0, 0, 0, 0, checkTime.Location())
	}
}
