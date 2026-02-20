-- Add job_comment and comment_resolved notification types and preferences.

-- Notifications: allow types 'job_comment', 'comment_resolved', and task types (task_assigned, task_completed, task_overdue)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'risk_alert', 'job_reminder', 'mitigation_due', 'report_generated', 'subscription_update',
    'high_risk_job', 'report_ready', 'weekly_summary', 'push', 'job_assigned',
    'signature_request', 'evidence_uploaded', 'hazard_added', 'deadline', 'mention', 'reply',
    'job_comment', 'comment_resolved',
    'task_assigned', 'task_completed', 'task_overdue'
  )
);

-- Notification preferences: job_comment (comment on a job you own), comment_resolved (your comment was resolved)
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS job_comment BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS comment_resolved BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN notification_preferences.job_comment IS 'Receive notifications when someone comments on a job you own.';
COMMENT ON COLUMN notification_preferences.comment_resolved IS 'Receive notifications when someone resolves your comment.';
