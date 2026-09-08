package seed

import (
	"time"

	"github.com/carakan/takota/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// defaultPasswordHash is the bcrypt hash of "testing123" (cost 12), the same
// hash used by the SQL seeder in 001_initial_schema.sql.
const defaultPasswordHash = "$2a$12$OALkkE/bU1ixifDSt/0ps.0decAhY6J0Qk2dv1MX.NueEcN87.SWK"

// Run makes sure the users table always contains at least one admin account,
// and the settings table has default values.
func Run(db *gorm.DB) error {
	now := time.Now().UTC()

	// Seed users
	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		var adminCount int64
		if err := db.Model(&models.User{}).Where("type = ?", "admin").Count(&adminCount).Error; err != nil {
			return err
		}
		if adminCount == 0 {
			if err := db.Create(&models.User{
				ID:        uuid.New(),
				Username:  "admin",
				Password:  defaultPasswordHash,
				Nickname:  "Administrator",
				Callname:  "Admin",
				Type:      "admin",
				CreatedAt: now,
				UpdatedAt: now,
			}).Error; err != nil {
				return err
			}
		}
	} else {
		if err := db.Create([]models.User{
			{
				ID:        uuid.New(),
				Username:  "admin",
				Password:  defaultPasswordHash,
				Nickname:  "Administrator",
				Callname:  "Admin",
				Type:      "admin",
				CreatedAt: now,
				UpdatedAt: now,
			},
			{
				ID:        uuid.New(),
				Username:  "user001",
				Password:  defaultPasswordHash,
				Nickname:  "Test User",
				Callname:  "User",
				Type:      "user",
				CreatedAt: now,
				UpdatedAt: now,
			},
		}).Error; err != nil {
			return err
		}
	}

	// Seed settings with defaults
	var settingsCount int64
	if err := db.Model(&models.Settings{}).Count(&settingsCount).Error; err != nil {
		return err
	}

	if settingsCount == 0 {
		defaultSettings := &models.Settings{
			ID:                    uuid.New(),
			AttendanceOpenTime:    "06:00:00",
			AttendanceCloseTime:   "21:00:00",
			OpenDays:              []string{"monday", "tuesday", "wednesday", "thursday", "friday"},
			CreatedAt:             now,
			UpdatedAt:             now,
		}
		if err := db.Create(defaultSettings).Error; err != nil {
			return err
		}
	}

	return nil
}
