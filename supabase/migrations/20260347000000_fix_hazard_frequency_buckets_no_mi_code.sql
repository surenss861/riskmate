-- Fix get_hazard_frequency_buckets: mitigation_items has no "code" column (use factor_id, title only).
-- Error was: column mi.code does not exist (hint: Perhaps you meant mi.done).

CREATE OR REPLACE FUNCTION get_hazard_frequency_buckets(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ,
  p_prev_since TIMESTAMPTZ,
  p_prev_until TIMESTAMPTZ,
  p_group_by TEXT
)
RETURNS TABLE (
  category TEXT,
  count BIGINT,
  avg_risk NUMERIC,
  prev_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_group_by = 'location' THEN
    RETURN QUERY
    WITH cur AS (
      SELECT
        COALESCE(j.location, 'unknown') AS cat,
        COUNT(*)::BIGINT AS cnt,
        ROUND(AVG(j.risk_score) FILTER (WHERE j.risk_score IS NOT NULL)::NUMERIC, 2) AS avgr
      FROM mitigation_items mi
      JOIN jobs j ON j.id = mi.job_id AND j.organization_id = mi.organization_id AND j.deleted_at IS NULL
      WHERE mi.organization_id = p_org_id
        AND mi.created_at >= p_since
        AND mi.created_at <= p_until
      GROUP BY COALESCE(j.location, 'unknown')
    ),
    prev AS (
      SELECT
        COALESCE(j.location, 'unknown') AS cat,
        COUNT(*)::BIGINT AS cnt
      FROM mitigation_items mi
      JOIN jobs j ON j.id = mi.job_id AND j.organization_id = mi.organization_id AND j.deleted_at IS NULL
      WHERE mi.organization_id = p_org_id
        AND mi.created_at >= p_prev_since
        AND mi.created_at < p_prev_until
      GROUP BY COALESCE(j.location, 'unknown')
    )
    SELECT
      cur.cat::TEXT,
      cur.cnt,
      cur.avgr,
      COALESCE(prev.cnt, 0)::BIGINT
    FROM cur
    LEFT JOIN prev ON prev.cat = cur.cat
    ORDER BY cur.cnt DESC;
  ELSE
    RETURN QUERY
    WITH cur AS (
      SELECT
        COALESCE(mi.factor_id::TEXT, NULLIF(TRIM(mi.title), ''), 'unknown') AS cat,
        COUNT(*)::BIGINT AS cnt,
        ROUND(AVG(j.risk_score) FILTER (WHERE j.risk_score IS NOT NULL)::NUMERIC, 2) AS avgr
      FROM mitigation_items mi
      JOIN jobs j ON j.id = mi.job_id AND j.organization_id = mi.organization_id AND j.deleted_at IS NULL
      WHERE mi.organization_id = p_org_id
        AND mi.created_at >= p_since
        AND mi.created_at <= p_until
      GROUP BY COALESCE(mi.factor_id::TEXT, NULLIF(TRIM(mi.title), ''), 'unknown')
    ),
    prev AS (
      SELECT
        COALESCE(mi.factor_id::TEXT, NULLIF(TRIM(mi.title), ''), 'unknown') AS cat,
        COUNT(*)::BIGINT AS cnt
      FROM mitigation_items mi
      JOIN jobs j ON j.id = mi.job_id AND j.organization_id = mi.organization_id AND j.deleted_at IS NULL
      WHERE mi.organization_id = p_org_id
        AND mi.created_at >= p_prev_since
        AND mi.created_at < p_prev_until
      GROUP BY COALESCE(mi.factor_id::TEXT, NULLIF(TRIM(mi.title), ''), 'unknown')
    )
    SELECT
      cur.cat::TEXT,
      cur.cnt,
      cur.avgr,
      COALESCE(prev.cnt, 0)::BIGINT
    FROM cur
    LEFT JOIN prev ON prev.cat = cur.cat
    ORDER BY cur.cnt DESC;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_hazard_frequency_buckets(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Pre-aggregated hazard frequency by category; p_group_by is type or location. Uses mitigation_items.factor_id and title (no code column).';
