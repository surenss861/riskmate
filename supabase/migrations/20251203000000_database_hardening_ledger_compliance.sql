-- Database Hardening for Compliance Ledger Backend
-- This migration adds: enums, constraints, indexes, immutability, chain-of-custody fields

-- ============================================================================
-- 1. CREATE ENUMS FOR TYPE SAFETY
-- ============================================================================

-- Job status enum
DO $$ BEGIN
  CREATE TYPE job_status_enum AS ENUM ('draft', 'in_progress', 'completed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Risk level enum
DO $$ BEGIN
  CREATE TYPE risk_level_enum AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Severity enum
DO $$ BEGIN
  CREATE TYPE severity_enum AS ENUM ('info', 'material', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Outcome enum
DO $$ BEGIN
  CREATE TYPE outcome_enum AS ENUM ('allowed', 'blocked', 'info');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Evidence state enum
DO $$ BEGIN
  CREATE TYPE evidence_state_enum AS ENUM ('queued', 'uploading', 'sealed', 'verified', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Export state enum (includes canceled)
DO $$ BEGIN
  CREATE TYPE export_state_enum AS ENUM ('queued', 'preparing', 'generating', 'uploading', 'ready', 'failed', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. ADD CHAIN-OF-CUSTODY FIELDS TO AUDIT_LOGS (LEDGER)
-- ============================================================================

-- Add prev_hash and hash columns for chain-of-custody
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_logs' AND column_name = 'prev_hash') THEN
    ALTER TABLE audit_logs ADD COLUMN prev_hash TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_logs' AND column_name = 'hash') THEN
    ALTER TABLE audit_logs ADD COLUMN hash TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_logs' AND column_name = 'decision') THEN
    ALTER TABLE audit_logs ADD COLUMN decision outcome_enum;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_logs' AND column_name = 'policy_reason') THEN
    ALTER TABLE audit_logs ADD COLUMN policy_reason TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_logs' AND column_name = 'actor_role') THEN
    ALTER TABLE audit_logs ADD COLUMN actor_role TEXT;
  END IF;
END $$;

-- Add index for chain-of-custody queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_prev_hash 
  ON audit_logs(organization_id, prev_hash) 
  WHERE prev_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_hash 
  ON audit_logs(organization_id, hash) 
  WHERE hash IS NOT NULL;

-- ============================================================================
-- 3. ENFORCE IMMUTABILITY ON LEDGER (audit_logs)
-- ============================================================================

-- Prevent updates and deletes on audit_logs (immutable ledger)
CREATE OR REPLACE FUNCTION prevent_ledger_mutations()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Ledger entries are immutable. Cannot update audit_logs.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Ledger entries are immutable. Cannot delete audit_logs.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_logs_immutability_trigger ON audit_logs;
CREATE TRIGGER audit_logs_immutability_trigger
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_mutations();

-- ============================================================================
-- 4. ADD ORG_ID + TIMESTAMPS TO ALL CANONICAL TABLES
-- ============================================================================

-- Ensure jobs has all required fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'created_by') THEN
    ALTER TABLE jobs ADD COLUMN created_by UUID REFERENCES users(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'updated_at') THEN
    ALTER TABLE jobs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Ensure hazards has org_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'hazards' AND column_name = 'organization_id') THEN
    ALTER TABLE hazards ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'hazards' AND column_name = 'created_by') THEN
    ALTER TABLE hazards ADD COLUMN created_by UUID REFERENCES users(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'hazards' AND column_name = 'created_at') THEN
    ALTER TABLE hazards ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Ensure controls has org_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'controls' AND column_name = 'organization_id') THEN
    ALTER TABLE controls ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'controls' AND column_name = 'created_at') THEN
    ALTER TABLE controls ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Ensure mitigation_items has org_id (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mitigation_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'mitigation_items' AND column_name = 'organization_id') THEN
      ALTER TABLE mitigation_items ADD COLUMN organization_id UUID;
      -- Backfill from jobs
      UPDATE mitigation_items mi
      SET organization_id = j.organization_id
      FROM jobs j
      WHERE mi.job_id = j.id AND mi.organization_id IS NULL;
      -- Add constraint after backfill
      ALTER TABLE mitigation_items 
        ALTER COLUMN organization_id SET NOT NULL,
        ADD CONSTRAINT mitigation_items_organization_id_fkey 
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 5. CREATE EVIDENCE TABLE (if not exists) WITH IDEMPOTENCY
-- ============================================================================

-- Create evidence table only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evidence') THEN
    CREATE TABLE evidence (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      work_record_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
      evidence_id TEXT NOT NULL, -- Client-provided idempotency key
      idempotency_key TEXT NOT NULL,
      file_sha256 TEXT NOT NULL, -- Server-validated SHA256
      file_name TEXT NOT NULL,
      file_size BIGINT NOT NULL,
      mime_type TEXT NOT NULL,
      storage_path TEXT NOT NULL, -- Supabase Storage path
      state evidence_state_enum NOT NULL DEFAULT 'queued',
      phase TEXT, -- 'before', 'during', 'after'
      evidence_type TEXT, -- 'permit', 'ppe', 'work_area', etc.
      metadata JSONB DEFAULT '{}'::JSONB,
      uploaded_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sealed_at TIMESTAMPTZ, -- When storage succeeded
      verified_at TIMESTAMPTZ, -- When hash verified
      error_message TEXT,
      UNIQUE(organization_id, idempotency_key), -- Prevent duplicates
      UNIQUE(organization_id, evidence_id, state) -- Prevent duplicate evidence_id in same state
    );
  END IF;
END $$;

