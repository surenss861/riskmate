-- Add deep_link to notifications for in-app and push navigation (e.g. riskmate://jobs/123).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deep_link TEXT;

COMMENT ON COLUMN notifications.deep_link IS 'Optional riskmate:// URL to open when the user taps this notification (list or push).';
