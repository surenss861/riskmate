-- Fix stripe_webhook_events table structure
-- Ensure it matches what the backend code expects

-- Drop and recreate if structure doesn't match
DROP TABLE IF EXISTS stripe_webhook_events CASCADE;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB -- Keep for backward compatibility
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS stripe_webhook_events_received_at_idx
  ON stripe_webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_event_id 
  ON stripe_webhook_events (stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_org_id 
  ON stripe_webhook_events (organization_id);

-- Add stripe_subscription_id column to audit_logs for Stripe IDs
-- This allows storing Stripe subscription IDs without breaking UUID constraint on target_id
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_stripe_subscription_id 
  ON audit_logs (stripe_subscription_id) 
  WHERE stripe_subscription_id IS NOT NULL;
