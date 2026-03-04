-- Hazard frequency: use hazards table as source of truth (not mitigation_items).
-- mitigation_items has no factor_id/code; hazards has hazard_type and organization_id.
--
-- After applying, verify in Supabase SQL editor (replace org id and dates as needed):
--   select * from public.get_hazard_frequency_buckets(
--     '8fb419d2-ade6-4ec1-ab80-bce3ffff151e'::uuid,
--     now() - interval '30 days',
--     now(),
--     now() - interval '60 days',
--     now() - interval '30 days',
--     'type'
--   ) limit 10;
--   select * from public.get_hazard_frequency_buckets(
--     '8fb419d2-ade6-4ec1-ab80-bce3ffff151e'::uuid,
--     now() - interval '30 days',
--     now(),
--     now() - interval '60 days',
--     now() - interval '30 days',
--     'location'
--   ) limit 10;

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
      FROM hazards h
      JOIN jobs j ON j.id = h.job_id AND j.organization_id = h.organization_id AND j.deleted_at IS NULL
      WHERE h.organization_id = p_org_id
        AND h.created_at >= p_since
        AND h.created_at <= p_until
      GROUP BY COALESCE(j.location, 'unknown')
    ),
    prev AS (
      SELECT
        COALESCE(j.location, 'unknown') AS cat,
        COUNT(*)::BIGINT AS cnt
      FROM hazards h
      JOIN jobs j ON j.id = h.job_id AND j.organization_id = h.organization_id AND j.deleted_at IS NULL
      WHERE h.organization_id = p_org_id
        AND h.created_at >= p_prev_since
        AND h.created_at < p_prev_until
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
        COALESCE(NULLIF(TRIM(h.hazard_type), ''), 'unknown') AS cat,
        COUNT(*)::BIGINT AS cnt,
        ROUND(AVG(j.risk_score) FILTER (WHERE j.risk_score IS NOT NULL)::NUMERIC, 2) AS avgr
      FROM hazards h
      JOIN jobs j ON j.id = h.job_id AND j.organization_id = h.organization_id AND j.deleted_at IS NULL
      WHERE h.organization_id = p_org_id
        AND h.created_at >= p_since
        AND h.created_at <= p_until
      GROUP BY COALESCE(NULLIF(TRIM(h.hazard_type), ''), 'unknown')
    ),
    prev AS (
      SELECT
        COALESCE(NULLIF(TRIM(h.hazard_type), ''), 'unknown') AS cat,
        COUNT(*)::BIGINT AS cnt
      FROM hazards h
      JOIN jobs j ON j.id = h.job_id AND j.organization_id = h.organization_id AND j.deleted_at IS NULL
      WHERE h.organization_id = p_org_id
        AND h.created_at >= p_prev_since
        AND h.created_at < p_prev_until
      GROUP BY COALESCE(NULLIF(TRIM(h.hazard_type), ''), 'unknown')
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
  'Hazard frequency from hazards table: group by hazard_type or job location.';
