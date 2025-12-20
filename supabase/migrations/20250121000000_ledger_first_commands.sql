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

-- Command: Close incident (atomic with attestation creation)
-- Mutates: jobs table (incident_status, closed_at, closed_by), job_signoffs table
-- Ledger: incident.closed, attestation.created
CREATE OR REPLACE FUNCTION audit_close_incident(
  p_organization_id UUID,
  p_actor_id UUID,
  p_work_record_id UUID,
  p_closure_summary TEXT,
  p_root_cause TEXT,
  p_evidence_attached BOOLEAN,
  p_waived BOOLEAN DEFAULT false,
  p_waiver_reason TEXT DEFAULT NULL,
  p_no_action_required BOOLEAN DEFAULT false,
  p_no_action_justification TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_ledger_id_incident UUID;
  v_ledger_id_attestation UUID;
  v_attestation_id UUID;
  v_job_exists BOOLEAN;
  v_has_corrective_actions BOOLEAN;
  v_user_email TEXT;
  v_user_role TEXT;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_ledger_id_incident
    FROM audit_logs
    WHERE organization_id = p_organization_id
      AND actor_id = p_actor_id
      AND event_name = 'incident.closed'
      AND metadata->>'idempotency_key' = p_idempotency_key
      AND work_record_id = p_work_record_id;
    
    IF v_ledger_id_incident IS NOT NULL THEN
      SELECT metadata->>'attestation_id' INTO v_attestation_id
      FROM audit_logs
      WHERE id = v_ledger_id_incident;
      
      RETURN jsonb_build_object(
        'ok', true,
        'ledger_entry_id', v_ledger_id_incident,
        'attestation_id', v_attestation_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Validate work record exists
  SELECT EXISTS(SELECT 1 FROM jobs WHERE id = p_work_record_id AND organization_id = p_organization_id) INTO v_job_exists;
  IF NOT v_job_exists THEN
    RAISE EXCEPTION 'Work record not found';
  END IF;

  -- Check for corrective actions
  SELECT EXISTS(SELECT 1 FROM mitigation_items WHERE job_id = p_work_record_id AND deleted_at IS NULL) INTO v_has_corrective_actions;

  -- Validation guardrails
  IF NOT v_has_corrective_actions AND NOT p_no_action_required THEN
    RAISE EXCEPTION 'Either corrective actions must exist, or "no action required" must be selected with justification';
  END IF;

  IF p_no_action_required AND (p_no_action_justification IS NULL OR length(trim(p_no_action_justification)) < 10) THEN
    RAISE EXCEPTION 'Justification (min 10 characters) is required when no corrective action is needed';
  END IF;

  IF NOT p_evidence_attached AND NOT p_waived THEN
    RAISE EXCEPTION 'Evidence must be attached or waived with a reason';
  END IF;

  IF p_waived AND (p_waiver_reason IS NULL OR length(trim(p_waiver_reason)) = 0) THEN
    RAISE EXCEPTION 'Waiver reason is required when waiving evidence';
  END IF;

  -- Get user info for attestation
  SELECT email, role INTO v_user_email, v_user_role
  FROM users
  WHERE id = p_actor_id;

  -- Create attestation atomically
  INSERT INTO job_signoffs (
    job_id,
    organization_id,
    signoff_type,
    status,
    signed_by,
    signed_at,
    comments
  ) VALUES (
    p_work_record_id,
    p_organization_id,
    'incident_closure',
    'signed',
    p_actor_id,
    NOW(),
    format('Incident closure attestation: %s', p_closure_summary)
  ) RETURNING id INTO v_attestation_id;

  -- Update job status
  UPDATE jobs
  SET 
    incident_status = 'closed',
    closed_at = NOW(),
    closed_by = p_actor_id,
    incident_closure_summary = p_closure_summary,
    incident_root_cause = p_root_cause,
    incident_evidence_waived = p_waived,
    incident_waiver_reason = p_waiver_reason,
    incident_no_action_required = p_no_action_required,
    incident_no_action_justification = p_no_action_justification
  WHERE id = p_work_record_id AND organization_id = p_organization_id;

  -- Record incident.closed ledger entry
  v_ledger_id_incident := record_ledger_entry(
    p_organization_id,
    p_actor_id,
    'incident.closed',
    'job',
    p_work_record_id,
    jsonb_build_object(
      'closure_summary', p_closure_summary,
      'root_cause', p_root_cause,
      'evidence_attached', p_evidence_attached,
      'waived', p_waived,
      'waiver_reason', p_waiver_reason,
      'no_action_required', p_no_action_required,
      'no_action_justification', p_no_action_justification,
      'corrective_action_count', (SELECT count(*) FROM mitigation_items WHERE job_id = p_work_record_id AND deleted_at IS NULL),
      'attestation_id', v_attestation_id,
      'attestation_created_atomically', true,
      'idempotency_key', p_idempotency_key,
      'summary', format('Incident closed: %s', p_closure_summary)
    ),
    'incident_review',
    'material',
    'success',
    p_request_id,
    p_endpoint,
    p_ip,
    p_user_agent,
    p_work_record_id,
    NULL
  );

  -- Record attestation.created ledger entry
  v_ledger_id_attestation := record_ledger_entry(
    p_organization_id,
    p_actor_id,
    'attestation.created',
    'system',
    v_attestation_id,
    jsonb_build_object(
      'signoff_type', 'incident_closure',
      'work_record_id', p_work_record_id,
      'signer_user_id', p_actor_id,
      'signer_email', v_user_email,
      'signer_role', v_user_role,
      'statement', format('Incident closure attestation: %s', p_closure_summary),
      'summary', 'Incident closure attestation created'
    ),
    'attestations',
    'material',
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
    'ledger_entry_id', v_ledger_id_incident,
    'attestation_id', v_attestation_id,
    'attestation_ledger_entry_id', v_ledger_id_attestation
  );
END;
$$ LANGUAGE plpgsql;

-- Command: Revoke user access
-- Mutates: users table (role, archived_at), optionally invalidates sessions
-- Ledger: access.revoked
CREATE OR REPLACE FUNCTION audit_revoke_access(
  p_organization_id UUID,
  p_actor_id UUID,
  p_target_user_id UUID,
  p_action_type TEXT, -- 'disable_user', 'downgrade_role', 'revoke_sessions'
  p_reason TEXT,
  p_new_role TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_ledger_id UUID;
  v_target_role TEXT;
  v_actor_role TEXT;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_ledger_id
    FROM audit_logs
    WHERE organization_id = p_organization_id
      AND actor_id = p_actor_id
      AND event_name = 'access.revoked'
      AND metadata->>'idempotency_key' = p_idempotency_key
      AND target_id = p_target_user_id;
    
    IF v_ledger_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'ledger_entry_id', v_ledger_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Get roles for validation
  SELECT role INTO v_actor_role FROM users WHERE id = p_actor_id;
  SELECT role INTO v_target_role FROM users WHERE id = p_target_user_id;

  -- Authorization: Only admin/owner can revoke
  IF v_actor_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Only admins and owners can revoke access';
  END IF;

  -- Guardrails: Cannot revoke self or executives
  IF p_target_user_id = p_actor_id THEN
    RAISE EXCEPTION 'Cannot revoke your own access';
  END IF;

  IF v_target_role = 'executive' THEN
    RAISE EXCEPTION 'Cannot revoke executive access';
  END IF;

  -- Perform domain mutation
  IF p_action_type = 'disable_user' THEN
    UPDATE users
    SET archived_at = NOW()
    WHERE id = p_target_user_id AND organization_id = p_organization_id;
  ELSIF p_action_type = 'downgrade_role' THEN
    IF p_new_role IS NULL THEN
      RAISE EXCEPTION 'New role is required for downgrade';
    END IF;
    IF p_new_role IN ('owner', 'executive') THEN
      RAISE EXCEPTION 'Cannot downgrade to owner or executive role';
    END IF;
    UPDATE users
    SET role = p_new_role
    WHERE id = p_target_user_id AND organization_id = p_organization_id;
  ELSIF p_action_type = 'revoke_sessions' THEN
    -- Note: Session revocation would require Supabase Auth admin API
    -- For now, we just record the ledger entry
    NULL;
  ELSE
    RAISE EXCEPTION 'Invalid action_type';
  END IF;

  -- Record ledger entry
  v_ledger_id := record_ledger_entry(
    p_organization_id,
    p_actor_id,
    'access.revoked',
    'user',
    p_target_user_id,
    jsonb_build_object(
      'action_type', p_action_type,
      'reason', p_reason,
      'new_role', p_new_role,
      'target_user_id', p_target_user_id,
      'target_role', v_target_role,
      'idempotency_key', p_idempotency_key,
      'summary', format('Access revoked: %s', p_action_type)
    ),
    'access_review',
    'material',
    'success',
    p_request_id,
    p_endpoint,
    p_ip,
    p_user_agent,
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_entry_id', v_ledger_id
  );
END;
$$ LANGUAGE plpgsql;

-- Command: Flag suspicious access
-- Mutates: (optional) creates security incident marker
-- Ledger: security.suspicious_access.flagged, optionally security.incident.opened
CREATE OR REPLACE FUNCTION audit_flag_suspicious(
  p_organization_id UUID,
  p_actor_id UUID,
  p_target_user_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'material',
  p_open_incident BOOLEAN DEFAULT true,
  p_login_event_id UUID DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_ledger_id_flag UUID;
  v_ledger_id_incident UUID;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_ledger_id_flag
    FROM audit_logs
    WHERE organization_id = p_organization_id
      AND actor_id = p_actor_id
      AND event_name = 'security.suspicious_access.flagged'
      AND metadata->>'idempotency_key' = p_idempotency_key
      AND target_id = p_target_user_id;
    
    IF v_ledger_id_flag IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'ledger_entry_id', v_ledger_id_flag,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Record security.suspicious_access.flagged ledger entry
  v_ledger_id_flag := record_ledger_entry(
    p_organization_id,
    p_actor_id,
    'security.suspicious_access.flagged',
    'user',
    p_target_user_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'reason', p_reason,
      'notes', p_notes,
      'severity', p_severity,
      'login_event_id', p_login_event_id,
      'idempotency_key', p_idempotency_key,
      'summary', format('Suspicious access flagged: %s', p_reason)
    ),
    'access_review',
    p_severity,
    'success',
    p_request_id,
    p_endpoint,
    p_ip,
    p_user_agent,
    NULL,
    NULL
  );

  -- Optionally create security incident
  IF p_open_incident THEN
    v_ledger_id_incident := record_ledger_entry(
      p_organization_id,
      p_actor_id,
      'security.incident.opened',
      'user',
      p_target_user_id,
      jsonb_build_object(
        'target_user_id', p_target_user_id,
        'reason', p_reason,
        'notes', p_notes,
        'severity', p_severity,
        'related_flag_ledger_id', v_ledger_id_flag,
        'summary', format('Security incident opened: %s', p_reason)
      ),
      'incident_review',
      p_severity,
      'success',
      p_request_id,
      p_endpoint,
      p_ip,
      p_user_agent,
      NULL,
      NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_entry_id', v_ledger_id_flag,
    'incident_ledger_entry_id', v_ledger_id_incident
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION audit_assign TO authenticated;
GRANT EXECUTE ON FUNCTION audit_resolve TO authenticated;
GRANT EXECUTE ON FUNCTION audit_create_corrective_action TO authenticated;
GRANT EXECUTE ON FUNCTION audit_close_incident TO authenticated;
GRANT EXECUTE ON FUNCTION audit_revoke_access TO authenticated;
GRANT EXECUTE ON FUNCTION audit_flag_suspicious TO authenticated;
GRANT EXECUTE ON FUNCTION record_ledger_entry TO authenticated;

