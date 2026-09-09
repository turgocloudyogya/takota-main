-- Migration: 2FA hardening - server-side pending secret, hashed backup
-- codes (single use), and WebAuthn/passkey credentials.
-- Created: 2026-09-10

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending_secret VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS passkey_enabled BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential JSONB NOT NULL,
    name VARCHAR(100) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id);
