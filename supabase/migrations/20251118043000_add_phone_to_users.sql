-- Add phone column to users table for profile editing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone TEXT;

