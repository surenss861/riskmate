-- Add avg_risk to get_analytics_summary so the Avg Risk Score KPI reflects the true weighted average
-- across all jobs in the period, not an average of bucketed trend averages.
-- Return type changes (new column), so we must DROP then CREATE.

DROP FUNCTION IF EXISTS get_analytics_summary(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_analytics_summary(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ
)
RETURNS TABLE (
  job_counts_by_status JSONB,
  risk_level_distribution JSONB,
  total_evidence_items BIGINT,
  jobs_with_evidence BIGINT,
  jobs_without_evidence BIGINT,
  team_activity JSONB,
  avg_risk NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH period_jobs AS (
    SELECT j.id, j.status, j.risk_level, j.risk_score
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND j.created_at >= p_since
      AND j.created_at <= p_until
  ),
  job_status_counts AS (
    SELECT COALESCE(NULLIF(TRIM(status), ''), 'unknown') AS status, COUNT(*)::BIGINT AS cnt
    FROM period_jobs
    GROUP BY COALESCE(NULLIF(TRIM(status), ''), 'unknown')
  ),
  risk_level_counts AS (
    SELECT LOWER(COALESCE(NULLIF(TRIM(risk_level), ''), 'unscored')) AS risk_level, COUNT(*)::BIGINT AS cnt
    FROM period_jobs
    GROUP BY LOWER(COALESCE(NULLIF(TRIM(risk_level), ''), 'unscored'))
  ),
  period_avg_risk AS (
    SELECT ROUND(AVG(risk_score) FILTER (WHERE risk_score IS NOT NULL)::NUMERIC, 2) AS avg_risk
    FROM period_jobs
  ),
  docs_in_period AS (
    SELECT d.job_id
    FROM documents d
    WHERE d.organization_id = p_org_id
      AND d.created_at >= p_since
      AND d.created_at <= p_until
      AND EXISTS (SELECT 1 FROM period_jobs pj WHERE pj.id = d.job_id)
  ),
  evidence_agg AS (
    SELECT
      COUNT(*)::BIGINT AS total_items,
      COUNT(DISTINCT job_id)::BIGINT AS jobs_with_evidence
    FROM docs_in_period
  ),
  period_job_count AS (
    SELECT COUNT(*)::BIGINT AS n FROM period_jobs
  ),
  team_activity_raw AS (
    SELECT mi.completed_by AS user_id, COUNT(*)::BIGINT AS completions_count
    FROM mitigation_items mi
    WHERE mi.organization_id = p_org_id
      AND mi.completed_at IS NOT NULL
      AND mi.completed_at >= p_since
      AND mi.completed_at <= p_until
    GROUP BY mi.completed_by
    ORDER BY completions_count DESC
    LIMIT 20
  ),
  team_activity_json AS (
    SELECT COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'completions_count', completions_count))
       FROM (SELECT user_id, completions_count FROM team_activity_raw) t),
      '[]'::jsonb
    ) AS arr
  ),
  jobs_without AS (
    SELECT GREATEST(0, (SELECT n FROM period_job_count) - COALESCE((SELECT jobs_with_evidence FROM evidence_agg), 0))::BIGINT AS jobs_without_evidence
  )
  SELECT
    COALESCE((SELECT jsonb_object_agg(status, cnt) FROM job_status_counts), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(risk_level, cnt) FROM risk_level_counts), '{}'::jsonb),
    (SELECT COALESCE(total_items, 0) FROM evidence_agg),
    (SELECT COALESCE(jobs_with_evidence, 0) FROM evidence_agg),
    (SELECT jobs_without_evidence FROM jobs_without),
    (SELECT arr FROM team_activity_json),
    (SELECT avg_risk FROM period_avg_risk);
$$;

COMMENT ON FUNCTION get_analytics_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Analytics summary: job_counts_by_status, risk_level_distribution, evidence stats, team activity, avg_risk (weighted average risk_score in period).';
