-- Harden webhook signing secrets: move them to a service-role-only table so authenticated
-- users cannot read secrets via direct table access or accidental select('*'), preserving
-- one-time secret disclosure and preventing forged webhook signatures.

-- Table: only service_role can read/write. No policy for authenticated.
CREATE TABLE IF NOT EXISTS webhook_endpoint_secrets (
  endpoint_id UUID PRIMARY KEY REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  secret TEXT NOT NULL
);

ALTER TABLE webhook_endpoint_secrets ENABLE ROW LEVEL SECURITY;

-- No policy for authenticated: they cannot SELECT/INSERT/UPDATE/DELETE.
-- Only service_role gets full access (default for service_role when no policy applies is no access in some configs; we grant explicitly).
DROP POLICY IF EXISTS webhook_endpoint_secrets_service ON webhook_endpoint_secrets;
CREATE POLICY webhook_endpoint_secrets_service ON webhook_endpoint_secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Revoke all from authenticated so direct client access never sees secrets
REVOKE ALL ON webhook_endpoint_secrets FROM authenticated;
GRANT ALL ON webhook_endpoint_secrets TO service_role;

COMMENT ON TABLE webhook_endpoint_secrets IS 'Signing secrets for webhook endpoints. Service-role only; never exposed to authenticated users after creation.';

-- Migrate existing secrets from webhook_endpoints into the new table
INSERT INTO webhook_endpoint_secrets (endpoint_id, secret)
  SELECT id, secret FROM webhook_endpoints WHERE secret IS NOT NULL AND secret != ''
  ON CONFLICT (endpoint_id) DO NOTHING;

-- Remove secret from broadly readable table
ALTER TABLE webhook_endpoints DROP COLUMN IF EXISTS secret;
