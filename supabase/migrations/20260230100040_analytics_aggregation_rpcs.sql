-- SQL-side aggregation for analytics endpoints (<500ms SLA).
-- Risk heatmap, hazard frequency, compliance rate, trends (compliance) — pre-aggregated in DB.

-- Risk heatmap: buckets by job_type and day_of_week (UTC 0=Sun..6=Sat to match JS getUTCDay()), avg_risk and count
CREATE OR REPLACE FUNCTION get_risk_heatmap_buckets(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ
)
RETURNS TABLE (
  job_type TEXT,
  day_of_week INT,
  avg_risk NUMERIC,
  count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    COALESCE(j.job_type::TEXT, 'other') AS job_type,
    EXTRACT(DOW FROM j.created_at AT TIME ZONE 'UTC')::INT AS day_of_week,
    ROUND(AVG(j.risk_score) FILTER (WHERE j.risk_score IS NOT NULL)::NUMERIC, 2) AS avg_risk,
    COUNT(*)::BIGINT AS count
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND j.created_at >= p_since
    AND j.created_at <= p_until
  GROUP BY COALESCE(j.job_type::TEXT, 'other'), EXTRACT(DOW FROM j.created_at AT TIME ZONE 'UTC')
  ORDER BY count DESC;
$$;

-- Hazard frequency: current and previous period counts per category (type or location)
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
        COALESCE(NULLIF(TRIM(mi.code), ''), mi.factor_id::TEXT, NULLIF(TRIM(mi.title), ''), 'unknown') AS cat,
        COUNT(*)::BIGINT AS cnt,
        ROUND(AVG(j.risk_score) FILTER (WHERE j.risk_score IS NOT NULL)::NUMERIC, 2) AS avgr
      FROM mitigation_items mi
      JOIN jobs j ON j.id = mi.job_id AND j.organization_id = mi.organization_id AND j.deleted_at IS NULL
      WHERE mi.organization_id = p_org_id
        AND mi.created_at >= p_since
        AND mi.created_at <= p_until
      GROUP BY COALESCE(NULLIF(TRIM(mi.code), ''), mi.factor_id::TEXT, NULLIF(TRIM(mi.title), ''), 'unknown')
    ),
    prev AS (
      SELECT
        COALESCE(NULLIF(TRIM(mi.code), ''), mi.factor_id::TEXT, NULLIF(TRIM(mi.title), ''), 'unknown') AS cat,
        COUNT(*)::BIGINT AS cnt
      FROM mitigation_items mi
      JOIN jobs j ON j.id = mi.job_id AND j.organization_id = mi.organization_id AND j.deleted_at IS NULL
      WHERE mi.organization_id = p_org_id
        AND mi.created_at >= p_prev_since
        AND mi.created_at < p_prev_until
      GROUP BY COALESCE(NULLIF(TRIM(mi.code), ''), mi.factor_id::TEXT, NULLIF(TRIM(mi.title), ''), 'unknown')
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
  'Pre-aggregated hazard frequency by category; p_group_by is type or location.';

-- Compliance rate: one row with total_jobs, jobs_with_signature, jobs_with_photo, jobs_checklist_complete
CREATE OR REPLACE FUNCTION get_compliance_rate_kpis(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ
)
RETURNS TABLE (
  total_jobs BIGINT,
  jobs_with_signature BIGINT,
  jobs_with_photo BIGINT,
  jobs_checklist_complete BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH period_jobs AS (
    SELECT j.id
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND j.created_at >= p_since
      AND j.created_at <= p_until
  ),
  with_sig AS (
    SELECT COUNT(DISTINCT s.job_id)::BIGINT AS cnt
    FROM signatures s
    WHERE s.organization_id = p_org_id
      AND s.created_at >= p_since
      AND s.created_at <= p_until
      AND EXISTS (SELECT 1 FROM period_jobs pj WHERE pj.id = s.job_id)
  ),
  with_photo AS (
    SELECT COUNT(DISTINCT d.job_id)::BIGINT AS cnt
    FROM documents d
    WHERE d.organization_id = p_org_id
      AND d.type = 'photo'
      AND d.created_at >= p_since
      AND d.created_at <= p_until
      AND EXISTS (SELECT 1 FROM period_jobs pj WHERE pj.id = d.job_id)
  ),
  mit_agg AS (
    SELECT
      mi.job_id,
      COUNT(*)::BIGINT AS total,
      COUNT(*) FILTER (WHERE mi.completed_at IS NOT NULL AND mi.completed_at >= p_since AND mi.completed_at <= p_until)::BIGINT AS completed
    FROM mitigation_items mi
    WHERE mi.organization_id = p_org_id
    GROUP BY mi.job_id
  ),
  checklist_ok AS (
    SELECT COUNT(*)::BIGINT AS cnt
    FROM period_jobs pj
    LEFT JOIN mit_agg m ON m.job_id = pj.id
    WHERE COALESCE(m.total, 0) = 0 OR (m.completed::NUMERIC / NULLIF(m.total, 0)) = 1
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM period_jobs),
    (SELECT cnt FROM with_sig),
    (SELECT cnt FROM with_photo),
    (SELECT cnt FROM checklist_ok);
$$;

COMMENT ON FUNCTION get_compliance_rate_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Compliance KPIs: total jobs in period and counts with signature, photo, full checklist.';

-- Trends compliance: bucketed by day/week/month — period_key, total, with_signature, with_photo, checklist_complete
CREATE OR REPLACE FUNCTION get_trends_compliance_buckets(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ,
  p_group_by TEXT
)
RETURNS TABLE (
  period_key DATE,
  total BIGINT,
  with_signature BIGINT,
  with_photo BIGINT,
  checklist_complete BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_group_by = 'month' THEN
    RETURN QUERY
    WITH buckets AS (
      SELECT
        (DATE_TRUNC('month', j.created_at AT TIME ZONE 'UTC'))::DATE AS pk,
        j.id
      FROM jobs j
      WHERE j.organization_id = p_org_id
        AND j.deleted_at IS NULL
        AND j.created_at >= p_since
        AND j.created_at <= p_until
    ),
    sigs AS (SELECT s.job_id FROM signatures s WHERE s.organization_id = p_org_id AND s.created_at >= p_since AND s.created_at <= p_until),
    photos AS (SELECT d.job_id FROM documents d WHERE d.organization_id = p_org_id AND d.type = 'photo' AND d.created_at >= p_since AND d.created_at <= p_until),
    mit_agg AS (
      SELECT mi.job_id,
        COUNT(*)::BIGINT AS total,
        COUNT(*) FILTER (WHERE mi.completed_at IS NOT NULL AND mi.completed_at >= p_since AND mi.completed_at <= p_until)::BIGINT AS completed
      FROM mitigation_items mi
      WHERE mi.organization_id = p_org_id
      GROUP BY mi.job_id
    ),
    with_check AS (
      SELECT b.pk, b.id
      FROM buckets b
      LEFT JOIN mit_agg m ON m.job_id = b.id
      WHERE COALESCE(m.total, 0) = 0 OR (m.completed::NUMERIC / NULLIF(m.total, 0)) = 1
    )
    SELECT
      b.pk,
      COUNT(DISTINCT b.id)::BIGINT,
      COUNT(DISTINCT b.id) FILTER (WHERE s.job_id IS NOT NULL)::BIGINT,
      COUNT(DISTINCT b.id) FILTER (WHERE p.job_id IS NOT NULL)::BIGINT,
      COUNT(DISTINCT b.id) FILTER (WHERE wc.id IS NOT NULL)::BIGINT
    FROM (SELECT DISTINCT pk, id FROM buckets) b
    LEFT JOIN sigs s ON s.job_id = b.id
    LEFT JOIN photos p ON p.job_id = b.id
    LEFT JOIN with_check wc ON wc.pk = b.pk AND wc.id = b.id
    GROUP BY b.pk
    ORDER BY b.pk;
  ELSIF p_group_by = 'week' THEN
    RETURN QUERY
    WITH buckets AS (
      SELECT
        (DATE_TRUNC('week', j.created_at AT TIME ZONE 'UTC')::TIMESTAMPTZ AT TIME ZONE 'UTC')::DATE AS pk,
        j.id
      FROM jobs j
      WHERE j.organization_id = p_org_id
        AND j.deleted_at IS NULL
        AND j.created_at >= p_since
        AND j.created_at <= p_until
    ),
    sigs AS (SELECT s.job_id FROM signatures s WHERE s.organization_id = p_org_id AND s.created_at >= p_since AND s.created_at <= p_until),
    photos AS (SELECT d.job_id FROM documents d WHERE d.organization_id = p_org_id AND d.type = 'photo' AND d.created_at >= p_since AND d.created_at <= p_until),
    mit_agg AS (
      SELECT mi.job_id,
        COUNT(*)::BIGINT AS total,
        COUNT(*) FILTER (WHERE mi.completed_at IS NOT NULL AND mi.completed_at >= p_since AND mi.completed_at <= p_until)::BIGINT AS completed
      FROM mitigation_items mi
      WHERE mi.organization_id = p_org_id
      GROUP BY mi.job_id
    ),
    with_check AS (
      SELECT b.pk, b.id
      FROM buckets b
      LEFT JOIN mit_agg m ON m.job_id = b.id
      WHERE COALESCE(m.total, 0) = 0 OR (m.completed::NUMERIC / NULLIF(m.total, 0)) = 1
    )
    SELECT
      b.pk,
      COUNT(DISTINCT b.id)::BIGINT,
      COUNT(DISTINCT b.id) FILTER (WHERE s.job_id IS NOT NULL)::BIGINT,
      COUNT(DISTINCT b.id) FILTER (WHERE p.job_id IS NOT NULL)::BIGINT,
      COUNT(DISTINCT b.id) FILTER (WHERE wc.id IS NOT NULL)::BIGINT
    FROM (SELECT DISTINCT pk, id FROM buckets) b
    LEFT JOIN sigs s ON s.job_id = b.id
    LEFT JOIN photos p ON p.job_id = b.id
    LEFT JOIN with_check wc ON wc.pk = b.pk AND wc.id = b.id
    GROUP BY b.pk
    ORDER BY b.pk;
  ELSE
    RETURN QUERY
    WITH buckets AS (
      SELECT
        (j.created_at AT TIME ZONE 'UTC')::DATE AS pk,
        j.id
      FROM jobs j
      WHERE j.organization_id = p_org_id
        AND j.deleted_at IS NULL
        AND j.created_at >= p_since
        AND j.created_at <= p_until
    ),
    sigs AS (SELECT s.job_id FROM signatures s WHERE s.organization_id = p_org_id AND s.created_at >= p_since AND s.created_at <= p_until),
    photos AS (SELECT d.job_id FROM documents d WHERE d.organization_id = p_org_id AND d.type = 'photo' AND d.created_at >= p_since AND d.created_at <= p_until),
    mit_agg AS (
      SELECT mi.job_id,
        COUNT(*)::BIGINT AS total,
        COUNT(*) FILTER (WHERE mi.completed_at IS NOT NULL AND mi.completed_at >= p_since AND mi.completed_at <= p_until)::BIGINT AS completed
      FROM mitigation_items mi
      WHERE mi.organization_id = p_org_id
      GROUP BY mi.job_id
    ),
    with_check AS (
      SELECT b.pk, b.id
      FROM buckets b
      LEFT JOIN mit_agg m ON m.job_id = b.id
      WHERE COALESCE(m.total, 0) = 0 OR (m.completed::NUMERIC / NULLIF(m.total, 0)) = 1
    )
    SELECT
      b.pk,
      COUNT(DISTINCT b.id)::BIGINT,
      COUNT(DISTINCT b.id) FILTER (WHERE s.job_id IS NOT NULL)::BIGINT,
      COUNT(DISTINCT b.id) FILTER (WHERE p.job_id IS NOT NULL)::BIGINT,
      COUNT(DISTINCT b.id) FILTER (WHERE wc.id IS NOT NULL)::BIGINT
    FROM (SELECT DISTINCT pk, id FROM buckets) b
    LEFT JOIN sigs s ON s.job_id = b.id
    LEFT JOIN photos p ON p.job_id = b.id
    LEFT JOIN with_check wc ON wc.pk = b.pk AND wc.id = b.id
    GROUP BY b.pk
    ORDER BY b.pk;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_trends_compliance_buckets(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Pre-aggregated compliance buckets for trends; p_group_by is day, week, or month.';
