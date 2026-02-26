-- Dashboard summary: server-side RPCs to avoid full job/document scans and meet latency target.
-- KPIs, top lists, and chart data in aggregates; no per-job document lookups.

-- Single row: jobs_total, jobs_completed, avg_risk, on_time_count, overdue_count for period (jobs created in [p_since, p_until]).
CREATE OR REPLACE FUNCTION get_dashboard_summary_kpis(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ
)
RETURNS TABLE (
  jobs_total BIGINT,
  jobs_completed BIGINT,
  avg_risk NUMERIC,
  on_time_count BIGINT,
  overdue_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH period_jobs AS (
    SELECT
      j.id,
      j.risk_score,
      j.status,
      j.due_date,
      j.completed_at,
      j.created_at
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND j.created_at >= p_since
      AND j.created_at <= p_until
  ),
  agg AS (
    SELECT
      COUNT(*)::BIGINT AS jobs_total,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'completed')::BIGINT AS jobs_completed,
      ROUND(AVG(risk_score) FILTER (WHERE risk_score IS NOT NULL)::NUMERIC, 2) AS avg_risk,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(status, '')) = 'completed'
          AND due_date IS NOT NULL
          AND COALESCE(completed_at, created_at) <= due_date
      )::BIGINT AS on_time_count,
      (
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(status, '')) = 'completed'
            AND due_date IS NOT NULL
            AND COALESCE(completed_at, created_at) > due_date
        )
        + COUNT(*) FILTER (
          WHERE LOWER(COALESCE(status, '')) != 'completed'
            AND due_date IS NOT NULL
            AND due_date < clock_timestamp()
        )
      )::BIGINT AS overdue_count
    FROM period_jobs
  )
  SELECT a.jobs_total, a.jobs_completed, a.avg_risk, a.on_time_count, a.overdue_count FROM agg a;
$$;

COMMENT ON FUNCTION get_dashboard_summary_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Dashboard summary KPIs for one period: jobs_total, jobs_completed, avg_risk, on_time_count, overdue_count (jobs created in period).';

-- Top jobs by risk (risk_score >= 70), limit p_limit.
CREATE OR REPLACE FUNCTION get_dashboard_jobs_at_risk(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  client_name TEXT,
  job_type TEXT,
  location TEXT,
  status TEXT,
  risk_score NUMERIC,
  risk_level TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    j.id,
    j.client_name,
    j.job_type,
    j.location,
    j.status,
    j.risk_score,
    j.risk_level,
    j.created_at
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND j.created_at >= p_since
    AND j.created_at <= p_until
    AND j.risk_score IS NOT NULL
    AND j.risk_score >= 70
  ORDER BY j.risk_score DESC, j.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));
$$;

COMMENT ON FUNCTION get_dashboard_jobs_at_risk(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) IS
  'Top jobs at risk (risk_score >= 70) in period for dashboard list.';

-- Jobs in period with document count < 3 (evidence count in SQL).
CREATE OR REPLACE FUNCTION get_dashboard_missing_evidence_jobs(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  client_name TEXT,
  job_type TEXT,
  location TEXT,
  status TEXT,
  risk_score NUMERIC,
  risk_level TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH doc_counts AS (
    SELECT d.job_id, COUNT(*)::BIGINT AS cnt
    FROM documents d
    WHERE d.organization_id = p_org_id
    GROUP BY d.job_id
  )
  SELECT
    j.id,
    j.client_name,
    j.job_type,
    j.location,
    j.status,
    j.risk_score,
    j.risk_level,
    j.created_at
  FROM jobs j
  LEFT JOIN doc_counts d ON d.job_id = j.id
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND j.created_at >= p_since
    AND j.created_at <= p_until
    AND COALESCE(d.cnt, 0) < 3
  ORDER BY j.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));
$$;

COMMENT ON FUNCTION get_dashboard_missing_evidence_jobs(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) IS
  'Jobs in period with fewer than 3 documents (missing evidence) for dashboard list.';

-- Chart data: one row per day in range. Same cohort: jobs_created and jobs_completed both by creation date; jobs_completed = jobs created that day that are completed with completed_at within window. Rate = jobs_completed / jobs_created, 0–100.
CREATE OR REPLACE FUNCTION get_dashboard_chart_data(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ
)
RETURNS TABLE (
  period_key DATE,
  jobs_created BIGINT,
  jobs_completed BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH date_series AS (
    SELECT generate_series(
      (p_since AT TIME ZONE 'UTC')::date,
      (p_until AT TIME ZONE 'UTC')::date,
      '1 day'::interval
    )::date AS period_key
  ),
  created AS (
    SELECT (j.created_at AT TIME ZONE 'UTC')::date AS period_key,
      COUNT(*)::BIGINT AS jobs_created
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND j.created_at >= p_since
      AND j.created_at <= p_until
    GROUP BY (j.created_at AT TIME ZONE 'UTC')::date
  ),
  completed_same_cohort AS (
    SELECT (j.created_at AT TIME ZONE 'UTC')::date AS period_key,
      COUNT(*)::BIGINT AS jobs_completed
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) = 'completed'
      AND j.completed_at IS NOT NULL
      AND j.completed_at >= p_since
      AND j.completed_at <= p_until
      AND j.created_at >= p_since
      AND j.created_at <= p_until
    GROUP BY (j.created_at AT TIME ZONE 'UTC')::date
  )
  SELECT
    ds.period_key,
    COALESCE(c.jobs_created, 0)::BIGINT,
    COALESCE(p.jobs_completed, 0)::BIGINT
  FROM date_series ds
  LEFT JOIN created c ON c.period_key = ds.period_key
  LEFT JOIN completed_same_cohort p ON p.period_key = ds.period_key
  ORDER BY ds.period_key;
$$;

COMMENT ON FUNCTION get_dashboard_chart_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Per-day jobs_created and jobs_completed (same cohort: jobs created that day, completed with completed_at in window); rate never exceeds 100.';
