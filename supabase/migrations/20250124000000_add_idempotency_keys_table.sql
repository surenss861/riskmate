-- Idempotency Keys Table
-- Short-lived table to prevent duplicate requests from double-clicks / retries / flaky networks
-- Keys are scoped by (organization_id, actor_id, endpoint) for isolation

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  response_headers JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- Short-lived: 24 hours default
  
  -- Unique constraint: same key + org + actor + endpoint = duplicate (prevents physical duplicates)
  CONSTRAINT idempotency_keys_unique UNIQUE(organization_id, actor_id, endpoint, idempotency_key)
);

-- Indexes for fast lookups and cleanup
-- Composite index for idempotency checks (covers unique constraint lookup)
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup 
  ON idempotency_keys(organization_id, actor_id, endpoint, idempotency_key);

-- Index for cleanup job (fast deletion of expired keys)
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at 
  ON idempotency_keys(expires_at);

-- Index for cleanup job alternative (if cleanup uses created_at instead)
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at 
  ON idempotency_keys(created_at);

-- Cleanup expired keys (run via cron or scheduled job)
-- DELETE FROM idempotency_keys WHERE expires_at < NOW();

COMMENT ON TABLE idempotency_keys IS 'Prevents duplicate processing of idempotent requests. Keys expire after 24 hours.';
COMMENT ON COLUMN idempotency_keys.idempotency_key IS 'Client-provided idempotency key (e.g., UUID)';
COMMENT ON COLUMN idempotency_keys.endpoint IS 'API endpoint path (e.g., /api/audit/readiness/resolve)';
COMMENT ON COLUMN idempotency_keys.response_status IS 'HTTP status code of the original response';
COMMENT ON COLUMN idempotency_keys.response_body IS 'Original response body (JSON)';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'When this key expires and can be reused (24h default)';

