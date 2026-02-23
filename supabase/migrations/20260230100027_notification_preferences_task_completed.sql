-- Add task_completed preference so users can opt out of task completion notifications (push + email).
-- Default true; backfill NULL for existing rows.

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS task_completed BOOLEAN;

-- Backfill NULL to true (idempotent)
UPDATE notification_preferences
SET task_completed = true
WHERE task_completed IS NULL;

ALTER TABLE notification_preferences
  ALTER COLUMN task_completed SET NOT NULL,
  ALTER COLUMN task_completed SET DEFAULT true;

COMMENT ON COLUMN notification_preferences.task_completed IS 'Receive push and email when a task is completed. Default true.';
