-- Day-level trends: single RPC returning { period_key, value } per day for jobs, risk, completion, compliance.
-- Replaces client-side iteration over all jobs to keep row count = bucket count and meet performance target.

CREATE OR REPLACE FUNCTION get_trends_day_buckets(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ,
  p_metric TEXT
)
RETURNS TABLE(period_key DATE, value NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  p_metric := LOWER(COALESCE(TRIM(p_metric), 'jobs'));

  IF p_metric = 'jobs' THEN
    RETURN QUERY
    SELECT
      (j.created_at AT TIME ZONE 'UTC')::DATE AS period_key,
      COUNT(*)::NUMERIC AS value
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND j.created_at >= p_since
      AND j.created_at <= p_until
    GROUP BY (j.created_at AT TIME ZONE 'UTC')::DATE
    ORDER BY 1;
    RETURN;
  END IF;

  IF p_metric = 'risk' THEN
    RETURN QUERY
    SELECT
      (j.created_at AT TIME ZONE 'UTC')::DATE AS period_key,
      ROUND(AVG(j.risk_score)::NUMERIC, 2) AS value
    FROM jobs j
    WHERE j.organization_id = p_org_id
      AND j.deleted_at IS NULL
      AND j.risk_score IS NOT NULL
      AND j.created_at >= p_since
      AND j.created_at <= p_until
    GROUP BY (j.created_at AT TIME ZONE 'UTC')::DATE
    ORDER BY 1;
    RETURN;
  END IF;

  -- Completion: bucket by completion date (COALESCE(completed_at, created_at)); value = percentage 0–100 (completions in that day / jobs created that day); reflects completions in the selected window.
  IF p_metric = 'completion' THEN
    RETURN QUERY
    WITH day_created AS (
      SELECT
        (j.created_at AT TIME ZONE 'UTC')::DATE AS pk,
        COUNT(*)::BIGINT AS total
      FROM jobs j
      WHERE j.organization_id = p_org_id
        AND j.deleted_at IS NULL
        AND j.created_at >= p_since
        AND j.created_at <= p_until
      GROUP BY (j.created_at AT TIME ZONE 'UTC')::DATE
    ),
    day_completed AS (
      SELECT
        ((COALESCE(j.completed_at, j.created_at)) AT TIME ZONE 'UTC')::DATE AS pk,
        COUNT(*)::BIGINT AS completed
      FROM jobs j
      WHERE j.organization_id = p_org_id
        AND j.deleted_at IS NULL
        AND LOWER(COALESCE(j.status, '')) = 'completed'
        AND (COALESCE(j.completed_at, j.created_at)) >= p_since
        AND (COALESCE(j.completed_at, j.created_at)) <= p_until
      GROUP BY ((COALESCE(j.completed_at, j.created_at)) AT TIME ZONE 'UTC')::DATE
    )
    SELECT
      COALESCE(c.pk, d.pk) AS period_key,
      CASE WHEN COALESCE(d.total, 0) = 0 THEN 0
           ELSE ROUND((COALESCE(c.completed, 0)::NUMERIC / NULLIF(d.total, 0)) * 100.0, 2)
      END AS value
    FROM day_created d
    FULL OUTER JOIN day_completed c ON c.pk = d.pk
    ORDER BY 1;
    RETURN;
  END IF;

  -- Compliance: day buckets, value = overall % (signature + photo + checklist) / 3, 0–100
  IF p_metric = 'compliance' THEN
    RETURN QUERY
    WITH day_buckets AS (
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
      FROM day_buckets b
      LEFT JOIN mit_agg m ON m.job_id = b.id
      WHERE COALESCE(m.total, 0) = 0 OR (m.completed::NUMERIC / NULLIF(m.total, 0)) = 1
    ),
    agg AS (
      SELECT
        b.pk,
        COUNT(DISTINCT b.id)::BIGINT AS total,
        COUNT(DISTINCT b.id) FILTER (WHERE s.job_id IS NOT NULL)::BIGINT AS with_sig,
        COUNT(DISTINCT b.id) FILTER (WHERE p.job_id IS NOT NULL)::BIGINT AS with_photo,
        COUNT(DISTINCT b.id) FILTER (WHERE wc.id IS NOT NULL)::BIGINT AS checklist_ok
      FROM (SELECT DISTINCT pk, id FROM day_buckets) b
      LEFT JOIN sigs s ON s.job_id = b.id
      LEFT JOIN photos p ON p.job_id = b.id
      LEFT JOIN with_check wc ON wc.pk = b.pk AND wc.id = b.id
      GROUP BY b.pk
    )
    SELECT
      a.pk AS period_key,
      CASE WHEN a.total = 0 THEN 0
           ELSE ROUND(
             ((a.with_sig::NUMERIC / NULLIF(a.total, 0)) +
              (a.with_photo::NUMERIC / NULLIF(a.total, 0)) +
              (a.checklist_ok::NUMERIC / NULLIF(a.total, 0))) / 3.0 * 100.0,
             2
           )
      END AS value
    FROM agg a
    ORDER BY a.pk;
    RETURN;
  END IF;

  -- Default (unknown metric): return empty
  RETURN;
END;
$$;

COMMENT ON FUNCTION get_trends_day_buckets(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Day-level trend buckets: period_key (date), value. p_metric: jobs, risk, completion (0–100 %), compliance. Completion = per-day completions (by completion date) / per-day jobs created * 100; denominator matches period job population.';
