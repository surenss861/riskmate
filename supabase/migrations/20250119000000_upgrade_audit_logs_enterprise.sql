-- Enterprise Audit Logs Upgrade
-- Standardizes event schema, adds enrichment fields, and enables tamper-evident hash chain

-- Add new standardized fields
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('governance', 'operations', 'access')),
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (outcome IN ('allowed', 'blocked')),
  ADD COLUMN IF NOT EXISTS severity TEXT CHECK (severity IN ('info', 'material', 'critical')),
  ADD COLUMN IF NOT EXISTS policy_id TEXT,
  ADD COLUMN IF NOT EXISTS policy_statement TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id UUID,
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS actor_name TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS job_risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS job_flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS site_name TEXT,
  ADD COLUMN IF NOT EXISTS prev_hash TEXT,
  ADD COLUMN IF NOT EXISTS hash TEXT;

-- Create function to compute hash for tamper evidence
CREATE OR REPLACE FUNCTION compute_audit_hash(
  prev_hash_val TEXT,
  event_data JSONB,
  secret_salt TEXT DEFAULT 'riskmate-audit-secret-2025'
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    digest(
      COALESCE(prev_hash_val, '') || 
      jsonb_pretty(event_data) || 
      secret_salt,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to auto-enrich and hash audit events
CREATE OR REPLACE FUNCTION enrich_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  prev_event_hash TEXT;
  event_canonical JSONB;
BEGIN
  -- Get previous event hash for this organization
  SELECT hash INTO prev_event_hash
  FROM audit_logs
  WHERE organization_id = NEW.organization_id
    AND hash IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Build canonical event data for hashing
  event_canonical := jsonb_build_object(
    'id', NEW.id,
    'organization_id', NEW.organization_id,
    'actor_id', NEW.actor_id,
    'event_name', NEW.event_name,
    'target_type', NEW.target_type,
    'target_id', NEW.target_id,
    'created_at', NEW.created_at,
    'metadata', NEW.metadata
  );

  -- Compute hash
  NEW.hash := compute_audit_hash(prev_event_hash, event_canonical);
  NEW.prev_hash := prev_event_hash;

  -- Auto-populate category from event_name if not set
  IF NEW.category IS NULL THEN
    IF NEW.event_name LIKE 'auth.%' OR NEW.event_name LIKE '%violation%' THEN
      NEW.category := 'governance';
    ELSIF NEW.event_name LIKE 'team.%' OR NEW.event_name LIKE 'security.%' OR NEW.event_name LIKE 'account.%' THEN
      NEW.category := 'access';
    ELSE
      NEW.category := 'operations';
    END IF;
  END IF;

  -- Auto-populate outcome from event_name if not set
  IF NEW.outcome IS NULL THEN
    IF NEW.event_name LIKE '%violation%' OR NEW.event_name LIKE '%blocked%' OR NEW.event_name LIKE '%denied%' THEN
      NEW.outcome := 'blocked';
    ELSE
      NEW.outcome := 'allowed';
    END IF;
  END IF;

  -- Auto-populate severity from event_name if not set
  IF NEW.severity IS NULL THEN
    IF NEW.event_name LIKE '%violation%' OR NEW.event_name LIKE '%critical%' THEN
      NEW.severity := 'critical';
    ELSIF NEW.event_name LIKE '%flag%' OR NEW.event_name LIKE '%change%' OR NEW.event_name LIKE '%remove%' THEN
      NEW.severity := 'material';
    ELSE
      NEW.severity := 'info';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-enrich and hash
DROP TRIGGER IF EXISTS enrich_audit_event_trigger ON audit_logs;
CREATE TRIGGER enrich_audit_event_trigger
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION enrich_audit_event();

-- Add comprehensive indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_category_time 
  ON audit_logs (organization_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_site_time 
  ON audit_logs (organization_id, site_id, created_at DESC) 
  WHERE site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_job_time 
  ON audit_logs (organization_id, job_id, created_at DESC) 
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_actor_time 
  ON audit_logs (organization_id, actor_id, created_at DESC) 
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_event_type_time 
  ON audit_logs (organization_id, event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_outcome_time 
  ON audit_logs (organization_id, outcome, created_at DESC) 
  WHERE outcome IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_severity_time 
  ON audit_logs (organization_id, severity, created_at DESC) 
  WHERE severity IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_hash 
  ON audit_logs (organization_id, hash) 
  WHERE hash IS NOT NULL;

-- Add RLS policy to prevent updates/deletes (append-only)
DROP POLICY IF EXISTS "Audit logs are append-only" ON audit_logs;
CREATE POLICY "Audit logs are append-only"
  ON audit_logs
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Allow inserts (enforced by trigger)
DROP POLICY IF EXISTS "Users can insert audit logs" ON audit_logs;
CREATE POLICY "Users can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Allow reads for organization members
DROP POLICY IF EXISTS "Users can view audit logs from their organization" ON audit_logs;
CREATE POLICY "Users can view audit logs from their organization"
  ON audit_logs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Immutable audit trail with tamper-evident hash chain. All events are append-only.';
COMMENT ON COLUMN audit_logs.category IS 'Event category: governance (enforcement), operations (job actions), access (security/team)';
COMMENT ON COLUMN audit_logs.outcome IS 'Action outcome: allowed or blocked';
COMMENT ON COLUMN audit_logs.severity IS 'Event severity: info, material, critical';
COMMENT ON COLUMN audit_logs.hash IS 'SHA256 hash of event + previous hash for tamper detection';
COMMENT ON COLUMN audit_logs.prev_hash IS 'Hash of previous event in chain (for integrity verification)';

