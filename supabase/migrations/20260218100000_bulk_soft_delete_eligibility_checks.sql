-- Enforce server-side eligibility in bulk_soft_delete_jobs: draft-only, no audit_logs/risk/reports.
-- Returns error when any job is ineligible; no updates are performed in that case.
CREATE OR REPLACE FUNCTION public.bulk_soft_delete_jobs(
  p_organization_id UUID,
  p_job_ids UUID[],
  p_deleted_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_count INTEGER;
  v_ineligible_ids UUID[];
  v_msg TEXT;
BEGIN
  IF array_length(p_job_ids, 1) IS NULL OR array_length(p_job_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  -- Eligibility: jobs must exist, belong to org, be draft, and not already deleted
  SELECT array_agg(pid)
  INTO v_ineligible_ids
  FROM unnest(p_job_ids) AS pid
  LEFT JOIN jobs j ON j.id = pid AND j.organization_id = p_organization_id
  WHERE j.id IS NULL
     OR j.deleted_at IS NOT NULL
     OR (j.status IS DISTINCT FROM 'draft');

  IF v_ineligible_ids IS NOT NULL AND array_length(v_ineligible_ids, 1) > 0 THEN
    v_msg := 'One or more jobs are ineligible for delete (must be draft, not deleted, and belong to organization): ' || array_to_string(v_ineligible_ids, ', ');
    RAISE EXCEPTION '%', v_msg USING ERRCODE = 'check_violation';
  END IF;

  -- No audit history: neither target_id nor job_id in audit_logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    SELECT array_agg(DISTINCT job_id)
    INTO v_ineligible_ids
    FROM (
      SELECT id AS job_id FROM unnest(p_job_ids) AS id
      WHERE EXISTS (
        SELECT 1 FROM audit_logs a
        WHERE a.organization_id = p_organization_id
          AND (a.target_id = id OR (a.job_id IS NOT NULL AND a.job_id = id))
      )
    ) x;

    IF v_ineligible_ids IS NOT NULL AND array_length(v_ineligible_ids, 1) > 0 THEN
      v_msg := 'Jobs with audit history cannot be deleted: ' || array_to_string(v_ineligible_ids, ', ');
      RAISE EXCEPTION '%', v_msg USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- No risk assessments (job_risk_scores)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_risk_scores') THEN
    SELECT array_agg(DISTINCT job_id)
    INTO v_ineligible_ids
    FROM job_risk_scores
    WHERE job_id = ANY(p_job_ids);

    IF v_ineligible_ids IS NOT NULL AND array_length(v_ineligible_ids, 1) > 0 THEN
      v_msg := 'Jobs with finalized risk assessments cannot be deleted: ' || array_to_string(v_ineligible_ids, ', ');
      RAISE EXCEPTION '%', v_msg USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- No reports (report_runs)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'report_runs') THEN
    SELECT array_agg(DISTINCT job_id)
    INTO v_ineligible_ids
    FROM report_runs
    WHERE job_id = ANY(p_job_ids);

    IF v_ineligible_ids IS NOT NULL AND array_length(v_ineligible_ids, 1) > 0 THEN
      v_msg := 'Jobs with generated reports cannot be deleted: ' || array_to_string(v_ineligible_ids, ', ');
      RAISE EXCEPTION '%', v_msg USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- All eligibility checks passed; perform soft-deletes

  -- Soft-delete documents (job documents/photos) for these jobs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'documents' AND column_name = 'deleted_at') THEN
      UPDATE documents
      SET deleted_at = p_deleted_at
      WHERE job_id = ANY(p_job_ids)
        AND organization_id = p_organization_id
        AND deleted_at IS NULL;
    END IF;
  END IF;

  -- Soft-delete evidence (work_record_id = job id) for these jobs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evidence') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'evidence' AND column_name = 'deleted_at') THEN
      UPDATE evidence
      SET deleted_at = p_deleted_at
      WHERE work_record_id = ANY(p_job_ids)
        AND organization_id = p_organization_id
        AND deleted_at IS NULL;
    END IF;
  END IF;

  -- Soft-delete mitigation_items for these jobs (if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'mitigation_items' AND column_name = 'deleted_at') THEN
    UPDATE mitigation_items
    SET deleted_at = p_deleted_at
    WHERE job_id = ANY(p_job_ids)
      AND organization_id = p_organization_id
      AND deleted_at IS NULL;
  END IF;

  -- Soft-delete jobs
  UPDATE jobs
  SET deleted_at = p_deleted_at
  WHERE organization_id = p_organization_id
    AND id = ANY(p_job_ids)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_job_count = ROW_COUNT;
  RETURN v_job_count;
END;
$$;

COMMENT ON FUNCTION public.bulk_soft_delete_jobs(UUID, UUID[], TIMESTAMPTZ) IS
  'Soft-deletes jobs and their documents, evidence, and mitigation_items in one transaction. Enforces eligibility server-side: draft-only, no audit_logs, no job_risk_scores, no report_runs; raises if any job is ineligible.';