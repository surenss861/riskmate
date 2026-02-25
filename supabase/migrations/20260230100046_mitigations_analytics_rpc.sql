-- Server-side mitigations analytics: single RPC for KPIs and one for daily trend.
-- Replaces client-side fetch-and-aggregate in app/api/analytics/mitigations/route.ts (O(1) queries).

CREATE OR REPLACE FUNCTION get_mitigations_analytics_kpis(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ,
  p_crew_id UUID DEFAULT NULL
)
RETURNS TABLE (
  completion_rate NUMERIC,
  avg_time_to_close_hours NUMERIC,
  high_risk_jobs BIGINT,
  evidence_count BIGINT,
  jobs_with_evidence BIGINT,
  jobs_without_evidence BIGINT,
  avg_time_to_first_evidence_hours NUMERIC,
  jobs_total BIGINT,
  jobs_scored BIGINT,
  jobs_with_any_evidence BIGINT,
  jobs_with_photo_evidence BIGINT,
  jobs_missing_required_evidence BIGINT,
  avg_time_to_first_photo_minutes NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_job_ids UUID[];
  v_since_lo TIMESTAMPTZ := p_since;
  v_until_lo TIMESTAMPTZ := p_until;
BEGIN
  -- Build job set: with crew = jobs with mitigation activity by that crew in range; else jobs created in range OR with mitigation in range
  IF p_crew_id IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT mi.job_id), '{}')
    INTO v_job_ids
    FROM mitigation_items mi
    WHERE mi.organization_id = p_org_id
      AND mi.completed_by = p_crew_id
      AND (mi.created_at >= v_since_lo OR mi.completed_at >= v_since_lo);
  ELSE
    SELECT COALESCE(ARRAY_AGG(DISTINCT j.id), '{}')
    INTO v_job_ids
    FROM (
      SELECT id FROM jobs j
      WHERE j.organization_id = p_org_id
        AND j.deleted_at IS NULL
        AND j.created_at >= v_since_lo
      UNION
      SELECT mi.job_id FROM mitigation_items mi
      WHERE mi.organization_id = p_org_id
        AND (mi.created_at >= v_since_lo OR mi.completed_at >= v_since_lo)
    ) u
    JOIN jobs j ON j.id = u.id
    WHERE j.organization_id = p_org_id AND j.deleted_at IS NULL;
  END IF;

  IF v_job_ids = '{}' OR array_length(v_job_ids, 1) IS NULL THEN
    RETURN QUERY SELECT
      0::NUMERIC, 0::NUMERIC, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::NUMERIC,
      0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, NULL::NUMERIC;
    RETURN;
  END IF;

  RETURN QUERY
  WITH scope_jobs AS (
    SELECT j.id, j.risk_score, j.created_at
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND j.id = ANY(v_job_ids)
  ),
  mit_base AS (
    SELECT mi.job_id, mi.created_at, mi.completed_at
    FROM mitigation_items mi
    WHERE mi.organization_id = p_org_id
      AND mi.job_id = ANY(v_job_ids)
      AND (mi.created_at >= v_since_lo OR mi.completed_at >= v_since_lo)
      AND (p_crew_id IS NULL OR mi.completed_by = p_crew_id)
  ),
  mit_agg AS (
    SELECT
      COUNT(*)::BIGINT AS total,
      COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::BIGINT AS completed,
      AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600.0) FILTER (WHERE completed_at IS NOT NULL)::NUMERIC AS avg_hrs
    FROM mit_base
  ),
  docs_first AS (
    SELECT d.job_id,
      MIN(d.created_at) AS first_at
    FROM documents d
    WHERE d.organization_id = p_org_id
      AND d.job_id = ANY(v_job_ids)
      AND d.created_at >= v_since_lo
    GROUP BY d.job_id
  ),
  docs_photo_first AS (
    SELECT d.job_id,
      MIN(d.created_at) AS first_at
    FROM documents d
    WHERE d.organization_id = p_org_id
      AND d.job_id = ANY(v_job_ids)
      AND d.created_at >= v_since_lo
      AND d.type = 'photo'
    GROUP BY d.job_id
  ),
  kpis AS (
    SELECT
      (SELECT total FROM mit_agg) AS total,
      (SELECT completed FROM mit_agg) AS completed,
      (SELECT avg_hrs FROM mit_agg) AS avg_hrs,
      (SELECT COUNT(*)::BIGINT FROM scope_jobs WHERE risk_score IS NOT NULL AND risk_score >= 70) AS high_risk_jobs,
      (SELECT COUNT(*)::BIGINT FROM documents d WHERE d.organization_id = p_org_id AND d.job_id = ANY(v_job_ids) AND d.created_at >= v_since_lo) AS evidence_count,
      (SELECT COUNT(DISTINCT job_id)::BIGINT FROM docs_first) AS jobs_with_evidence,
      (SELECT COUNT(*)::BIGINT FROM scope_jobs) AS jobs_total,
      (SELECT COUNT(*)::BIGINT FROM scope_jobs WHERE risk_score IS NOT NULL) AS jobs_scored,
      (SELECT COUNT(*)::BIGINT FROM docs_photo_first) AS jobs_with_photo_evidence,
      (SELECT COUNT(*)::BIGINT FROM scope_jobs j WHERE j.risk_score IS NOT NULL AND j.risk_score >= 70 AND NOT EXISTS (SELECT 1 FROM docs_photo_first dp WHERE dp.job_id = j.id)) AS jobs_missing_required_evidence
    FROM mit_agg
  )
  SELECT
    CASE WHEN (k.total) = 0 THEN 0::NUMERIC ELSE ROUND((k.completed::NUMERIC / NULLIF(k.total, 0))::NUMERIC, 3) END,
    COALESCE(ROUND(k.avg_hrs::NUMERIC, 2), 0::NUMERIC),
    k.high_risk_jobs,
    k.evidence_count,
    k.jobs_with_evidence,
    GREATEST(k.jobs_total - k.jobs_with_evidence, 0),
    CASE WHEN k.jobs_with_evidence = 0 THEN 0::NUMERIC
         ELSE ROUND(
           (SELECT AVG(EXTRACT(EPOCH FROM (df.first_at - j.created_at)) / 3600.0)
            FROM docs_first df
            JOIN scope_jobs j ON j.id = df.job_id)::NUMERIC,
           2
         )
    END,
    k.jobs_total,
    k.jobs_scored,
    k.jobs_with_evidence,
    k.jobs_with_photo_evidence,
    k.jobs_missing_required_evidence,
    CASE WHEN k.jobs_with_photo_evidence = 0 THEN NULL::NUMERIC
         ELSE ROUND(
           (SELECT AVG(EXTRACT(EPOCH FROM (dp.first_at - j.created_at)) / 60.0)
            FROM docs_photo_first dp
            JOIN scope_jobs j ON j.id = dp.job_id)::NUMERIC,
           0
         )
    END
  FROM kpis k;
