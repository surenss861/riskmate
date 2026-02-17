-- Notification preferences table per ticket contract.
-- Primary key: user_id referencing auth.users(id). Column names: job_assigned, signature_requested, deadline_approaching, mention, etc. (no *_enabled suffix).
-- Defaults: weekly_summary false, others true.

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  mention BOOLEAN NOT NULL DEFAULT true,
  job_assigned BOOLEAN NOT NULL DEFAULT true,
  signature_requested BOOLEAN NOT NULL DEFAULT true,
  evidence_uploaded BOOLEAN NOT NULL DEFAULT true,
  hazard_added BOOLEAN NOT NULL DEFAULT true,
  deadline_approaching BOOLEAN NOT NULL DEFAULT true,
  weekly_summary BOOLEAN NOT NULL DEFAULT false,
  high_risk_job BOOLEAN NOT NULL DEFAULT true,
  report_ready BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences (user_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notification preferences" ON notification_preferences;
CREATE POLICY "Users can read own notification preferences"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notification preferences" ON notification_preferences;
CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE notification_preferences IS 'Per-user notification preferences (contract keys: job_assigned, signature_requested, deadline_approaching, mention, etc.). weekly_summary default false.';
