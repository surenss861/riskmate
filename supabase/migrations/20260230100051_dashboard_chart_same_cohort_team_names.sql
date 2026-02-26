-- Dashboard chart: same-cohort completion rate (completions aligned to creations per day) so rate never exceeds 100%.
-- Team performance: RPC to resolve display names from org-scoped profile source (users), RLS-safe via SECURITY DEFINER.

-- 1) get_team_member_display_names: returns (user_id, display_name) for org members; use for team-performance name lookup.
--    Reads from users (id, full_name, organization_id). If a profiles table with organization_id is added later, switch this RPC to it.
CREATE OR REPLACE FUNCTION get_team_member_display_names(
  p_org_id UUID,
  p_user_ids UUID[]
)
RETURNS TABLE (user_id UUID, display_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id AS user_id,
    COALESCE(TRIM(u.full_name), '') AS display_name
  FROM users u
  WHERE u.organization_id = p_org_id
    AND u.id = ANY(p_user_ids);
$$;

COMMENT ON FUNCTION get_team_member_display_names(UUID, UUID[]) IS
  'Returns display names for user IDs in the given org; used by team-performance to resolve names (RLS-safe).';

-- 2) get_dashboard_chart_data: same-cohort completion so chart rate is 0–100.
--    jobs_created = count created that day (unchanged).
--    jobs_completed = count of jobs *created that day* that are completed (same cohort); rate = jobs_completed / jobs_created, clamp 0–100.
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
  -- Same cohort: jobs created on period_key that are completed (any completion date)
  completed_same_cohort AS (
    SELECT (j.created_at AT TIME ZONE 'UTC')::date AS period_key,
      COUNT(*)::BIGINT AS jobs_completed
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) = 'completed'
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
  'Per-day jobs_created and jobs_completed (same cohort: completed count is only jobs created that day); route clamps rate to 0–100.';
