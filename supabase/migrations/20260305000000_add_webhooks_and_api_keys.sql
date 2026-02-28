-- Webhook endpoints and delivery log for outbound webhooks (HMAC-signed events).
-- API keys table included per spec for future Public API (this ticket focuses on webhooks).

-- Webhook endpoints (one row per URL per org; events = subscribed event types).
-- Note: secret is stored in plaintext; only service_role and backend worker should access it.
-- RLS restricts user access to endpoints by org; consider encryption at rest if DB exposure is a concern.
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints(organization_id, is_active) WHERE is_active = true;

-- Webhook delivery log (one row per attempt per endpoint)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  attempt_count INTEGER DEFAULT 1,
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(next_retry_at)
  WHERE delivered_at IS NULL;

-- RLS: org-scoped access for webhook_endpoints and webhook_deliveries
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_endpoints_org ON webhook_endpoints;
CREATE POLICY webhook_endpoints_org ON webhook_endpoints
  FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS webhook_deliveries_via_endpoint ON webhook_deliveries;
CREATE POLICY webhook_deliveries_via_endpoint ON webhook_deliveries
  FOR ALL
  USING (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

-- Service role can manage all (for backend worker)
DROP POLICY IF EXISTS webhook_endpoints_service ON webhook_endpoints;
CREATE POLICY webhook_endpoints_service ON webhook_endpoints
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS webhook_deliveries_service ON webhook_deliveries;
CREATE POLICY webhook_deliveries_service ON webhook_deliveries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- API keys for Public API (org-scoped; key stored as hash, prefix for display)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Ensure columns exist if table was created by an earlier run with a different schema
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT NOT NULL DEFAULT '';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
-- Non-unique index for lookup; key_hash is the unique credential (see 20260309000000_api_keys_epic_schema.sql).
DROP INDEX IF EXISTS idx_api_keys_prefix;
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_keys_org ON api_keys;
CREATE POLICY api_keys_org ON api_keys
  FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS api_keys_service ON api_keys;
CREATE POLICY api_keys_service ON api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
