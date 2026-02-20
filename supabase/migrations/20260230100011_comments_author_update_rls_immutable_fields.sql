-- Reapply author UPDATE policy with WITH CHECK so immutable fields cannot be changed by authors.
-- Deployed environments that already ran 20260225000000_add_comments.sql get the fix via this migration.

DROP POLICY IF EXISTS "Author can update own comments" ON comments;

CREATE POLICY "Author can update own comments"
  ON comments FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND author_id = auth.uid()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND author_id = auth.uid()
    AND entity_type = (SELECT c.entity_type FROM comments c WHERE c.id = comments.id)
    AND entity_id = (SELECT c.entity_id FROM comments c WHERE c.id = comments.id)
    AND (parent_id IS NOT DISTINCT FROM (SELECT c.parent_id FROM comments c WHERE c.id = comments.id))
    AND organization_id = (SELECT c.organization_id FROM comments c WHERE c.id = comments.id)
    AND author_id = (SELECT c.author_id FROM comments c WHERE c.id = comments.id)
    AND is_resolved IS NOT DISTINCT FROM (SELECT c.is_resolved FROM comments c WHERE c.id = comments.id)
    AND (resolved_by IS NOT DISTINCT FROM (SELECT c.resolved_by FROM comments c WHERE c.id = comments.id))
    AND (resolved_at IS NOT DISTINCT FROM (SELECT c.resolved_at FROM comments c WHERE c.id = comments.id))
  );
