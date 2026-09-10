-- Migration: Add Push Subscription Support for Web Notifications
-- Created: 2026-09-08

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_push_subscription ON users USING GIN (push_subscription);