-- Create indexes only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evidence') THEN
    CREATE INDEX IF NOT EXISTS idx_evidence_org_work_record 
      ON evidence(organization_id, work_record_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_org_created_at 
      ON evidence(organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_evidence_state 
      ON evidence(organization_id, state) 
      WHERE state IN ('queued', 'uploading', 'failed');
    CREATE INDEX IF NOT EXISTS idx_evidence_sha256 
      ON evidence(organization_id, file_sha256);
  END IF;
END $$;

-- ============================================================================
-- 6. CREATE EXPORTS TABLE FOR ASYNC EXPORT JOBS
-- ============================================================================

-- Create exports table only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exports') THEN
    CREATE TABLE exports (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      work_record_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
      export_type TEXT NOT NULL CHECK (export_type IN ('proof_pack', 'ledger', 'executive_brief', 'controls', 'attestations')),
      idempotency_key TEXT, -- Client-provided key for deduplication
      state export_state_enum NOT NULL DEFAULT 'queued',
      progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
      filters JSONB DEFAULT '{}'::JSONB, -- Saved view filters
      storage_path TEXT, -- Supabase Storage path when ready
      manifest_path TEXT, -- Path to manifest.json in storage
      manifest_hash TEXT, -- SHA256 of manifest.json (64 hex chars)
      manifest JSONB, -- Full manifest with file hashes
      error_code TEXT,
      error_id TEXT, -- For support tracking
      error_message TEXT,
      created_by UUID REFERENCES users(id),
      requested_by UUID REFERENCES users(id), -- Alias for created_by
      requested_at TIMESTAMPTZ, -- Alias for created_at
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') -- Auto-cleanup old exports
    );
  END IF;
END $$;

-- Create indexes only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exports') THEN
    CREATE INDEX IF NOT EXISTS idx_exports_org_created_at 
      ON exports(organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_exports_org_state 
      ON exports(organization_id, state) 
      WHERE state IN ('queued', 'preparing', 'generating', 'uploading');
    CREATE INDEX IF NOT EXISTS idx_exports_work_record 
      ON exports(organization_id, work_record_id, created_at DESC);
    -- Note: Cannot use NOW() in index predicate (not immutable)
    -- Use application-level cleanup instead
    CREATE INDEX IF NOT EXISTS idx_exports_expires_at 
      ON exports(expires_at);
    -- Note: idempotency_key unique index will be created in migration 00002
  END IF;
END $$;

-- ============================================================================
-- 7. CREATE LEDGER_ROOTS TABLE FOR MERKLE ROOT ANCHORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS ledger_roots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL, -- Daily root
  root_hash TEXT NOT NULL, -- Merkle root of that day's ledger events (64 hex chars)
  event_count INTEGER NOT NULL DEFAULT 0,
  first_event_id UUID REFERENCES audit_logs(id),
  last_event_id UUID REFERENCES audit_logs(id),
  first_seq BIGINT, -- First ledger_seq in this root (inclusive)
  last_seq BIGINT, -- Last ledger_seq in this root (inclusive)
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ledger_roots_org_date 
  ON ledger_roots(organization_id, date DESC);

-- ============================================================================
-- 8. ADD CRITICAL INDEXES FOR PERFORMANCE
-- ============================================================================

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_org_status_risk 
  ON jobs(organization_id, status, risk_level) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_org_created_at 
  ON jobs(organization_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Controls indexes (if controls table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'controls') THEN
    CREATE INDEX IF NOT EXISTS idx_controls_org_job 
      ON controls(organization_id, job_id);
    CREATE INDEX IF NOT EXISTS idx_controls_org_completed 
      ON controls(organization_id, is_completed) 
      WHERE is_completed = false;
  END IF;
END $$;

-- Hazards indexes
CREATE INDEX IF NOT EXISTS idx_hazards_org_job 
  ON hazards(organization_id, job_id);
CREATE INDEX IF NOT EXISTS idx_hazards_org_severity 
  ON hazards(organization_id, severity);

-- ============================================================================
-- 9. ADD UPDATED_AT TRIGGERS FOR ALL CANONICAL TABLES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Jobs
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Controls (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'controls') THEN
    DROP TRIGGER IF EXISTS update_controls_updated_at ON controls;
    CREATE TRIGGER update_controls_updated_at
      BEFORE UPDATE ON controls
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- 10. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE audit_logs IS 'Immutable ledger of all system events. Chain-of-custody enforced via prev_hash/hash.';
COMMENT ON COLUMN audit_logs.prev_hash IS 'Hash of previous ledger entry (chain-of-custody)';
COMMENT ON COLUMN audit_logs.hash IS 'SHA256 hash of this entry (computed deterministically)';
COMMENT ON COLUMN audit_logs.decision IS 'Whether action was allowed, blocked, or informational';
COMMENT ON COLUMN audit_logs.policy_reason IS 'Reason for blocked decision (if applicable)';

COMMENT ON TABLE evidence IS 'Evidence files with idempotency and SHA256 verification. State: queued -> uploading -> sealed -> verified.';
COMMENT ON COLUMN evidence.idempotency_key IS 'Client-provided key for deduplication';
COMMENT ON COLUMN evidence.file_sha256 IS 'Server-validated SHA256 hash of file content';
COMMENT ON COLUMN evidence.state IS 'Upload lifecycle state';

COMMENT ON TABLE exports IS 'Async export jobs. State: queued -> preparing -> generating -> uploading -> ready.';
COMMENT ON COLUMN exports.manifest_hash IS 'SHA256 of manifest.json for verification';
COMMENT ON COLUMN exports.manifest IS 'Full manifest with file hashes and metadata';

COMMENT ON TABLE ledger_roots IS 'Daily Merkle roots for ledger integrity verification';
