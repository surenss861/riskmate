-- Analytics: targeted indexes and server-side aggregate RPCs for <500ms SLA.
-- Indexes support range scans and lookups; RPCs avoid per-row pagination.

-- Indexes for analytics queries (avoid full table scans)
CREATE INDEX IF NOT EXISTS idx_mitigation_items_org_created
  ON mitigation_items(organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_signatures_org_job
  ON signatures(organization_id, job_id);

CREATE INDEX IF NOT EXISTS idx_documents_org_job_type
  ON documents(organization_id, job_id, type)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_org_created
  ON jobs(organization_id, created_at)
  WHERE deleted_at IS NULL;

-- Job completion KPIs in one round-trip (organization_id + deleted_at IS NULL applied).
-- Returns: total, completed, avg_days_to_complete, on_time_count, overdue_count_period, overdue_count_all_time
CREATE OR REPLACE FUNCTION get_job_completion_kpis(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ
)
RETURNS TABLE (
  total BIGINT,
  completed BIGINT,
  avg_days_to_complete NUMERIC,
  on_time_count BIGINT,
  overdue_count_period BIGINT,
  overdue_count_all_time BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed BIGINT;
  v_open_in_period BIGINT;
  v_total BIGINT;
  v_avg_days NUMERIC;
  v_on_time BIGINT;
  v_overdue_period BIGINT;
  v_overdue_all BIGINT;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Completed in period: completion date = completed_at when not null else created_at (no updated_at)
  SELECT COUNT(*)::BIGINT INTO v_completed
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND LOWER(COALESCE(j.status, '')) = 'completed'
    AND (
      (j.completed_at IS NOT NULL AND j.completed_at >= p_since AND j.completed_at <= p_until)
      OR (j.completed_at IS NULL AND j.created_at >= p_since AND j.created_at <= p_until)
    );

  -- Open jobs as of period end (denominator for completion_rate; includes backlog up to p_until)
  SELECT COUNT(*)::BIGINT INTO v_open_in_period
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND LOWER(COALESCE(j.status, '')) != 'completed'
    AND j.created_at <= p_until;

  v_total := v_completed + v_open_in_period;

  -- Avg days to complete and on_time count (completed_at when not null else created_at; no updated_at)
  SELECT
    COALESCE(AVG(
      EXTRACT(EPOCH FROM (
        COALESCE(j.completed_at, j.created_at) - j.created_at
      )) / 86400.0
    ), 0),
    COUNT(*) FILTER (WHERE j.due_date IS NOT NULL AND COALESCE(j.completed_at, j.created_at) <= j.due_date)::BIGINT
  INTO v_avg_days, v_on_time
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND LOWER(COALESCE(j.status, '')) = 'completed'
    AND (
      (j.completed_at IS NOT NULL AND j.completed_at >= p_since AND j.completed_at <= p_until)
      OR (j.completed_at IS NULL AND j.created_at >= p_since AND j.created_at <= p_until)
    );

  -- Period-scoped overdue: (1) completed in period with due in window and completed after due (completed_at/created_at), (2) all open jobs with due_date < now (includes long-overdue)
  SELECT (
    (SELECT COUNT(*)::BIGINT FROM jobs j
     WHERE j.organization_id = p_org_id AND j.deleted_at IS NULL AND LOWER(COALESCE(j.status, '')) = 'completed'
       AND j.due_date IS NOT NULL
       AND j.due_date::date >= p_since::date AND j.due_date::date <= p_until::date
       AND COALESCE(j.completed_at, j.created_at) > j.due_date
       AND (
         (j.completed_at IS NOT NULL AND j.completed_at >= p_since AND j.completed_at <= p_until)
         OR (j.completed_at IS NULL AND j.created_at >= p_since AND j.created_at <= p_until)
       ))
    +
    (SELECT COUNT(*)::BIGINT FROM jobs j
     WHERE j.organization_id = p_org_id AND j.deleted_at IS NULL AND LOWER(COALESCE(j.status, '')) != 'completed'
       AND j.due_date IS NOT NULL
       AND j.due_date < v_now)
  ) INTO v_overdue_period;

  -- All-time overdue: open jobs with due_date < now
  SELECT COUNT(*)::BIGINT INTO v_overdue_all
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND LOWER(COALESCE(j.status, '')) != 'completed'
    AND j.due_date IS NOT NULL
    AND j.due_date < v_now;

  total := v_total;
  completed := v_completed;
  avg_days_to_complete := ROUND(v_avg_days::numeric, 2);
  on_time_count := v_on_time;
  overdue_count_period := v_overdue_period;
  overdue_count_all_time := v_overdue_all;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION get_job_completion_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Returns job-completion KPIs for analytics in one round-trip; org-scoped, deleted_at IS NULL.';

-- Team performance: per-user aggregates (jobs_assigned = completed-in-period + all open assigned).
-- Returns: user_id, jobs_assigned, jobs_completed, sum_days, count_completed, overdue_count
CREATE OR REPLACE FUNCTION get_team_performance_kpis(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ
)
RETURNS TABLE (
  user_id UUID,
  jobs_assigned BIGINT,
  jobs_completed BIGINT,
  sum_days NUMERIC,
  count_completed BIGINT,
  overdue_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH completed_in_period AS (
    SELECT
      j.assigned_to_id,
      j.id,
      j.due_date,
      EXTRACT(EPOCH FROM (COALESCE(j.completed_at, j.updated_at, j.created_at) - j.created_at)) / 86400.0 AS days_to_complete,
      (j.due_date IS NOT NULL AND COALESCE(j.completed_at, j.updated_at, j.created_at) > j.due_date) AS completed_late
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) = 'completed'
      AND j.assigned_to_id IS NOT NULL
      AND (
        (j.completed_at IS NOT NULL AND j.completed_at >= p_since AND j.completed_at <= p_until)
        OR (j.completed_at IS NULL AND j.updated_at IS NOT NULL AND j.updated_at >= p_since AND j.updated_at <= p_until)
        OR (j.completed_at IS NULL AND j.updated_at IS NULL AND j.created_at >= p_since AND j.created_at <= p_until)
      )
  ),
  open_jobs AS (
    SELECT j.assigned_to_id, j.id,
      (j.due_date IS NOT NULL AND j.due_date < clock_timestamp()) AS is_overdue
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) != 'completed'
      AND j.assigned_to_id IS NOT NULL
      AND j.created_at <= p_until
  ),
  assigned_union AS (
    SELECT assigned_to_id, id FROM completed_in_period
    UNION
    SELECT assigned_to_id, id FROM open_jobs
  ),
  user_ids AS (
    SELECT DISTINCT assigned_to_id AS user_id FROM assigned_union
  ),
  jobs_assigned_per_user AS (
    SELECT assigned_to_id, COUNT(*)::BIGINT AS cnt
    FROM assigned_union
    GROUP BY assigned_to_id
  ),
  completed_per_user AS (
    SELECT
      assigned_to_id,
      COUNT(*)::BIGINT AS jobs_completed,
      COALESCE(SUM(days_to_complete), 0) AS sum_days,
      COUNT(*) FILTER (WHERE completed_late)::BIGINT AS overdue_completed
    FROM completed_in_period
    GROUP BY assigned_to_id
  ),
  open_overdue_per_user AS (
    SELECT assigned_to_id, COUNT(*) FILTER (WHERE is_overdue)::BIGINT AS overdue_open
    FROM open_jobs
    GROUP BY assigned_to_id
  )
  SELECT
    u.user_id,
    COALESCE(a.cnt, 0)::BIGINT AS jobs_assigned,
    COALESCE(c.jobs_completed, 0)::BIGINT AS jobs_completed,
    COALESCE(c.sum_days, 0) AS sum_days,
    COALESCE(c.jobs_completed, 0)::BIGINT AS count_completed,
    (COALESCE(c.overdue_completed, 0) + COALESCE(o.overdue_open, 0))::BIGINT AS overdue_count
  FROM user_ids u
  LEFT JOIN jobs_assigned_per_user a ON a.assigned_to_id = u.user_id
  LEFT JOIN completed_per_user c ON c.assigned_to_id = u.user_id
  LEFT JOIN open_overdue_per_user o ON o.assigned_to_id = u.user_id;
$$;

COMMENT ON FUNCTION get_team_performance_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Returns per-user team performance aggregates; jobs_assigned and overdue_count include completed in period plus all open assigned jobs as of period end (backlog).';
