-- Fix needs_signatures boolean filter: handle both true and false.
-- When p_value is true: jobs that need signatures (NOT EXISTS signatures).
-- When p_value is false: jobs that don't need signatures (EXISTS signatures).
-- Previously only the true case was handled; false always returned zero jobs.

CREATE OR REPLACE FUNCTION get_job_ids_for_boolean_filter(
  p_org_id UUID,
  p_field TEXT,
  p_value BOOLEAN,
  p_include_archived BOOLEAN DEFAULT false
)
RETURNS UUID[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(array_agg(j.id), ARRAY[]::UUID[])
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND (p_include_archived OR j.archived_at IS NULL)
    AND (
      CASE p_field
        WHEN 'has_photos' THEN
          CASE WHEN p_value THEN
            EXISTS (SELECT 1 FROM job_photos jp WHERE jp.job_id = j.id AND jp.organization_id = p_org_id)
          ELSE
            NOT EXISTS (SELECT 1 FROM job_photos jp WHERE jp.job_id = j.id AND jp.organization_id = p_org_id)
          END
        WHEN 'has_signatures' THEN
          CASE WHEN p_value THEN
            EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)
          ELSE
            NOT EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)
          END
        WHEN 'needs_signatures' THEN
          CASE WHEN p_value THEN
            NOT EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)
          ELSE
            EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)
          END
        ELSE FALSE
      END
    );
$$;
