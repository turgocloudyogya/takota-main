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

// Run makes sure the users table always contains at least one admin account.
// It mirrors the SQL seeder in 001_initial_schema.sql so a fresh database gets
// the same default users, and an existing database where every user was deleted
// is re-seeded on the next startup instead of being left without an admin.
func Run(db *gorm.DB) error {
	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		var adminCount int64
		if err := db.Model(&models.User{}).Where("type = ?", "admin").Count(&adminCount).Error; err != nil {
			return err
		}
		if adminCount > 0 {
			return nil
		}
		return db.Create(&models.User{
			ID:        uuid.New(),
			Username:  "admin",
			Password:  defaultPasswordHash,
			Nickname:  "Administrator",
			Callname:  "Admin",
			Type:      "admin",
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		}).Error
	}

	now := time.Now().UTC()
	return db.Create([]models.User{
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
	}).Error
}
