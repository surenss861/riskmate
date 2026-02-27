-- Per-attempt log for webhook deliveries so each send attempt is immutable and visible in logs.
CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES webhook_deliveries(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_attempts_delivery ON webhook_delivery_attempts(delivery_id);

ALTER TABLE webhook_delivery_attempts ENABLE ROW LEVEL SECURITY;

-- Same org-scoped access as webhook_deliveries (via delivery -> endpoint -> org)
CREATE POLICY webhook_delivery_attempts_via_delivery ON webhook_delivery_attempts
  FOR ALL
  USING (
    delivery_id IN (
      SELECT wd.id FROM webhook_deliveries wd
      JOIN webhook_endpoints we ON we.id = wd.endpoint_id
      WHERE we.organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    delivery_id IN (
      SELECT wd.id FROM webhook_deliveries wd
      JOIN webhook_endpoints we ON we.id = wd.endpoint_id
      WHERE we.organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY webhook_delivery_attempts_service ON webhook_delivery_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