END;
$$;

COMMENT ON FUNCTION get_mitigations_analytics_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) IS
  'Mitigations analytics KPIs in one call; p_crew_id optional. O(1) server-side aggregation.';

-- Daily trend: completion_rate per day (items created that day, rate = completed that day / total created that day)
CREATE OR REPLACE FUNCTION get_mitigations_analytics_trend(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ,
  p_crew_id UUID DEFAULT NULL
)
RETURNS TABLE (period_key DATE, completion_rate NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_job_ids UUID[];
  v_since_lo TIMESTAMPTZ := p_since;
BEGIN
  IF p_crew_id IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT mi.job_id), '{}')
    INTO v_job_ids
    FROM mitigation_items mi
    WHERE mi.organization_id = p_org_id
      AND mi.completed_by = p_crew_id
      AND (mi.created_at >= v_since_lo OR mi.completed_at >= v_since_lo);
  ELSE
    SELECT COALESCE(ARRAY_AGG(DISTINCT j.id), '{}')
    INTO v_job_ids
    FROM (
      SELECT id FROM jobs j
      WHERE j.organization_id = p_org_id AND j.deleted_at IS NULL AND j.created_at >= v_since_lo
      UNION
      SELECT mi.job_id FROM mitigation_items mi
      WHERE mi.organization_id = p_org_id
        AND (mi.created_at >= v_since_lo OR mi.completed_at >= v_since_lo)
    ) u
    JOIN jobs j ON j.id = u.id
    WHERE j.organization_id = p_org_id AND j.deleted_at IS NULL;
  END IF;

  IF v_job_ids = '{}' OR array_length(v_job_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH mit_base AS (
    SELECT
      (mi.created_at AT TIME ZONE 'UTC')::DATE AS pk,
      mi.created_at,
      mi.completed_at
    FROM mitigation_items mi
    WHERE mi.organization_id = p_org_id
      AND mi.job_id = ANY(v_job_ids)
      AND (mi.created_at >= v_since_lo OR mi.completed_at >= v_since_lo)
      AND (p_crew_id IS NULL OR mi.completed_by = p_crew_id)
  ),
  by_day AS (
    SELECT
      pk,
      COUNT(*)::BIGINT AS total,
      COUNT(*) FILTER (WHERE (completed_at AT TIME ZONE 'UTC')::DATE = pk)::BIGINT AS completed
    FROM mit_base
    GROUP BY pk
  )
  SELECT
    by_day.pk,
    CASE WHEN by_day.total = 0 THEN 0::NUMERIC
         ELSE ROUND((by_day.completed::NUMERIC / NULLIF(by_day.total, 0))::NUMERIC, 3)
    END
  FROM by_day
  ORDER BY by_day.pk;
END;
$$;

COMMENT ON FUNCTION get_mitigations_analytics_trend(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) IS
  'Daily mitigation completion rate trend; p_crew_id optional.';
