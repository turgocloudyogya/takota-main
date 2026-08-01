-- Migration: Initial Schema for Takota
-- Created: 2026-07-07

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(150) NOT NULL,
    callname VARCHAR(50) NOT NULL,
    auth_id TEXT DEFAULT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'user',
    change_as_login BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    option VARCHAR(20) DEFAULT NULL,
    reason TEXT DEFAULT NULL,
    photo VARCHAR(255) DEFAULT NULL,
    file VARCHAR(255) DEFAULT NULL,
    latitude VARCHAR(50) DEFAULT NULL,
    longitude VARCHAR(50) DEFAULT NULL,
    gmaps_embed TEXT DEFAULT NULL,
    verify_by UUID DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_type ON attendance(type);
CREATE INDEX IF NOT EXISTS idx_attendance_created_at ON attendance(created_at);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for attendance table
DROP TRIGGER IF EXISTS update_attendance_updated_at ON attendance;
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: testing123)
-- Password hash generated using bcrypt with cost 10
INSERT INTO users (id, username, password, nickname, callname, type, change_as_login)
VALUES (
    uuid_generate_v4(),
    'admin',
    '$2a$12$OALkkE/bU1ixifDSt/0ps.0decAhY6J0Qk2dv1MX.NueEcN87.SWK',
    'Administrator',
    'Admin',
    'admin',
    FALSE
) ON CONFLICT (username) DO NOTHING;

-- Insert test user (password: testing123)
INSERT INTO users (id, username, password, nickname, callname, type, change_as_login)
VALUES (
    uuid_generate_v4(),
    'user001',
    '$2a$12$OALkkE/bU1ixifDSt/0ps.0decAhY6J0Qk2dv1MX.NueEcN87.SWK',
    'Test User',
    'User',
    'user',
    FALSE
) ON CONFLICT (username) DO NOTHING;
