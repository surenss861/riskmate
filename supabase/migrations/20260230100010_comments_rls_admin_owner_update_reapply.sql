-- Re-apply comments RLS policy so deployed environments get the corrected row comparison.
-- Editing an already-applied migration does not run again; this migration ensures the
-- policy is dropped and recreated with the correct definition everywhere.

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
    AND (content, mentions, author_id, entity_type, entity_id, parent_id) IS NOT DISTINCT FROM (
      SELECT (c.content, c.mentions, c.author_id, c.entity_type, c.entity_id, c.parent_id)
      FROM comments c
      WHERE c.id = comments.id
    )
  );

COMMENT ON POLICY "Org admin or owner can update comments in their organization" ON comments IS 'Allows org owner/admin to update only resolve/soft-delete fields; immutable fields must be unchanged.';
