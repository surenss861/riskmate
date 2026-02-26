-- Safe to run inside a transaction (e.g. SQL Editor).
CREATE INDEX IF NOT EXISTS idx_mitigation_items_org_created
  ON mitigation_items(organization_id, created_at);
