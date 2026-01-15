-- Ledger Trigger Safety Net
-- Ensures all critical mutations create ledger events even if backend forgets

-- ============================================================================
-- 1. TRIGGER: Jobs mutations → ledger events
-- ============================================================================

CREATE OR REPLACE FUNCTION ledger_job_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_org_id UUID;
BEGIN
  -- Get actor from current user context (if available)
  v_actor_id := current_setting('app.current_user_id', true)::UUID;
  v_actor_role := current_setting('app.current_user_role', true);
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  
  -- Only create ledger if mutation is significant
  IF TG_OP = 'INSERT' THEN
    -- Job created
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
    -- Significant field changes
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

DROP TRIGGER IF EXISTS jobs_ledger_trigger ON jobs;
CREATE TRIGGER jobs_ledger_trigger
  AFTER INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION ledger_job_mutation();

-- ============================================================================
-- 2. TRIGGER: Controls mutations → ledger events
-- ============================================================================

CREATE OR REPLACE FUNCTION ledger_control_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_org_id UUID;
  v_job_id UUID;
BEGIN
  v_actor_id := current_setting('app.current_user_id', true)::UUID;
  v_actor_role := current_setting('app.current_user_role', true);
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);
  
  IF TG_OP = 'UPDATE' AND (OLD.is_completed IS DISTINCT FROM NEW.is_completed) AND NEW.is_completed = true THEN
    -- Control completed
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

-- Only create trigger if controls table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'controls') THEN
    DROP TRIGGER IF EXISTS controls_ledger_trigger ON controls;
    CREATE TRIGGER controls_ledger_trigger
      AFTER UPDATE ON controls
      FOR EACH ROW
      EXECUTE FUNCTION ledger_control_mutation();
  END IF;
END $$;

-- ============================================================================
-- 3. TRIGGER: Evidence state changes → ledger events
-- ============================================================================

CREATE OR REPLACE FUNCTION ledger_evidence_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
BEGIN
  v_actor_id := current_setting('app.current_user_id', true)::UUID;
  v_actor_role := current_setting('app.current_user_role', true);
  
  IF TG_OP = 'INSERT' THEN
    -- Evidence uploaded
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
    -- State transition
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

-- Only create trigger if evidence table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evidence') THEN
    DROP TRIGGER IF EXISTS evidence_ledger_trigger ON evidence;
    CREATE TRIGGER evidence_ledger_trigger
      AFTER INSERT OR UPDATE ON evidence
      FOR EACH ROW
      EXECUTE FUNCTION ledger_evidence_mutation();
  END IF;
END $$;

-- ============================================================================
-- 4. TRIGGER: Export state changes → ledger events
-- ============================================================================

CREATE OR REPLACE FUNCTION ledger_export_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
BEGIN
  v_actor_id := current_setting('app.current_user_id', true)::UUID;
  v_actor_role := current_setting('app.current_user_role', true);
  
  IF TG_OP = 'UPDATE' AND (OLD.state IS DISTINCT FROM NEW.state) THEN
    IF NEW.state = 'ready' THEN
      -- Export completed
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
      -- Export failed
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

-- Only create trigger if exports table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exports') THEN
    DROP TRIGGER IF EXISTS exports_ledger_trigger ON exports;
    CREATE TRIGGER exports_ledger_trigger
      AFTER UPDATE ON exports
      FOR EACH ROW
      EXECUTE FUNCTION ledger_export_mutation();
  END IF;
END $$;

-- ============================================================================
-- 5. HELPER: Set current user context (called by backend before mutations)
-- ============================================================================

CREATE OR REPLACE FUNCTION set_ledger_context(
  p_user_id UUID,
  p_user_role TEXT
)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', p_user_id::TEXT, false);
  PERFORM set_config('app.current_user_role', p_user_role, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_ledger_context IS 'Sets user context for ledger triggers. Call before mutations: SELECT set_ledger_context(user_id, user_role);';
