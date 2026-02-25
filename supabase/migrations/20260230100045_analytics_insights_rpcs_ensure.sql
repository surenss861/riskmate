-- Ensure analytics and insights RPCs exist with contracts expected by apps/backend (analytics.ts, insights.ts).
-- CREATE OR REPLACE so this migration is safe whether or not 20260230100039/20260230100040 were applied.

-- get_trends_compliance_buckets: p_org_id, p_since, p_until, p_group_by (week|month) -> period_key, total, with_signature, with_photo, checklist_complete
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
    sigs AS (SELECT s.job_id FROM signatures s WHERE s.organization_id = p_org_id),
    photos AS (SELECT d.job_id FROM documents d WHERE d.organization_id = p_org_id AND d.type = 'photo'),
    mit_agg AS (
      SELECT mi.job_id,
        COUNT(*)::BIGINT AS total,
        COUNT(*) FILTER (WHERE mi.completed_at IS NOT NULL)::BIGINT AS completed
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
    sigs AS (SELECT s.job_id FROM signatures s WHERE s.organization_id = p_org_id),
    photos AS (SELECT d.job_id FROM documents d WHERE d.organization_id = p_org_id AND d.type = 'photo'),
    mit_agg AS (
      SELECT mi.job_id,
        COUNT(*)::BIGINT AS total,
        COUNT(*) FILTER (WHERE mi.completed_at IS NOT NULL)::BIGINT AS completed
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
    sigs AS (SELECT s.job_id FROM signatures s WHERE s.organization_id = p_org_id),
    photos AS (SELECT d.job_id FROM documents d WHERE d.organization_id = p_org_id AND d.type = 'photo'),
    mit_agg AS (
      SELECT mi.job_id,
        COUNT(*)::BIGINT AS total,
        COUNT(*) FILTER (WHERE mi.completed_at IS NOT NULL)::BIGINT AS completed
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

-- get_risk_heatmap_buckets: p_org_id, p_since, p_until -> job_type, day_of_week, avg_risk, count
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

-- get_hazard_frequency_buckets: p_org_id, p_since, p_until, p_prev_since, p_prev_until, p_group_by -> category, count, avg_risk, prev_count
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

-- get_insights_due_counts: p_org_id, p_now, p_two_days_later, p_seven_days_later -> single row with deadline_risk_*, pending_signatures_*, overdue_*
CREATE OR REPLACE FUNCTION get_insights_due_counts(
  p_org_id UUID,
  p_now TIMESTAMPTZ,
  p_two_days_later TIMESTAMPTZ,
  p_seven_days_later TIMESTAMPTZ
)
RETURNS TABLE (
  deadline_risk_count BIGINT,
  deadline_risk_job_ids UUID[],
  pending_signatures_count BIGINT,
  pending_signatures_job_ids UUID[],
  overdue_count BIGINT,
  overdue_job_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_dr_count BIGINT;
  v_dr_ids UUID[];
  v_ps_count BIGINT;
  v_ps_ids UUID[];
  v_od_count BIGINT;
  v_od_ids UUID[];
BEGIN
  WITH due_soon_open AS (
    SELECT j.id
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) != 'completed'
      AND j.due_date IS NOT NULL
      AND j.due_date > p_now
      AND j.due_date <= p_two_days_later
  ),
  mit_agg AS (
    SELECT mi.job_id,
      COUNT(*)::BIGINT AS total,
      COUNT(*) FILTER (WHERE mi.completed_at IS NOT NULL)::BIGINT AS completed
    FROM mitigation_items mi
    WHERE mi.organization_id = p_org_id
    GROUP BY mi.job_id
  ),
  deadline_risk_set AS (
    SELECT d.id
    FROM due_soon_open d
    LEFT JOIN mit_agg m ON m.job_id = d.id
    WHERE COALESCE(m.total, 0) = 0 OR (m.completed::NUMERIC / NULLIF(m.total, 0)) < 0.5
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM deadline_risk_set),
    (SELECT COALESCE(ARRAY_AGG(id ORDER BY id), '{}') FROM (SELECT id FROM deadline_risk_set LIMIT 50) t)
  INTO v_dr_count, v_dr_ids;

  WITH due_in_seven AS (
    SELECT j.id
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) != 'completed'
      AND j.due_date IS NOT NULL
      AND j.due_date > p_now
      AND j.due_date <= p_seven_days_later
  ),
  with_sig AS (
    SELECT s.job_id FROM signatures s WHERE s.organization_id = p_org_id
  ),
  pending_sig_set AS (
    SELECT d.id FROM due_in_seven d
    WHERE NOT EXISTS (SELECT 1 FROM with_sig s WHERE s.job_id = d.id)
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM pending_sig_set),
    (SELECT COALESCE(ARRAY_AGG(id ORDER BY id), '{}') FROM (SELECT id FROM pending_sig_set LIMIT 50) t)
  INTO v_ps_count, v_ps_ids;

  WITH overdue_set AS (
    SELECT j.id
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) != 'completed'
      AND j.due_date IS NOT NULL
      AND j.due_date < p_now
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM overdue_set),
    (SELECT COALESCE(ARRAY_AGG(id ORDER BY id), '{}') FROM (SELECT id FROM overdue_set LIMIT 50) t)
  INTO v_od_count, v_od_ids;

  deadline_risk_count := v_dr_count;
  deadline_risk_job_ids := v_dr_ids;
  pending_signatures_count := v_ps_count;
  pending_signatures_job_ids := v_ps_ids;
  overdue_count := v_od_count;
  overdue_job_ids := v_od_ids;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION get_trends_compliance_buckets(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Compliance trend buckets for analytics; p_group_by: week or month. Returns period_key, total, with_signature, with_photo, checklist_complete.';
COMMENT ON FUNCTION get_risk_heatmap_buckets(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Risk heatmap buckets by job_type and day_of_week; returns job_type, day_of_week, avg_risk, count.';
COMMENT ON FUNCTION get_hazard_frequency_buckets(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Hazard frequency by category; p_group_by: type or location. Returns category, count, avg_risk, prev_count.';
COMMENT ON FUNCTION get_insights_due_counts(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Insights due counts: deadline_risk, pending_signatures, overdue; full counts and up to 50 job_ids each.';
