-- Align email_deadline_reminder with backend contract (DEFAULT_NOTIFICATION_PREFERENCES: true).
-- Ensures schema default and backfill match the code so deadline emails are on by default.

-- Backfill NULL to true (idempotent)
UPDATE notification_preferences
SET email_deadline_reminder = true
WHERE email_deadline_reminder IS NULL;

-- Set column default to true so new rows match backend contract
ALTER TABLE notification_preferences
  ALTER COLUMN email_deadline_reminder SET DEFAULT true;

COMMENT ON COLUMN notification_preferences.email_deadline_reminder IS 'Receive email reminders for approaching deadlines. Default true per backend contract.';