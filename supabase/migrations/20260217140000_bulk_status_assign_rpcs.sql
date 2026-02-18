-- Atomic bulk status update: single UPDATE with updated_at, returns affected job ids.
-- Caller must have validated ids belong to org; RPC enforces org and eligible (not deleted/archived).
CREATE OR REPLACE FUNCTION public.bulk_update_job_status(
  p_organization_id UUID,
  p_job_ids UUID[],
  p_status TEXT
)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF array_length(p_job_ids, 1) IS NULL OR array_length(p_job_ids, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE jobs
  SET status = p_status,
      updated_at = now()
  WHERE organization_id = p_organization_id
    AND id = ANY(p_job_ids)
    AND deleted_at IS NULL
    AND (archived_at IS NULL AND status IS DISTINCT FROM 'archived')
  RETURNING id;
END;
$$;

COMMENT ON FUNCTION public.bulk_update_job_status(UUID, UUID[], TEXT) IS
  'Atomically updates status and updated_at for eligible jobs; returns updated job ids.';

GRANT EXECUTE ON FUNCTION public.bulk_update_job_status(UUID, UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_job_status(UUID, UUID[], TEXT) TO service_role;


-- Atomic bulk assign: insert job_assignments (ON CONFLICT DO NOTHING) and update jobs denormalized assignee + updated_at in one transaction; returns assigned job ids.
CREATE OR REPLACE FUNCTION public.bulk_assign_jobs(
  p_organization_id UUID,
  p_job_ids UUID[],
  p_worker_id UUID,
  p_worker_name TEXT,
  p_worker_email TEXT
)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eligible_ids UUID[];
BEGIN
  IF array_length(p_job_ids, 1) IS NULL OR array_length(p_job_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Collect eligible job ids (same org, not deleted, not archived)
  SELECT array_agg(j.id)
  INTO v_eligible_ids
  FROM jobs j
  WHERE j.organization_id = p_organization_id
    AND j.id = ANY(p_job_ids)
    AND j.deleted_at IS NULL
    AND j.archived_at IS NULL
    AND j.status IS DISTINCT FROM 'archived';

  IF v_eligible_ids IS NULL OR array_length(v_eligible_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Insert assignments (ignore duplicates on (job_id, user_id))
  INSERT INTO job_assignments (job_id, user_id, role)
  SELECT id, p_worker_id, 'worker'
  FROM jobs
  WHERE organization_id = p_organization_id
    AND id = ANY(v_eligible_ids)
  ON CONFLICT (job_id, user_id) DO NOTHING;

  -- Update denormalized assignee and updated_at for all eligible jobs
  RETURN QUERY
  UPDATE jobs
  SET assigned_to_id = p_worker_id,
      assigned_to_name = p_worker_name,
      assigned_to_email = p_worker_email,
      updated_at = now()
  WHERE organization_id = p_organization_id
    AND id = ANY(v_eligible_ids)
  RETURNING id;
END;
$$;

COMMENT ON FUNCTION public.bulk_assign_jobs(UUID, UUID[], UUID, TEXT, TEXT) IS
  'Atomically assigns a worker to multiple jobs (insert job_assignments + update jobs.assigned_to_* and updated_at); returns assigned job ids.';

GRANT EXECUTE ON FUNCTION public.bulk_assign_jobs(UUID, UUID[], UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_assign_jobs(UUID, UUID[], UUID, TEXT, TEXT) TO service_role;
