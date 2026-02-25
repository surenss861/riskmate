-- When bulk-updating status to 'completed', set completed_at so analytics use it instead of updated_at.
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
      updated_at = now(),
      completed_at = CASE WHEN LOWER(p_status) = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END
  WHERE organization_id = p_organization_id
    AND id = ANY(p_job_ids)
    AND deleted_at IS NULL
    AND (archived_at IS NULL AND status IS DISTINCT FROM 'archived')
  RETURNING id;
END;
$$;
