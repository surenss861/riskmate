-- Analytics status-by-period: one row per (period_key, status) for jobs created in range.
-- Used by dashboard Jobs-by-status chart to show weekly (or daily) counts per status with valid ISO period for drill-down.

CREATE OR REPLACE FUNCTION get_analytics_status_by_period(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ,
  p_group_by TEXT DEFAULT 'week'
)
RETURNS TABLE(period_key TEXT, status TEXT, cnt BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_group TEXT := LOWER(COALESCE(TRIM(p_group_by), 'week'));
BEGIN
  IF v_group = 'day' THEN
    RETURN QUERY
    SELECT
      to_char((j.created_at AT TIME ZONE 'UTC')::DATE, 'YYYY-MM-DD') AS period_key,
      COALESCE(NULLIF(TRIM(j.status), ''), 'unknown') AS status,
      COUNT(*)::BIGINT AS cnt
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND j.created_at >= p_since
      AND j.created_at <= p_until
    GROUP BY (j.created_at AT TIME ZONE 'UTC')::DATE, COALESCE(NULLIF(TRIM(j.status), ''), 'unknown')
    ORDER BY 1, 2;
    RETURN;
  END IF;

  -- week (default): use Monday week start to match analytics_weekly_job_stats
  RETURN QUERY
  SELECT
    to_char(date_trunc_week_monday(j.created_at), 'YYYY-MM-DD') AS period_key,
    COALESCE(NULLIF(TRIM(j.status), ''), 'unknown') AS status,
    COUNT(*)::BIGINT AS cnt
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND j.created_at >= p_since
    AND j.created_at <= p_until
  GROUP BY date_trunc_week_monday(j.created_at), COALESCE(NULLIF(TRIM(j.status), ''), 'unknown')
  ORDER BY 1, 2;
END;
$$;

COMMENT ON FUNCTION get_analytics_status_by_period(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Returns job counts by period (week or day) and status for dashboard Jobs-by-status chart; period_key is ISO date for drill-down.';
