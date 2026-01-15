-- Fix Ledger Chain-of-Custody and Trigger Deduplication
-- Addresses: hash computation, sequence-based ordering, trigger dedupe, exports idempotency

-- ============================================================================
-- 1. ADD SEQUENCE FOR MONOTONIC LEDGER ORDERING (prevents race conditions)
-- ============================================================================

-- Global sequence for ledger ordering (or per-org if preferred)
CREATE SEQUENCE IF NOT EXISTS ledger_sequence
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Add sequence number column to audit_logs
DO $$
DECLARE
  v_row RECORD;
  v_seq BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_logs' AND column_name = 'ledger_seq') THEN
    ALTER TABLE audit_logs ADD COLUMN ledger_seq BIGINT;
    
    -- Temporarily disable immutability trigger for backfill
    ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_immutability_trigger;
    
    -- Backfill existing rows with sequence (deterministic ordering)
    FOR v_row IN 
      SELECT id FROM audit_logs 
      WHERE ledger_seq IS NULL 
      ORDER BY created_at, id
    LOOP
      v_seq := nextval('ledger_sequence');
      UPDATE audit_logs SET ledger_seq = v_seq WHERE id = v_row.id;
    END LOOP;
    
    -- Re-enable immutability trigger
    ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_immutability_trigger;
  END IF;
END $$;

-- Make ledger_seq NOT NULL and unique per org (enforced by index)
DO $$
BEGIN
  -- Set default for future inserts
  ALTER TABLE audit_logs 
    ALTER COLUMN ledger_seq SET DEFAULT nextval('ledger_sequence');
  
  -- Add unique constraint per org (prevents duplicates)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                 WHERE conname = 'audit_logs_org_seq_unique') THEN
    CREATE UNIQUE INDEX audit_logs_org_seq_unique 
      ON audit_logs(organization_id, ledger_seq);
  END IF;
END $$;

-- Index for chain traversal
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_seq 
  ON audit_logs(organization_id, ledger_seq);

-- ============================================================================
-- 2. CREATE HASH COMPUTATION FUNCTION (deterministic, canonical)
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_ledger_hash(
  p_prev_hash TEXT,
  p_ledger_seq BIGINT,
  p_organization_id UUID,
  p_actor_id UUID,
  p_event_name TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_metadata JSONB,
  p_created_at TIMESTAMPTZ,
  p_secret_salt TEXT DEFAULT 'riskmate-ledger-v1-2025'
) RETURNS TEXT AS $$
DECLARE
  v_canonical JSONB;
  v_hash_input TEXT;
