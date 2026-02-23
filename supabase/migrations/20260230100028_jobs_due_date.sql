-- Add due_date to jobs for deadline reminders and API consistency (routes/templates use due_date).
-- Keep end_date for backward compatibility; due_date is the primary field for "when is this due".
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
UPDATE jobs SET due_date = end_date WHERE due_date IS NULL AND end_date IS NOT NULL;
COMMENT ON COLUMN jobs.due_date IS 'Primary due date for reminders and UI; may mirror end_date if not set separately.';
