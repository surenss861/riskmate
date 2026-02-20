-- Re-apply author UPDATE policy so authors can change is_resolved, resolved_by, resolved_at
-- for their own comments (resolve/unresolve). Fixes RLS blocking author resolve/unresolve.

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
  );
