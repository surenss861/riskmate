-- Align notification_preferences schema with backend contract (NotificationPreferences).
-- Ensures all contract columns exist with correct defaults; migrates from legacy *_enabled
-- columns where present; drops legacy columns. RLS policies are unchanged (table-level).

-- 1) Add all contract columns if missing (defaults per DEFAULT_NOTIFICATION_PREFERENCES)
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS mention BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS reply BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS job_assigned BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS signature_requested BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS evidence_uploaded BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS hazard_added BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS deadline_approaching BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_deadline_reminder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS weekly_summary BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_weekly_digest BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS high_risk_job BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS report_ready BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS job_comment BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS comment_resolved BOOLEAN NOT NULL DEFAULT true;

-- 2) Backfill from legacy columns where they exist, then drop legacy columns
DO $$
BEGIN
  -- mention <- mentions_enabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'mentions_enabled') THEN
    UPDATE notification_preferences SET mention = COALESCE(mentions_enabled, true) WHERE true;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS mentions_enabled;
  END IF;
  -- job_assigned <- job_assigned_enabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'job_assigned_enabled') THEN
    UPDATE notification_preferences SET job_assigned = COALESCE(job_assigned_enabled, true) WHERE true;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS job_assigned_enabled;
  END IF;
  -- signature_requested <- signature_request_enabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'signature_request_enabled') THEN
    UPDATE notification_preferences SET signature_requested = COALESCE(signature_request_enabled, true) WHERE true;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS signature_request_enabled;
  END IF;
  -- evidence_uploaded <- evidence_uploaded_enabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'evidence_uploaded_enabled') THEN
    UPDATE notification_preferences SET evidence_uploaded = COALESCE(evidence_uploaded_enabled, true) WHERE true;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS evidence_uploaded_enabled;
  END IF;
  -- hazard_added <- hazard_added_enabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'hazard_added_enabled') THEN
    UPDATE notification_preferences SET hazard_added = COALESCE(hazard_added_enabled, true) WHERE true;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS hazard_added_enabled;
  END IF;
  -- deadline_approaching <- deadline_enabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'deadline_enabled') THEN
    UPDATE notification_preferences SET deadline_approaching = COALESCE(deadline_enabled, true) WHERE true;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS deadline_enabled;
  END IF;
  -- weekly_summary <- weekly_summary_enabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'weekly_summary_enabled') THEN
    UPDATE notification_preferences SET weekly_summary = COALESCE(weekly_summary_enabled, false) WHERE true;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS weekly_summary_enabled;
  END IF;
  -- high_risk_job <- high_risk_job_enabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'high_risk_job_enabled') THEN
    UPDATE notification_preferences SET high_risk_job = COALESCE(high_risk_job_enabled, true) WHERE true;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS high_risk_job_enabled;
  END IF;
  -- report_ready <- report_ready_enabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'report_ready_enabled') THEN
    UPDATE notification_preferences SET report_ready = COALESCE(report_ready_enabled, true) WHERE true;
    ALTER TABLE notification_preferences DROP COLUMN IF EXISTS report_ready_enabled;
  END IF;
END $$;

-- 3) Ensure email_* and any nullable contract columns are NOT NULL with default (idempotent)
UPDATE notification_preferences SET email_deadline_reminder = COALESCE(email_deadline_reminder, false) WHERE email_deadline_reminder IS NULL;
UPDATE notification_preferences SET email_weekly_digest = COALESCE(email_weekly_digest, true) WHERE email_weekly_digest IS NULL;

ALTER TABLE notification_preferences ALTER COLUMN email_deadline_reminder SET NOT NULL;
ALTER TABLE notification_preferences ALTER COLUMN email_deadline_reminder SET DEFAULT false;
ALTER TABLE notification_preferences ALTER COLUMN email_weekly_digest SET NOT NULL;
ALTER TABLE notification_preferences ALTER COLUMN email_weekly_digest SET DEFAULT true;

COMMENT ON TABLE notification_preferences IS 'Per-user notification preferences matching backend contract: push_enabled, email_enabled, mention, reply, job_assigned, signature_requested, evidence_uploaded, hazard_added, deadline_approaching, email_deadline_reminder, weekly_summary, email_weekly_digest, high_risk_job, report_ready, job_comment, comment_resolved. weekly_summary and email_deadline_reminder default false; others true.';
