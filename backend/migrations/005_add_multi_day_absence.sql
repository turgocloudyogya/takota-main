-- Migration: Add Multi-day Absence Support
-- Created: 2026-09-08

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS absence_start_date TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS absence_end_date TIMESTAMPTZ DEFAULT NULL;

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_attendance_absence_dates ON attendance(absence_start_date, absence_end_date) WHERE type = 'absence';
