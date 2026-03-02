-- Reconcile organization_members.role CHECK with webhook_admin_org_ids() and users.role vocabulary.
-- 20251128 created organization_members with role IN ('admin', 'employee', 'viewer'); webhook
-- functions (20260322) expect role IN ('owner', 'admin'). Add 'owner' and 'member' so both
-- organization_members and users.role (owner, admin, member) are supported.

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'employee', 'viewer'));
