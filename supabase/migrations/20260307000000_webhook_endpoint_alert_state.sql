-- Deduplicate admin alerts for webhook delivery failures (one alert per endpoint per cooldown).
CREATE TABLE IF NOT EXISTS webhook_endpoint_alert_state (
  endpoint_id UUID NOT NULL PRIMARY KEY REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  last_alert_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoint_alert_state_last_alert
  ON webhook_endpoint_alert_state(last_alert_at);

COMMENT ON TABLE webhook_endpoint_alert_state IS 'Tracks last admin alert per endpoint to avoid spamming on repeated delivery failures';

ALTER TABLE webhook_endpoint_alert_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_endpoint_alert_state_via_endpoint ON webhook_endpoint_alert_state
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

CREATE POLICY webhook_endpoint_alert_state_service ON webhook_endpoint_alert_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
