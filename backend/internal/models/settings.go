package models

import (
	"database/sql/driver"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Settings struct {
	ID                   uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	AttendanceOpenTime   string    `gorm:"type:varchar(8);default:'06:00:00'" json:"attendance_open_time"`
	AttendanceCloseTime  string    `gorm:"type:varchar(8);default:'21:00:00'" json:"attendance_close_time"`
	OpenDays             OpenDays  `gorm:"type:jsonb;default:'[\"monday\",\"tuesday\",\"wednesday\",\"thursday\",\"friday\"]'" json:"open_days"`
	CreatedAt            time.Time `gorm:"type:timestamptz;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt            time.Time `gorm:"type:timestamptz;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

type OpenDays []string

func (od OpenDays) Value() (driver.Value, error) {
	return json.Marshal(od)
}

func (od *OpenDays) Scan(value interface{}) error {
	switch v := value.(type) {
	case []byte:
		if len(v) == 0 {
			*od = OpenDays{}
			return nil
		}
		return json.Unmarshal(v, od)
	case string:
		if v == "" {
			*od = OpenDays{}
			return nil
		}
		return json.Unmarshal([]byte(v), od)
	default:
		*od = OpenDays{}
		return nil
	}
}

func (Settings) TableName() string {
	return "settings"
}

// GetSettings retrieves the singleton settings row
func (s *Settings) IsAttendanceOpen(now time.Time, openDays []string) bool {
	dayName := strings.ToLower(now.Weekday().String())
	isOpenDay := false
	for _, d := range openDays {
		if strings.ToLower(d) == dayName {
			isOpenDay = true
			break
		}
	}
	if !isOpenDay {
		return false
	}

	// Check if time is within open hours
	currentTime := now.Format("15:04:05")
	openTime := s.AttendanceOpenTime
	closeTime := s.AttendanceCloseTime

	return currentTime >= openTime && currentTime < closeTime
}

// NextOpen returns the next datetime attendance opens at or after now,
// honouring open days and the daily open time.
func (s *Settings) NextOpen(now time.Time, openDays []string) time.Time {
	valid := map[string]bool{}
	for _, d := range openDays {
		valid[strings.ToLower(strings.TrimSpace(d))] = true
	}
	parts := strings.Split(s.AttendanceOpenTime, ":")
	hour, _ := strconv.Atoi(firstOr(parts, 0, "6"))
	min, _ := strconv.Atoi(firstOr(parts, 1, "0"))

	check := now
	for i := 0; i < 8; i++ {
		if valid[strings.ToLower(check.Weekday().String())] {
			candidate := time.Date(check.Year(), check.Month(), check.Day(),
				hour, min, 0, 0, check.Location())
			if !candidate.Before(check) {
				return candidate
			}
		}
		next := check.AddDate(0, 0, 1)
		check = time.Date(next.Year(), next.Month(), next.Day(), 0, 0, 0, 0, next.Location())
	}
	return now
}

func firstOr(parts []string, i int, fallback string) string {
	if i < len(parts) && parts[i] != "" {
		return parts[i]
	}
	return fallback
}
