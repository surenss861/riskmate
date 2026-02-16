-- Notifications table: ALTER existing table to match new API schema.
-- Backend inserts via createNotificationRecord, reads/updates via listNotifications and markNotificationsAsRead.
-- Adds content, is_read (ensured NOT NULL), updated_at; drops legacy organization_id, title, message, link;
-- replaces type CHECK with new notification types; recreates indexes and RLS policies.

-- Add new columns (content/updated_at may already exist from comprehensive_restructure)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Backfill content from legacy message (or title) only when those columns exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'message') THEN
    UPDATE notifications SET content = COALESCE(message, title, '') WHERE content IS NULL;
  END IF;
  UPDATE notifications SET content = '' WHERE content IS NULL;
END $$;

ALTER TABLE notifications ALTER COLUMN content SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN updated_at SET DEFAULT NOW();
UPDATE notifications SET updated_at = COALESCE(updated_at, created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE notifications ALTER COLUMN updated_at SET NOT NULL;

-- Drop foreign key and legacy columns
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_organization_id_fkey;
ALTER TABLE notifications DROP COLUMN IF EXISTS organization_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS title;
ALTER TABLE notifications DROP COLUMN IF EXISTS message;
ALTER TABLE notifications DROP COLUMN IF EXISTS link;

-- Replace type CHECK constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'risk_alert', 'job_reminder', 'mitigation_due', 'report_generated', 'subscription_update',
    'high_risk_job', 'report_ready', 'weekly_summary', 'push', 'job_assigned',
    'signature_request', 'evidence_uploaded', 'hazard_added', 'deadline', 'mention'
  )
);

-- Ensure is_read is NOT NULL DEFAULT false
UPDATE notifications SET is_read = false WHERE is_read IS NULL;
ALTER TABLE notifications ALTER COLUMN is_read SET DEFAULT false;
ALTER TABLE notifications ALTER COLUMN is_read SET NOT NULL;

-- Drop old policies (including org-based INSERT)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications for users" ON notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Recreate indexes
DROP INDEX IF EXISTS idx_notifications_user;
DROP INDEX IF EXISTS idx_notifications_unread;
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP INDEX IF EXISTS idx_notifications_created_at;
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON notifications (user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE notifications IS 'In-app notification records; backend inserts for badge/unread count, users read and mark as read.';
