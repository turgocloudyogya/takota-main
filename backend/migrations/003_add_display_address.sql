-- Migration: Add display_address to attendance table
-- Purpose: Store reverse-geocoded address for attendance records so the
--          frontend home and admin attendance list can show a human-readable
--          location instead of raw coordinates.
-- Created: 2026-08-01

ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS display_address TEXT DEFAULT NULL;
