-- Ensure notification_preferences has email_deadline_reminder and email_weekly_digest
-- with NOT NULL DEFAULT true so the API contract (NotificationPreferences) matches the schema.

-- Add columns if missing (some environments may have them from 20260218123000 without NOT NULL)
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS email_deadline_reminder BOOLEAN DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS email_weekly_digest BOOLEAN DEFAULT true;

-- Backfill nulls and enforce NOT NULL + default
UPDATE notification_preferences
  SET email_deadline_reminder = COALESCE(email_deadline_reminder, true)
  WHERE email_deadline_reminder IS NULL;

UPDATE notification_preferences
  SET email_weekly_digest = COALESCE(email_weekly_digest, true)
  WHERE email_weekly_digest IS NULL;

ALTER TABLE notification_preferences
  ALTER COLUMN email_deadline_reminder SET NOT NULL,
  ALTER COLUMN email_deadline_reminder SET DEFAULT true;

ALTER TABLE notification_preferences
  ALTER COLUMN email_weekly_digest SET NOT NULL,
  ALTER COLUMN email_weekly_digest SET DEFAULT true;

COMMENT ON COLUMN notification_preferences.email_deadline_reminder IS 'Receive email reminders for approaching deadlines.';
COMMENT ON COLUMN notification_preferences.email_weekly_digest IS 'Receive weekly digest emails.';
