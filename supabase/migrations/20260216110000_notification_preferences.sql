-- User notification preferences (opt-in/opt-out per notification type).
-- Defaults: all enabled so existing behavior is preserved until user opts out.

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Per-type flags; default true = send notification
  mentions_enabled BOOLEAN NOT NULL DEFAULT true,
  job_assigned_enabled BOOLEAN NOT NULL DEFAULT true,
  signature_request_enabled BOOLEAN NOT NULL DEFAULT true,
  evidence_uploaded_enabled BOOLEAN NOT NULL DEFAULT true,
  hazard_added_enabled BOOLEAN NOT NULL DEFAULT true,
  deadline_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  high_risk_job_enabled BOOLEAN NOT NULL DEFAULT true,
  report_ready_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences (user_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification preferences"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE notification_preferences IS 'Per-user opt-out flags for push notification types. Defaults: all enabled.';
