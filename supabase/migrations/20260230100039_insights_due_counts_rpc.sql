-- RPC for insights: full counts and limited job_id payloads for deadline_risk, pending_signatures, overdue_tasks.
-- Ensures metrics reflect the full set when org has >2000 due-relevance jobs; payload stays bounded.

CREATE OR REPLACE FUNCTION get_insights_due_counts(
  p_org_id UUID,
  p_now TIMESTAMPTZ,
  p_two_days_later TIMESTAMPTZ,
  p_seven_days_later TIMESTAMPTZ
)
RETURNS TABLE (
  deadline_risk_count BIGINT,
  deadline_risk_job_ids UUID[],
  pending_signatures_count BIGINT,
  pending_signatures_job_ids UUID[],
  overdue_count BIGINT,
  overdue_job_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_dr_count BIGINT;
  v_dr_ids UUID[];
  v_ps_count BIGINT;
  v_ps_ids UUID[];
  v_od_count BIGINT;
  v_od_ids UUID[];
BEGIN
  -- Deadline risk: open jobs with due_date in (p_now, p_two_days_later] and <50% mitigation completion
  WITH due_soon_open AS (
    SELECT j.id
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) != 'completed'
      AND j.due_date IS NOT NULL
      AND j.due_date > p_now
      AND j.due_date <= p_two_days_later
  ),
  mit_agg AS (
    SELECT mi.job_id,
      COUNT(*)::BIGINT AS total,
      COUNT(*) FILTER (WHERE mi.completed_at IS NOT NULL)::BIGINT AS completed
    FROM mitigation_items mi
    WHERE mi.organization_id = p_org_id
    GROUP BY mi.job_id
  ),
  deadline_risk_set AS (
    SELECT d.id
    FROM due_soon_open d
    LEFT JOIN mit_agg m ON m.job_id = d.id
    WHERE COALESCE(m.total, 0) = 0 OR (m.completed::NUMERIC / NULLIF(m.total, 0)) < 0.5
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM deadline_risk_set),
    (SELECT COALESCE(ARRAY_AGG(id ORDER BY id), '{}') FROM (SELECT id FROM deadline_risk_set LIMIT 50) t)
  INTO v_dr_count, v_dr_ids;

  -- Pending signatures: open jobs with due_date in (p_now, p_seven_days_later] and no signature
  WITH due_in_seven AS (
    SELECT j.id
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) != 'completed'
      AND j.due_date IS NOT NULL
      AND j.due_date > p_now
      AND j.due_date <= p_seven_days_later
  ),
  with_sig AS (
    SELECT s.job_id FROM signatures s WHERE s.organization_id = p_org_id
  ),
  pending_sig_set AS (
    SELECT d.id FROM due_in_seven d
    WHERE NOT EXISTS (SELECT 1 FROM with_sig s WHERE s.job_id = d.id)
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM pending_sig_set),
    (SELECT COALESCE(ARRAY_AGG(id ORDER BY id), '{}') FROM (SELECT id FROM pending_sig_set LIMIT 50) t)
  INTO v_ps_count, v_ps_ids;

  -- Overdue: open jobs with due_date < p_now
  WITH overdue_set AS (
    SELECT j.id
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) != 'completed'
      AND j.due_date IS NOT NULL
      AND j.due_date < p_now
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM overdue_set),
    (SELECT COALESCE(ARRAY_AGG(id ORDER BY id), '{}') FROM (SELECT id FROM overdue_set LIMIT 50) t)
  INTO v_od_count, v_od_ids;

  deadline_risk_count := v_dr_count;
  deadline_risk_job_ids := v_dr_ids;
  pending_signatures_count := v_ps_count;
  pending_signatures_job_ids := v_ps_ids;
  overdue_count := v_od_count;
  overdue_job_ids := v_od_ids;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION get_insights_due_counts(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Returns full counts and up to 50 job_ids each for deadline_risk, pending_signatures, overdue_tasks insights.';
