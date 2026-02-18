-- Add deleted_at to mitigation_items if not present (for cascade soft-delete with jobs).
-- When a job is soft-deleted, its mitigation_items (hazards/controls) are soft-deleted in the same transaction.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mitigation_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'mitigation_items' AND column_name = 'deleted_at') THEN
      ALTER TABLE mitigation_items ADD COLUMN deleted_at TIMESTAMPTZ;
      COMMENT ON COLUMN mitigation_items.deleted_at IS 'Soft-delete timestamp; set when job is soft-deleted so hazards/controls are hidden with the job.';
    END IF;
  END IF;
END $$;

-- RPC: bulk soft-delete jobs and their mitigation_items in one transaction.
-- Caller must have already validated eligibility (draft, no audit/docs/risk/reports).
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
BEGIN
  IF array_length(p_job_ids, 1) IS NULL OR array_length(p_job_ids, 1) = 0 THEN
    RETURN 0;
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
  'Soft-deletes jobs and their mitigation_items in one transaction. Caller must validate eligibility (draft, no audit/docs/risk/reports).';

GRANT EXECUTE ON FUNCTION public.bulk_soft_delete_jobs(UUID, UUID[], TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_soft_delete_jobs(UUID, UUID[], TIMESTAMPTZ) TO service_role;
