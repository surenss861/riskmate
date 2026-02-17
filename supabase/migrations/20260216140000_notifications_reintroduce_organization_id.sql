-- Reintroduce organization_id on notifications so records and badge counts are scoped by org (no cross-org pollution).
-- Add column nullable, backfill from users.organization_id, then set NOT NULL; update indexes and RLS.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill: one org per user from users table
UPDATE notifications n
SET organization_id = (SELECT u.organization_id FROM users u WHERE u.id = n.user_id LIMIT 1)
WHERE n.organization_id IS NULL;

-- Orphaned rows (no user or user has no org): leave NULL and exclude from NOT NULL by deleting or assigning.
-- Assign any remaining to first org the user belongs to via organization_members if available
UPDATE notifications n
SET organization_id = (
  SELECT om.organization_id FROM organization_members om WHERE om.user_id = n.user_id LIMIT 1
)
WHERE n.organization_id IS NULL;

-- Remove notifications that cannot be assigned an org (orphans)
DELETE FROM notifications WHERE organization_id IS NULL;

ALTER TABLE notifications ALTER COLUMN organization_id SET NOT NULL;

-- Indexes for org-scoped queries (user_id + organization_id)
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_user_id_is_read;
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_org ON notifications (user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_org_is_read ON notifications (user_id, organization_id, is_read);

-- RLS: scope by both user_id and caller's organization (get_user_organization_id())
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() AND organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid() AND organization_id = get_user_organization_id())
  WITH CHECK (user_id = auth.uid() AND organization_id = get_user_organization_id());

-- Allow inserts for current user + current org (backend service role bypasses RLS)
DROP POLICY IF EXISTS "System can create notifications for users" ON notifications;
CREATE POLICY "Users can create own notifications in current org"
  ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid() AND organization_id = get_user_organization_id());

COMMENT ON COLUMN notifications.organization_id IS 'Organization this notification belongs to; badge and list are scoped per org.';