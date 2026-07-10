-- Migration: Add sign_status to attendance table
-- Purpose: Track approval status for absence requests (allow/reject)
-- Created: 2026-07-07

-- Add sign_status column to attendance table
ALTER TABLE attendance 
ADD COLUMN sign_status VARCHAR(20) DEFAULT NULL;

-- Create index for sign_status queries
CREATE INDEX IF NOT EXISTS idx_attendance_sign_status ON attendance(sign_status);

-- Add comment
COMMENT ON COLUMN attendance.sign_status IS 'Approval status for absence: allow, reject, or NULL (pending)';
