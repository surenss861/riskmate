-- Backfill: migrate notification_preferences from *_enabled columns to contract keys (job_assigned, mention, etc.)
-- Run only when table exists with old schema (job_assigned_enabled). Idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'job_assigned_enabled'
  ) THEN
    -- Add new contract columns
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS mention BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS job_assigned BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS signature_requested BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS evidence_uploaded BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS hazard_added BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS deadline_approaching BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS weekly_summary BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS high_risk_job BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS report_ready BOOLEAN NOT NULL DEFAULT true;

    -- Backfill from old columns
    UPDATE notification_preferences SET
      mention = COALESCE(mentions_enabled, true),
      job_assigned = COALESCE(job_assigned_enabled, true),
      signature_requested = COALESCE(signature_request_enabled, true),
      evidence_uploaded = COALESCE(evidence_uploaded_enabled, true),
      hazard_added = COALESCE(hazard_added_enabled, true),
      deadline_approaching = COALESCE(deadline_enabled, true),
      weekly_summary = COALESCE(weekly_summary_enabled, false),
      high_risk_job = COALESCE(high_risk_job_enabled, true),
      report_ready = COALESCE(report_ready_enabled, true)
    WHERE true;

    -- Drop old per-type columns
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS mentions_enabled;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS job_assigned_enabled;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS signature_request_enabled;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS evidence_uploaded_enabled;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS hazard_added_enabled;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS deadline_enabled;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS weekly_summary_enabled;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS high_risk_job_enabled;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS report_ready_enabled;

    -- Switch to user_id as primary key (drop id PK and id column)
    ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_pkey;
    ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_key;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS id;
    ALTER TABLE notification_preferences ADD PRIMARY KEY (user_id);

    -- Ensure user_id references auth.users (drop old FK to users(id) if present, add auth.users)
    ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;
    ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
