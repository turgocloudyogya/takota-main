-- Migration: Add Settings Table for Attendance Configuration
-- Created: 2026-09-08

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_open_time VARCHAR(8) DEFAULT '06:00:00',
    attendance_close_time VARCHAR(8) DEFAULT '21:00:00',
    open_days JSONB DEFAULT '["monday", "tuesday", "wednesday", "thursday", "friday"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for settings updated_at
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings (one row, treated as singleton)
INSERT INTO settings (attendance_open_time, attendance_close_time, open_days)
VALUES (
    '06:00:00',
    '21:00:00',
    '["monday", "tuesday", "wednesday", "thursday", "friday"]'::jsonb
)
ON CONFLICT DO NOTHING;
