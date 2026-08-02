package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/carakan/takota/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(cfg *config.Config) error {
	var err error

	// Build DSN
	dsn := cfg.GetDSN()

	// Configure GORM logger
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	if cfg.Server.AppEnv == "production" {
		gormConfig.Logger = logger.Default.LogMode(logger.Error)
	}

	// Connect to database with retry so the container can start before
	// Postgres is ready and then run migrations automatically once it is up.
	const maxAttempts = 15
	var sqlDB *sql.DB
	for connectAttempts := 1; ; connectAttempts++ {
		// Close any pool created by a previous (failed) attempt so we never
		// leak connections or leave multiple pgx pools hitting the same backend.
		if DB != nil {
			if prev, err := DB.DB(); err == nil {
				_ = prev.Close()
			}
		}

		DB, err = gorm.Open(postgres.Open(dsn), gormConfig)
		if err == nil {
			sqlDB, err = DB.DB()
			if err == nil {
				err = sqlDB.Ping()
				if err == nil {
					sqlDB.SetMaxOpenConns(cfg.Database.MaxConnections)
					sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
					sqlDB.SetConnMaxLifetime(time.Hour)
					break
				}
			}
		}
		if connectAttempts >= maxAttempts {
			return fmt.Errorf("failed to connect to database after %d attempts: %w", maxAttempts, err)
		}
		log.Printf("⚠ Database not ready (attempt %d/%d), retrying in 3s...", connectAttempts, maxAttempts)
		time.Sleep(3 * time.Second)
	}

	log.Println("✓ Database connected successfully")

	return nil
}

func CloseDB() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func GetDB() *gorm.DB {
	return DB
}
