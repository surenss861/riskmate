-- Add idempotency tracking for Stripe webhooks
-- Prevents duplicate processing of the same webhook event

-- Table to track processed Stripe events
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_org_id ON stripe_webhook_events(organization_id);

-- Add idempotency key to audit_logs metadata (if not already present)
-- This is handled in application code, but we ensure the column supports it

-- Add request_id index to audit_logs for idempotency checks (if metadata column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'metadata') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs((metadata->>'request_id'));
    CREATE INDEX IF NOT EXISTS idx_audit_logs_org_request_event ON audit_logs(organization_id, (metadata->>'request_id'), event_name);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usage_logs' AND column_name = 'metadata') THEN
    CREATE INDEX IF NOT EXISTS idx_usage_logs_request_id ON usage_logs((metadata->>'request_id'));
    CREATE INDEX IF NOT EXISTS idx_usage_logs_org_request_item ON usage_logs(organization_id, (metadata->>'request_id'), item);
  END IF;
END $$;
