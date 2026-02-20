-- Comments: first-class comments on jobs, hazards, controls, tasks, documents, signoffs, photos.
-- Schema per ticket: mentions as UUID[], is_resolved, resolved_by/at, edited_at, deleted_at (soft delete).
-- References auth.users and organizations; indexes for entity, parent, author; realtime enabled.
-- No separate comment_mentions table (mentions stored on comments.mentions).

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'hazard', 'control', 'task', 'document', 'signoff', 'photo')),
  entity_id UUID NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if table already existed from an older migration (e.g. without deleted_at).
ALTER TABLE comments ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_comments_entity_type_entity_id ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_organization_id ON comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON comments(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- RLS: org-scoped; use get_user_organization_id() for consistency with notifications/tasks pattern.
DROP POLICY IF EXISTS "Users can read comments in their organization" ON comments;
CREATE POLICY "Users can read comments in their organization"
  ON comments FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create comments in their organization" ON comments;
CREATE POLICY "Users can create comments in their organization"
  ON comments FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- UPDATE: author can update own comments; org admin/owner can update any comment in org (e.g. resolve/unresolve).
DROP POLICY IF EXISTS "Users can update comments in their organization" ON comments;
DROP POLICY IF EXISTS "Author or admin can update comments" ON comments;
CREATE POLICY "Author can update own comments"
  ON comments FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND author_id = auth.uid()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND author_id = auth.uid()
  );

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

-- No DELETE policy: soft delete only. Authors/admins set deleted_at via UPDATE to preserve rows and avoid cascading replies.

COMMENT ON TABLE comments IS 'First-class comments on entities (job, hazard, control, task, document, signoff, photo); supports threads via parent_id; mentions as UUID[]; soft delete via deleted_at.';

-- Realtime: enable for comments so clients can subscribe to new/updated comments.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  END IF;
END $$;
