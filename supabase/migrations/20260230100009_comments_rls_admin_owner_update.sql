-- RLS: allow organization owner/admin to update comments (resolve, unresolve, soft-delete).
-- Keeps INSERT author-only and retains soft-delete via UPDATE. Author-only UPDATE policy remains;
-- this adds a second UPDATE policy so admin/owner flows succeed (API already allows them).

DROP POLICY IF EXISTS "Org admin or owner can update comments in their organization" ON comments;
CREATE POLICY "Org admin or owner can update comments in their organization"
  ON comments FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND public.org_role(organization_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND public.org_role(organization_id) IN ('owner', 'admin')
  );

COMMENT ON POLICY "Org admin or owner can update comments in their organization" ON comments IS 'Allows org owner/admin to update comments (resolve, unresolve, soft-delete) in addition to author-only policy.';
