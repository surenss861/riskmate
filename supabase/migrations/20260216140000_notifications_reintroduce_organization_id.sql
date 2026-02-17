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

-- Preserve history: do not delete rows. Assign fallback org for any remaining NULL organization_id.
DO $$
DECLARE
  null_count bigint;
  fallback_org_id uuid;
BEGIN
  SELECT COUNT(*) INTO null_count FROM notifications WHERE organization_id IS NULL;
  IF null_count > 0 THEN
    SELECT id INTO fallback_org_id FROM organizations ORDER BY id LIMIT 1;
    IF fallback_org_id IS NOT NULL THEN
      UPDATE notifications SET organization_id = fallback_org_id WHERE organization_id IS NULL;
      RAISE NOTICE 'Assigned fallback organization_id to % notification(s) that could not be backfilled from user/org membership', null_count;
    ELSE
      RAISE EXCEPTION 'Cannot set NOT NULL organization_id: % notification(s) have NULL and no fallback organization exists. Fix data manually and re-run migration.', null_count;
    END IF;
  END IF;
END $$;

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
DROP POLICY IF EXISTS "Users can create own notifications in current org" ON notifications;
CREATE POLICY "Users can create own notifications in current org"
  ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid() AND organization_id = get_user_organization_id());

COMMENT ON COLUMN notifications.organization_id IS 'Organization this notification belongs to; badge and list are scoped per org.';