-- Comments & Mentions: first-class comments on jobs, hazards, controls, tasks, etc.
-- Supports threads (parent_id), mentions (comment_mentions), and org-scoped RLS.

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'hazard', 'control', 'task', 'document', 'signoff')),
  entity_id UUID NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comments_organization ON comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_comment ON comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_user ON comment_mentions(user_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_mentions ENABLE ROW LEVEL SECURITY;

-- RLS: org-scoped; use get_user_organization_id() for consistency with notifications/tasks pattern
DROP POLICY IF EXISTS "Users can read comments in their organization" ON comments;
CREATE POLICY "Users can read comments in their organization"
  ON comments FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create comments in their organization" ON comments;
CREATE POLICY "Users can create comments in their organization"
  ON comments FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update comments in their organization" ON comments;
CREATE POLICY "Users can update comments in their organization"
  ON comments FOR UPDATE
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete comments in their organization" ON comments;
CREATE POLICY "Users can delete comments in their organization"
  ON comments FOR DELETE
  USING (organization_id = get_user_organization_id());

-- comment_mentions: readable/insertable when user can see the comment (via comment's org)
DROP POLICY IF EXISTS "Users can read comment mentions in their organization" ON comment_mentions;
CREATE POLICY "Users can read comment mentions in their organization"
  ON comment_mentions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_mentions.comment_id
        AND c.organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Users can create comment mentions in their organization" ON comment_mentions;
CREATE POLICY "Users can create comment mentions in their organization"
  ON comment_mentions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_mentions.comment_id
        AND c.organization_id = get_user_organization_id()
    )
  );

-- No UPDATE/DELETE on comment_mentions (add if needed later; for now mentions are append-only with comment)

COMMENT ON TABLE comments IS 'First-class comments on entities (job, hazard, control, task, etc.); supports threads via parent_id.';
COMMENT ON TABLE comment_mentions IS 'Mentioned users per comment; used for notifications and badge.';
