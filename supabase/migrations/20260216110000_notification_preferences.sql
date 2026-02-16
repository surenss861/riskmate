-- User notification preferences (opt-in/opt-out per notification type).
-- Master toggles: push_enabled, email_enabled. Per-type flags control specific notification types.
-- weekly_summary defaults to false per spec; other per-type defaults true.

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Master toggles: enable/disable push and email delivery
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Per-type flags; default true = send notification (except weekly_summary)
  mentions_enabled BOOLEAN NOT NULL DEFAULT true,
  job_assigned_enabled BOOLEAN NOT NULL DEFAULT true,
  signature_request_enabled BOOLEAN NOT NULL DEFAULT true,
  evidence_uploaded_enabled BOOLEAN NOT NULL DEFAULT true,
  hazard_added_enabled BOOLEAN NOT NULL DEFAULT true,
  deadline_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_summary_enabled BOOLEAN NOT NULL DEFAULT false,
  high_risk_job_enabled BOOLEAN NOT NULL DEFAULT true,
  report_ready_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
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

COMMENT ON TABLE notification_preferences IS 'Per-user notification preferences: push_enabled/email_enabled master toggles and per-type flags. weekly_summary defaults false.';
