-- Backfill notification_preferences: add push_enabled, email_enabled and set weekly_summary_enabled default to false.
-- Safe to run if columns already exist (e.g. from updated 20260216110000).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'push_enabled'
  ) THEN
    ALTER TABLE notification_preferences ADD COLUMN push_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'email_enabled'
  ) THEN
    ALTER TABLE notification_preferences ADD COLUMN email_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

ALTER TABLE notification_preferences ALTER COLUMN weekly_summary_enabled SET DEFAULT false;
