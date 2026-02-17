-- Reintroduce organization_id on notifications (for DBs that ran the old 16120000 which dropped it).
-- Keep organization_id: add column if missing, backfill NULLs from users then organization_members,
-- then set NOT NULL; update indexes and RLS in place. No DELETE of NULL rows (no data loss).

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill NULLs from users, then from organization_members
UPDATE notifications n
SET organization_id = (SELECT u.organization_id FROM users u WHERE u.id = n.user_id LIMIT 1)
WHERE n.organization_id IS NULL;

UPDATE notifications n
SET organization_id = (
  SELECT om.organization_id FROM organization_members om WHERE om.user_id = n.user_id LIMIT 1
)
WHERE n.organization_id IS NULL;

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