BEGIN
  -- Build canonical JSON (deterministic order)
  v_canonical := jsonb_build_object(
    'seq', p_ledger_seq,
    'org_id', p_organization_id::TEXT,
    'actor_id', COALESCE(p_actor_id::TEXT, ''),
    'event', p_event_name,
    'target_type', p_target_type,
    'target_id', COALESCE(p_target_id::TEXT, ''),
    'created_at', p_created_at::TEXT,
    'metadata', p_metadata
  );
  
  -- Hash: sha256(canonical_json + prev_hash + salt)
  v_hash_input := jsonb_pretty(v_canonical) || 
                  COALESCE(p_prev_hash, '') || 
                  p_secret_salt;
  
  RETURN encode(digest(v_hash_input, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 3. UPDATE ENRICH_AUDIT_EVENT TO USE SEQUENCE + HASH
-- ============================================================================

-- Drop trigger first, then function, then recreate both
DROP TRIGGER IF EXISTS enrich_audit_event_trigger ON audit_logs;
DROP FUNCTION IF EXISTS enrich_audit_event() CASCADE;

CREATE OR REPLACE FUNCTION enrich_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_hash TEXT;
  v_prev_seq BIGINT;
  v_ledger_seq BIGINT;
  v_hash TEXT;
BEGIN
  -- Get previous event hash and sequence for this organization
  SELECT hash, ledger_seq INTO v_prev_hash, v_prev_seq
  FROM audit_logs
  WHERE organization_id = NEW.organization_id
    AND ledger_seq IS NOT NULL
  ORDER BY ledger_seq DESC
  LIMIT 1;
  
  -- Assign sequence number (monotonic, race-safe)
  v_ledger_seq := nextval('ledger_sequence');
  NEW.ledger_seq := v_ledger_seq;
  
  -- Compute hash
  v_hash := compute_ledger_hash(
    v_prev_hash,
    v_ledger_seq,
    NEW.organization_id,
    NEW.actor_id,
    NEW.event_name,
    NEW.target_type,
    NEW.target_id,
    COALESCE(NEW.metadata, '{}'::JSONB),
    COALESCE(NEW.created_at, NOW())
  );
  
  NEW.hash := v_hash;
  NEW.prev_hash := v_prev_hash;
  
  -- Auto-populate category if not set
  IF NEW.category IS NULL THEN
    IF NEW.event_name LIKE 'auth.%' OR NEW.event_name LIKE '%violation%' THEN
      NEW.category := 'governance';
    ELSIF NEW.event_name LIKE 'team.%' OR NEW.event_name LIKE 'security.%' OR NEW.event_name LIKE 'account.%' THEN
      NEW.category := 'access';
    ELSE
      NEW.category := 'operations';
    END IF;
  END IF;
  
  -- Auto-populate outcome if not set
  IF NEW.outcome IS NULL THEN
    IF NEW.event_name LIKE '%violation%' OR NEW.event_name LIKE '%blocked%' OR NEW.event_name LIKE '%denied%' THEN
      NEW.outcome := 'blocked';
    ELSE
      NEW.outcome := 'allowed';
    END IF;
  END IF;
  
  -- Auto-populate severity if not set
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

-- Recreate trigger if it doesn't exist
DROP TRIGGER IF EXISTS enrich_audit_event_trigger ON audit_logs;
CREATE TRIGGER enrich_audit_event_trigger
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION enrich_audit_event();

-- ============================================================================
-- 4. ADD TRIGGER DEDUPE MECHANISM (prevent double-logging)
-- ============================================================================

-- Update all trigger functions to check if backend already wrote ledger
-- Pattern: Only write if riskmate.ledger_written is not set

-- Jobs trigger
CREATE OR REPLACE FUNCTION ledger_job_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_org_id UUID;
  v_ledger_written TEXT;
BEGIN
  -- Check if backend already wrote ledger
  v_ledger_written := current_setting('riskmate.ledger_written', true);
  IF v_ledger_written = '1' THEN
    -- Backend already logged, skip trigger
    RETURN NEW;
  END IF;
  
  -- Get actor from current user context (if available)
  v_actor_id := current_setting('app.current_user_id', true)::UUID;
  v_actor_role := current_setting('app.current_user_role', true);
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  
  -- Only create ledger if mutation is significant
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      organization_id,
      actor_id,
      event_name,
      target_type,
      target_id,
      job_id,
      actor_role,
      category,
      severity,
      outcome,
      metadata,
      summary
    ) VALUES (
      v_org_id,
      v_actor_id,
      'job.created',
      'job',
      NEW.id,
      NEW.id,
      v_actor_role,
      'operations',
      'info',
      'allowed',
      jsonb_build_object(
        'client_name', NEW.client_name,
        'status', NEW.status,
        'risk_score', NEW.risk_score,
        'risk_level', NEW.risk_level,
        'trigger_source', 'database_trigger'
      ),
      format('Job created: %s', NEW.client_name)
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      INSERT INTO audit_logs (
        organization_id,
        actor_id,
        event_name,
        target_type,
        target_id,
        job_id,
        actor_role,
        category,
        severity,
        outcome,
        metadata,
        summary
      ) VALUES (
        v_org_id,
        v_actor_id,
        'job.status_changed',
        'job',
        NEW.id,
        NEW.id,
        v_actor_role,
        'operations',
        'material',
        'allowed',
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'trigger_source', 'database_trigger'
        ),
        format('Job status changed: %s → %s', OLD.status, NEW.status)
      );
    END IF;
    
    IF (OLD.risk_score IS DISTINCT FROM NEW.risk_score) THEN
      INSERT INTO audit_logs (
        organization_id,
        actor_id,
        event_name,
        target_type,
        target_id,
        job_id,
        actor_role,
        category,
        severity,
        outcome,
        metadata,
        summary
      ) VALUES (
        v_org_id,
        v_actor_id,
        'job.risk_score_changed',
        'job',
        NEW.id,
        NEW.id,
        v_actor_role,
        'operations',
        'material',
        'allowed',
        jsonb_build_object(
          'old_score', OLD.risk_score,
          'new_score', NEW.risk_score,
          'old_level', OLD.risk_level,
          'new_level', NEW.risk_level,
          'trigger_source', 'database_trigger'
        ),
        format('Risk score changed: %s → %s', OLD.risk_score, NEW.risk_score)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Controls trigger
CREATE OR REPLACE FUNCTION ledger_control_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_org_id UUID;
  v_job_id UUID;
  v_ledger_written TEXT;
BEGIN
  v_ledger_written := current_setting('riskmate.ledger_written', true);
  IF v_ledger_written = '1' THEN
    RETURN NEW;
  END IF;
  
  v_actor_id := current_setting('app.current_user_id', true)::UUID;
  v_actor_role := current_setting('app.current_user_role', true);
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);
  
  IF TG_OP = 'UPDATE' AND (OLD.is_completed IS DISTINCT FROM NEW.is_completed) AND NEW.is_completed = true THEN
    INSERT INTO audit_logs (
      organization_id,
      actor_id,
      event_name,
      target_type,
      target_id,
      job_id,
      actor_role,
      category,
      severity,
      outcome,
      metadata,
      summary
    ) VALUES (
      v_org_id,
      v_actor_id,
      'control.completed',
      'control',
      NEW.id,
      v_job_id,
      v_actor_role,
      'operations',
      'material',
      'allowed',
      jsonb_build_object(
        'title', NEW.title,
        'completed_by', NEW.completed_by,
        'completed_at', NEW.completed_at,
        'trigger_source', 'database_trigger'
      ),
      format('Control completed: %s', NEW.title)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Evidence trigger
CREATE OR REPLACE FUNCTION ledger_evidence_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_ledger_written TEXT;
BEGIN
  v_ledger_written := current_setting('riskmate.ledger_written', true);
  IF v_ledger_written = '1' THEN
    RETURN NEW;
  END IF;
  
  v_actor_id := current_setting('app.current_user_id', true)::UUID;
  v_actor_role := current_setting('app.current_user_role', true);
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      organization_id,
      actor_id,
      event_name,
      target_type,
      target_id,
      job_id,
      actor_role,
      category,
      severity,
      outcome,
      metadata,
      summary
    ) VALUES (
      NEW.organization_id,
      v_actor_id,
      'evidence.uploaded',
      'evidence',
      NEW.id,
      NEW.work_record_id,
      v_actor_role,
      'operations',
      'material',
      'allowed',
      jsonb_build_object(
        'file_name', NEW.file_name,
        'file_sha256', NEW.file_sha256,
        'phase', NEW.phase,
        'evidence_type', NEW.evidence_type,
        'state', NEW.state,
        'trigger_source', 'database_trigger'
      ),
      format('Evidence uploaded: %s', NEW.file_name)
    );
    
  ELSIF TG_OP = 'UPDATE' AND (OLD.state IS DISTINCT FROM NEW.state) THEN
    IF NEW.state = 'sealed' THEN
      INSERT INTO audit_logs (
        organization_id,
        actor_id,
        event_name,
        target_type,
        target_id,
        job_id,
        actor_role,
        category,
        severity,
        outcome,
        metadata,
        summary
      ) VALUES (
        NEW.organization_id,
        v_actor_id,
        'evidence.sealed',
        'evidence',
        NEW.id,
        NEW.work_record_id,
        v_actor_role,
        'operations',
        'material',
        'allowed',
        jsonb_build_object(
          'file_sha256', NEW.file_sha256,
          'sealed_at', NEW.sealed_at,
          'trigger_source', 'database_trigger'
        ),
        format('Evidence sealed: %s', NEW.file_name)
      );
    ELSIF NEW.state = 'verified' THEN
      INSERT INTO audit_logs (
        organization_id,
        actor_id,
        event_name,
        target_type,
        target_id,
        job_id,
        actor_role,
        category,
        severity,
        outcome,
        metadata,
        summary
      ) VALUES (
        NEW.organization_id,
        v_actor_id,
        'evidence.verified',
        'evidence',
        NEW.id,
        NEW.work_record_id,
        v_actor_role,
        'operations',
        'material',
        'allowed',
        jsonb_build_object(
          'file_sha256', NEW.file_sha256,
          'verified_at', NEW.verified_at,
          'trigger_source', 'database_trigger'
        ),
        format('Evidence verified: %s', NEW.file_name)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Export trigger
CREATE OR REPLACE FUNCTION ledger_export_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_ledger_written TEXT;
BEGIN
  v_ledger_written := current_setting('riskmate.ledger_written', true);
  IF v_ledger_written = '1' THEN
    RETURN NEW;
  END IF;
  
  v_actor_id := current_setting('app.current_user_id', true)::UUID;
  v_actor_role := current_setting('app.current_user_role', true);
  
  IF TG_OP = 'UPDATE' AND (OLD.state IS DISTINCT FROM NEW.state) THEN
    IF NEW.state = 'ready' THEN
      INSERT INTO audit_logs (
        organization_id,
        actor_id,
        event_name,
        target_type,
        target_id,
        job_id,
        actor_role,
        category,
        severity,
        outcome,
        metadata,
        summary
      ) VALUES (
        NEW.organization_id,
        v_actor_id,
        format('export.%s.completed', NEW.export_type),
        'export',
        NEW.id,
        NEW.work_record_id,
        v_actor_role,
        'operations',
        'material',
        'allowed',
        jsonb_build_object(
          'export_type', NEW.export_type,
          'manifest_hash', NEW.manifest_hash,
          'completed_at', NEW.completed_at,
          'trigger_source', 'database_trigger'
        ),
        format('Export completed: %s', NEW.export_type)
      );
    ELSIF NEW.state = 'failed' THEN
      INSERT INTO audit_logs (
        organization_id,
        actor_id,
        event_name,
        target_type,
        target_id,
        job_id,
        actor_role,
        category,
        severity,
        outcome,
        metadata,
        summary
      ) VALUES (
        NEW.organization_id,
        v_actor_id,
        format('export.%s.failed', NEW.export_type),
        'export',
        NEW.id,
        NEW.work_record_id,
        v_actor_role,
        'operations',
        'material',
        'blocked',
        jsonb_build_object(
          'export_type', NEW.export_type,
          'error_code', NEW.error_code,
          'error_id', NEW.error_id,
          'error_message', NEW.error_message,
          'trigger_source', 'database_trigger'
        ),
        format('Export failed: %s', NEW.export_type)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. ADD IDEMPOTENCY_KEY TO EXPORTS TABLE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exports') THEN
    -- Add idempotency_key column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'exports' AND column_name = 'idempotency_key') THEN
      ALTER TABLE exports ADD COLUMN idempotency_key TEXT;
    END IF;
    
    -- Add unique constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                   WHERE conname = 'exports_org_idempotency_unique') THEN
      CREATE UNIQUE INDEX exports_org_idempotency_unique 
        ON exports(organization_id, idempotency_key) 
        WHERE idempotency_key IS NOT NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 6. ADD CANCELED STATE TO EXPORT ENUM
-- ============================================================================

-- Add 'canceled' to the enum if it doesn't exist
-- Note: ALTER TYPE ... ADD VALUE cannot be rolled back, so we use exception handling
DO $$
BEGIN
  -- Try to add 'canceled' to the enum
  ALTER TYPE export_state_enum ADD VALUE 'canceled';
EXCEPTION
  WHEN duplicate_object THEN
    -- Value already exists, ignore
    NULL;
  WHEN OTHERS THEN
    -- If enum doesn't exist or other error, that's OK (enum creation is in migration 00000)
    NULL;
END $$;

-- ============================================================================
-- 7. ADD SEQUENCE RANGES TO LEDGER_ROOTS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ledger_roots') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ledger_roots' AND column_name = 'first_seq') THEN
      ALTER TABLE ledger_roots 
        ADD COLUMN first_seq BIGINT,
        ADD COLUMN last_seq BIGINT;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 8. ENFORCE SHA256 FORMAT (64 hex chars)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evidence') THEN
    -- Add check constraint for SHA256 format (64 hex characters)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                   WHERE conname = 'evidence_sha256_format_check') THEN
      ALTER TABLE evidence 
        ADD CONSTRAINT evidence_sha256_format_check 
        CHECK (file_sha256 ~ '^[0-9a-f]{64}$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 9. ADD HELPER FUNCTION FOR BACKEND TO SET LEDGER WRITTEN FLAG
-- ============================================================================

CREATE OR REPLACE FUNCTION set_ledger_written()
RETURNS void AS $$
BEGIN
  PERFORM set_config('riskmate.ledger_written', '1', true); -- true = local to transaction
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_ledger_written IS 'Backend calls this before writing ledger to prevent trigger double-logging. Use: SELECT set_ledger_written();';

-- ============================================================================
-- 10. UPDATE COMMENTS
-- ============================================================================

COMMENT ON COLUMN audit_logs.ledger_seq IS 'Monotonic sequence number for chain-of-custody ordering (race-safe)';
COMMENT ON COLUMN audit_logs.prev_hash IS 'Hash of previous ledger entry in chain (references previous ledger_seq)';
COMMENT ON COLUMN audit_logs.hash IS 'SHA256 hash of canonical JSON + prev_hash + salt (computed deterministically)';
COMMENT ON COLUMN exports.idempotency_key IS 'Client-provided key for deduplication (prevents duplicate exports)';
COMMENT ON COLUMN ledger_roots.first_seq IS 'First ledger_seq in this root (inclusive)';
COMMENT ON COLUMN ledger_roots.last_seq IS 'Last ledger_seq in this root (inclusive)';
