-- Migration: Add 2FA (TOTP) Support to Users
-- Created: 2026-09-08

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_totp_enabled ON users(totp_enabled);
