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

  -- Completion: one row per day in range; value = completion rate 0–100 (jobs_completed_that_day / jobs_created_that_day * 100).
  IF p_metric = 'completion' THEN
    RETURN QUERY
    WITH days AS (
      SELECT generate_series(
        (p_since AT TIME ZONE 'UTC')::DATE,
        (p_until AT TIME ZONE 'UTC')::DATE,
        '1 day'::INTERVAL
      )::DATE AS period_key
    ),
    created AS (
      SELECT (j.created_at AT TIME ZONE 'UTC')::DATE AS d, COUNT(*)::BIGINT AS c
      FROM jobs j
      WHERE j.organization_id = p_org_id
        AND j.deleted_at IS NULL
        AND j.created_at >= p_since
        AND j.created_at <= p_until
      GROUP BY (j.created_at AT TIME ZONE 'UTC')::DATE
    ),
    completed AS (
      SELECT (COALESCE(j.completed_at, j.created_at) AT TIME ZONE 'UTC')::DATE AS d, COUNT(*)::BIGINT AS c
      FROM jobs j
      WHERE j.organization_id = p_org_id
        AND j.deleted_at IS NULL
        AND LOWER(COALESCE(j.status, '')) = 'completed'
        AND COALESCE(j.completed_at, j.created_at) >= p_since
        AND COALESCE(j.completed_at, j.created_at) <= p_until
      GROUP BY (COALESCE(j.completed_at, j.created_at) AT TIME ZONE 'UTC')::DATE
    )
    SELECT
      days.period_key,
      (CASE
        WHEN COALESCE(created.c, 0) = 0 THEN 0
        ELSE ROUND(LEAST(100::NUMERIC, GREATEST(0::NUMERIC,
          (COALESCE(completed.c, 0)::NUMERIC / created.c) * 100
        ))::NUMERIC, 2)
      END) AS value
    FROM days
    LEFT JOIN created ON created.d = days.period_key
    LEFT JOIN completed ON completed.d = days.period_key
    ORDER BY days.period_key;
    RETURN;
  END IF;

  -- Compliance: day buckets, value = overall % (signature + photo + checklist) / 3, 0–100.
  -- Only evidence within the period counts: signatures/photos by created_at on that day, mitigation by completed_at on that day.
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
    sigs AS (
      SELECT s.job_id, (s.created_at AT TIME ZONE 'UTC')::DATE AS sig_date
      FROM signatures s
      WHERE s.organization_id = p_org_id
        AND s.created_at >= p_since
        AND s.created_at <= p_until
    ),
    photos AS (
      SELECT d.job_id, (d.created_at AT TIME ZONE 'UTC')::DATE AS photo_date
      FROM documents d
      WHERE d.organization_id = p_org_id
        AND d.type = 'photo'
        AND d.created_at >= p_since
        AND d.created_at <= p_until
    ),
    total_per_job AS (
      SELECT mi.job_id, COUNT(*)::BIGINT AS total
      FROM mitigation_items mi
      WHERE mi.organization_id = p_org_id
      GROUP BY mi.job_id
    ),
    completed_per_job_day AS (
      SELECT
        mi.job_id,
        (mi.completed_at AT TIME ZONE 'UTC')::DATE AS comp_date,
        COUNT(*)::BIGINT AS completed
      FROM mitigation_items mi
      WHERE mi.organization_id = p_org_id
        AND mi.completed_at IS NOT NULL
        AND mi.completed_at >= p_since
        AND mi.completed_at <= p_until
      GROUP BY mi.job_id, (mi.completed_at AT TIME ZONE 'UTC')::DATE
    ),
    with_check AS (
      SELECT b.pk, b.id
      FROM (SELECT DISTINCT pk, id FROM day_buckets) b
      LEFT JOIN total_per_job t ON t.job_id = b.id
      LEFT JOIN completed_per_job_day c ON c.job_id = b.id AND c.comp_date = b.pk
      WHERE COALESCE(t.total, 0) = 0 OR (COALESCE(c.completed, 0)::NUMERIC / NULLIF(t.total, 0)) = 1
    ),
    agg AS (
      SELECT
        b.pk,
        COUNT(DISTINCT b.id)::BIGINT AS total,
        COUNT(DISTINCT b.id) FILTER (WHERE s.job_id IS NOT NULL)::BIGINT AS with_sig,
        COUNT(DISTINCT b.id) FILTER (WHERE p.job_id IS NOT NULL)::BIGINT AS with_photo,
        COUNT(DISTINCT b.id) FILTER (WHERE wc.id IS NOT NULL)::BIGINT AS checklist_ok
      FROM (SELECT DISTINCT pk, id FROM day_buckets) b
      LEFT JOIN sigs s ON s.job_id = b.id AND s.sig_date = b.pk
      LEFT JOIN photos p ON p.job_id = b.id AND p.photo_date = b.pk
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
  'Day-level trend buckets: period_key (date), value. p_metric: jobs, risk, completion (rate 0–100: jobs_completed_that_day / jobs_created_that_day), compliance.';
