package migrator

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

// versionTable tracks which migrations have already been applied so the
// migration runner is safe to run automatically on every startup, including
// against databases that were previously migrated manually.
const versionTable = "schema_migrations"

// Run applies all .sql files from fsys in alphabetical (version) order.
// Each migration runs inside a transaction together with its version record,
// so a failed migration rolls back completely.
func Run(db *gorm.DB, fsys fs.FS) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if err := db.WithContext(ctx).Exec(fmt.Sprintf(
		`CREATE TABLE IF NOT EXISTS %s (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`, versionTable,
	)).Error; err != nil {
		return fmt.Errorf("failed to create %s table: %w", versionTable, err)
	}

	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return fmt.Errorf("failed to read embedded migrations: %w", err)
	}

	var names []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		names = append(names, entry.Name())
	}
	sort.Strings(names)

	for _, name := range names {
		var count int64
		if err := db.WithContext(ctx).Table(versionTable).
			Where("version = ?", name).Count(&count).Error; err != nil {
			return fmt.Errorf("failed to check migration %s: %w", name, err)
		}
		if count > 0 {
			continue
		}

		content, err := fs.ReadFile(fsys, name)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", name, err)
		}

		log.Printf("[migrator] applying %s", name)
		err = db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(string(content)).Error; err != nil {
				return err
			}
			return tx.Exec(fmt.Sprintf(
				"INSERT INTO %s (version) VALUES (?)", versionTable,
			), name).Error
		})
		if err != nil {
			return fmt.Errorf("failed to apply migration %s: %w", name, err)
		}
	}

	return nil
}
