-- Team performance: limit open_jobs to requested window so jobs_assigned and completion_rate are period-scoped.
-- jobs_assigned = completed_in_period + open jobs with created_at in [p_since, p_until].

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
  -- Open assigned jobs with created_at in period (for period-scoped jobs_assigned)
  open_jobs AS (
    SELECT j.assigned_to_id, j.id,
      (j.due_date IS NOT NULL AND j.due_date < clock_timestamp()) AS is_overdue
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) != 'completed'
      AND j.assigned_to_id IS NOT NULL
      AND j.created_at >= p_since
      AND j.created_at <= p_until
  ),
  -- All-time open jobs for overdue_count only (includes pre-period backlog)
  open_jobs_all_time AS (
    SELECT j.assigned_to_id, j.id,
      (j.due_date IS NOT NULL AND j.due_date < clock_timestamp()) AS is_overdue
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) != 'completed'
      AND j.assigned_to_id IS NOT NULL
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
    FROM open_jobs_all_time
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
  'Returns per-user team performance aggregates; jobs_assigned = completed in period + open jobs created in [p_since, p_until]; overdue_count includes all open overdue (all-time open_jobs_all_time).';
