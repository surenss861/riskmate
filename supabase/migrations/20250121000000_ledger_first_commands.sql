-- Ledger-First Command Model: Postgres RPC Functions for Atomic Operations
-- 
-- These functions ensure domain mutations + ledger entries succeed/fail together
-- Each command function validates, mutates, and appends ledger entry in one transaction
--
-- Usage: SELECT * FROM audit_assign(...) or SELECT * FROM audit_resolve(...)

-- Helper: Record audit log entry (used by all command functions)
CREATE OR REPLACE FUNCTION record_ledger_entry(
  p_organization_id UUID,
  p_actor_id UUID,
  p_event_name TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_metadata JSONB,
  p_category TEXT,
  p_severity TEXT,
  p_outcome TEXT,
  p_request_id TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_site_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_ledger_id UUID;
BEGIN
  INSERT INTO audit_logs (
    organization_id,
    actor_id,
    event_name,
    target_type,
    target_id,
    metadata,
    category,
    severity,
    outcome,
    request_id,
    endpoint,
    ip,
    user_agent,
    job_id,
    site_id,
    created_at
  ) VALUES (
    p_organization_id,
    p_actor_id,
    p_event_name,
    p_target_type,
    p_target_id,
    p_metadata,
    p_category,
    p_severity,
    p_outcome,
    p_request_id,
    p_endpoint,
    p_ip,
    p_user_agent,
    p_job_id,
    p_site_id,
    NOW()
  ) RETURNING id INTO v_ledger_id;
  
  RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql;

-- Command: Assign review item
-- Mutates: (future: assignments table) Currently stored in ledger metadata
-- Ledger: review.assigned
CREATE OR REPLACE FUNCTION audit_assign(
  p_organization_id UUID,
  p_actor_id UUID,
  p_target_type TEXT,
  p_target_id UUID,
  p_owner_id UUID,
  p_due_date DATE,
  p_severity_override TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_ledger_id UUID;
  v_target_exists BOOLEAN;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_ledger_id
    FROM audit_logs
    WHERE organization_id = p_organization_id
      AND actor_id = p_actor_id
      AND event_name = 'review.assigned'
      AND metadata->>'idempotency_key' = p_idempotency_key
      AND target_id = p_target_id;
    
    IF v_ledger_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'ledger_entry_id', v_ledger_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Validate target exists
  IF p_target_type = 'job' THEN
    SELECT EXISTS(SELECT 1 FROM jobs WHERE id = p_target_id AND organization_id = p_organization_id) INTO v_target_exists;
  ELSIF p_target_type = 'event' THEN
    SELECT EXISTS(SELECT 1 FROM audit_logs WHERE id = p_target_id AND organization_id = p_organization_id) INTO v_target_exists;
  ELSE
    v_target_exists := false;
  END IF;

  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'Target not found';
  END IF;

  -- Record ledger entry (domain mutation is stored in metadata for now)
  v_ledger_id := record_ledger_entry(
    p_organization_id,
    p_actor_id,
    'review.assigned',
    p_target_type,
    p_target_id,
    jsonb_build_object(
      'owner_id', p_owner_id,
      'due_date', p_due_date,
      'severity_override', p_severity_override,
      'note', p_note,
      'assigned_at', NOW(),
      'idempotency_key', p_idempotency_key,
      'summary', format('Assigned to owner (due: %s)', p_due_date)
    ),
    'review_queue',
    'info',
    'success',
    p_request_id,
    p_endpoint,
    p_ip,
    p_user_agent,
    CASE WHEN p_target_type = 'job' THEN p_target_id::UUID ELSE NULL END,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_entry_id', v_ledger_id
  );
END;
$$ LANGUAGE plpgsql;

-- Command: Resolve review item
-- Mutates: (future: assignments table status)
-- Ledger: review.resolved or review.waived
CREATE OR REPLACE FUNCTION audit_resolve(
  p_organization_id UUID,
  p_actor_id UUID,
  p_target_type TEXT,
  p_target_id UUID,
  p_reason TEXT,
  p_comment TEXT DEFAULT NULL,
  p_requires_followup BOOLEAN DEFAULT false,
  p_waived BOOLEAN DEFAULT false,
  p_waiver_reason TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_ledger_id UUID;
  v_event_name TEXT;
BEGIN
  -- Determine event name
  v_event_name := CASE WHEN p_waived THEN 'review.waived' ELSE 'review.resolved' END;

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_ledger_id
    FROM audit_logs
    WHERE organization_id = p_organization_id
      AND actor_id = p_actor_id
      AND event_name = v_event_name
      AND metadata->>'idempotency_key' = p_idempotency_key
      AND target_id = p_target_id;
    
    IF v_ledger_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'ledger_entry_id', v_ledger_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Record ledger entry
  v_ledger_id := record_ledger_entry(
    p_organization_id,
    p_actor_id,
    v_event_name,
    p_target_type,
    p_target_id,
    jsonb_build_object(
      'reason', p_reason,
      'comment', p_comment,
      'requires_followup', p_requires_followup,
      'waived', p_waived,
      'waiver_reason', p_waiver_reason,
      'resolved_at', NOW(),
      'idempotency_key', p_idempotency_key,
      'summary', CASE 
        WHEN p_waived THEN format('Waived: %s%s', p_reason, COALESCE(' - ' || p_waiver_reason, ''))
        ELSE format('Resolved: %s%s', p_reason, COALESCE(' - ' || p_comment, ''))
      END
    ),
    'review_queue',
    'info',
    'success',
    p_request_id,
    p_endpoint,
    p_ip,
    p_user_agent,
    CASE WHEN p_target_type = 'job' THEN p_target_id::UUID ELSE NULL END,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_entry_id', v_ledger_id
  );
END;
$$ LANGUAGE plpgsql;

-- Command: Create corrective action (control)
-- Mutates: mitigation_items table
-- Ledger: incident.corrective_action.created
CREATE OR REPLACE FUNCTION audit_create_corrective_action(
  p_organization_id UUID,
  p_actor_id UUID,
  p_work_record_id UUID,
  p_title TEXT,
  p_owner_id UUID,
  p_due_date DATE,
  p_verification_method TEXT,
  p_notes TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'info',
  p_incident_event_id UUID DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_ledger_id UUID;
  v_control_id UUID;
  v_job_exists BOOLEAN;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_ledger_id
    FROM audit_logs
    WHERE organization_id = p_organization_id
      AND actor_id = p_actor_id
      AND event_name = 'incident.corrective_action.created'
      AND metadata->>'idempotency_key' = p_idempotency_key
      AND work_record_id = p_work_record_id;
    
    IF v_ledger_id IS NOT NULL THEN
      SELECT metadata->>'control_id' INTO v_control_id
      FROM audit_logs
      WHERE id = v_ledger_id;
      
      RETURN jsonb_build_object(
        'ok', true,
        'ledger_entry_id', v_ledger_id,
        'control_id', v_control_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Validate work record exists
  SELECT EXISTS(SELECT 1 FROM jobs WHERE id = p_work_record_id AND organization_id = p_organization_id) INTO v_job_exists;
  IF NOT v_job_exists THEN
    RAISE EXCEPTION 'Work record not found';
  END IF;

  -- Create control (mitigation item)
  INSERT INTO mitigation_items (
    job_id,
    title,
    description,
    done,
    is_completed,
    owner_id,
    due_date,
    verification_method,
    severity,
    created_at
  ) VALUES (
    p_work_record_id,
    p_title,
    COALESCE(p_notes, ''),
    false,
    false,
    p_owner_id,
    p_due_date,
    p_verification_method,
    p_severity,
    NOW()
  ) RETURNING id INTO v_control_id;

  -- Record ledger entry
  v_ledger_id := record_ledger_entry(
    p_organization_id,
    p_actor_id,
    'incident.corrective_action.created',
    'mitigation',
    v_control_id,
    jsonb_build_object(
      'work_record_id', p_work_record_id,
      'incident_event_id', p_incident_event_id,
      'title', p_title,
      'owner_id', p_owner_id,
      'due_date', p_due_date,
      'verification_method', p_verification_method,
      'notes', p_notes,
      'severity', p_severity,
      'idempotency_key', p_idempotency_key,
      'summary', format('Corrective action created: %s', p_title)
    ),
    'incident_review',
    p_severity,
    'success',
    p_request_id,
    p_endpoint,
    p_ip,
    p_user_agent,
    p_work_record_id,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_entry_id', v_ledger_id,
    'control_id', v_control_id
  );
END;
$$ LANGUAGE plpgsql;

-- Note: Additional command functions (close_incident, revoke_access, flag_suspicious)
-- can be added following the same pattern:
-- 1. Check idempotency
-- 2. Validate inputs
-- 3. Perform domain mutations
-- 4. Record ledger entry
-- 5. Return ledger_entry_id

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION audit_assign TO authenticated;
GRANT EXECUTE ON FUNCTION audit_resolve TO authenticated;
GRANT EXECUTE ON FUNCTION audit_create_corrective_action TO authenticated;
GRANT EXECUTE ON FUNCTION record_ledger_entry TO authenticated;

