-- ============================================================================
-- Production Hardening: Request IDs, Verification Tokens, Retention
-- ============================================================================

-- Add request_id to exports table
ALTER TABLE exports 
ADD COLUMN IF NOT EXISTS request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_exports_request_id 
ON exports (request_id) 
WHERE request_id IS NOT NULL;

-- Add verification_token to exports table (for public verification)
ALTER TABLE exports 
ADD COLUMN IF NOT EXISTS verification_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_exports_verification_token 
ON exports (verification_token) 
WHERE verification_token IS NOT NULL;

-- Add failure_count to exports (for poison pill logic)
ALTER TABLE exports 
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;

-- Add expired state to export_state_enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'expired' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'export_state_enum')
  ) THEN
    ALTER TYPE export_state_enum ADD VALUE 'expired';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Add plan_tier to organizations if not exists
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'starter' 
CHECK (plan_tier IN ('starter', 'pro', 'business', 'enterprise'));

-- Add comment
COMMENT ON COLUMN exports.request_id IS 'Request ID from the API call that created this export (for observability)';
COMMENT ON COLUMN exports.verification_token IS 'Public token for verification without authentication (expires after 30 days)';
COMMENT ON COLUMN exports.failure_count IS 'Number of times this export has failed (for poison pill logic)';
COMMENT ON COLUMN organizations.plan_tier IS 'Subscription plan tier (determines retention period)';
