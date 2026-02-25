CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mitigation_items_org_created
  ON mitigation_items(organization_id, created_at);
