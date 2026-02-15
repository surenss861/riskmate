-- Deletion log for sync: records mitigation item IDs when deleted so offline clients
-- can remove them from their cache (tombstone sync). Backend-only table (service role).
CREATE TABLE IF NOT EXISTS sync_mitigation_deletions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mitigation_item_id UUID NOT NULL,
  job_id UUID NOT NULL,
  hazard_id UUID, -- NULL = hazard deleted, set = control deleted
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id UUID NOT NULL,
  CONSTRAINT sync_mitigation_deletions_org_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_mitigation_deletions_org_deleted
  ON sync_mitigation_deletions(organization_id, deleted_at);

ALTER TABLE sync_mitigation_deletions ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (backend) can access
