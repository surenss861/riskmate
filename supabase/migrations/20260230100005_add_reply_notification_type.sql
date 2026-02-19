-- Add 'reply' to allowed notification types (for comment reply notifications) and add reply preference.

-- Notifications: allow type 'reply' in CHECK constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'risk_alert', 'job_reminder', 'mitigation_due', 'report_generated', 'subscription_update',
    'high_risk_job', 'report_ready', 'weekly_summary', 'push', 'job_assigned',
    'signature_request', 'evidence_uploaded', 'hazard_added', 'deadline', 'mention', 'reply'
  )
);

-- Notification preferences: add reply (comment reply notifications), default on
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS reply BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN notification_preferences.reply IS 'Receive notifications when someone replies to your comment.';
