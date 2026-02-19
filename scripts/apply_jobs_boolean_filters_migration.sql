-- Run this in Supabase Dashboard → SQL Editor when db push fails with duplicate schema_migrations.
-- Applies only 20260230100000_jobs_boolean_filters_exists and records it so future db push skips it.
--
-- IMPORTANT: Do NOT use "supabase db push --include-all". It re-applies every local migration and
-- always hits duplicate key on 20260215000000 (already in schema_migrations). For future migrations
-- use plain:  supabase db push

-- 1) Apply the migration (same as supabase/migrations/20260230100000_jobs_boolean_filters_exists.sql)
CREATE OR REPLACE FUNCTION get_job_ids_for_boolean_filter(
  p_org_id UUID,
  p_field TEXT,
  p_value BOOLEAN,
  p_include_archived BOOLEAN DEFAULT false
)
RETURNS UUID[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(array_agg(j.id), ARRAY[]::UUID[])
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND (p_include_archived OR j.archived_at IS NULL)
    AND (
      CASE p_field
        WHEN 'has_photos' THEN
          CASE WHEN p_value THEN
            EXISTS (SELECT 1 FROM job_photos jp WHERE jp.job_id = j.id AND jp.organization_id = p_org_id)
          ELSE
            NOT EXISTS (SELECT 1 FROM job_photos jp WHERE jp.job_id = j.id AND jp.organization_id = p_org_id)
          END
        WHEN 'has_signatures' THEN
          CASE WHEN p_value THEN
            EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)
          ELSE
            NOT EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)
          END
        WHEN 'needs_signatures' THEN
          CASE WHEN p_value THEN
            NOT EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)
          ELSE
            EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)
          END
        ELSE FALSE
      END
    );
$$;

CREATE OR REPLACE FUNCTION get_jobs_list(
  p_org_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_include_archived BOOLEAN DEFAULT false,
  p_sort_column TEXT DEFAULT 'created_at',
  p_sort_order TEXT DEFAULT 'desc',
  p_status TEXT DEFAULT NULL,
  p_risk_level TEXT DEFAULT NULL,
  p_assigned_to_id UUID DEFAULT NULL,
  p_risk_score_min REAL DEFAULT NULL,
  p_risk_score_max REAL DEFAULT NULL,
  p_job_type TEXT DEFAULT NULL,
  p_client_ilike TEXT DEFAULT NULL,
  p_required_ids UUID[] DEFAULT NULL,
  p_excluded_ids UUID[] DEFAULT NULL,
  p_overdue BOOLEAN DEFAULT NULL,
  p_unassigned BOOLEAN DEFAULT NULL,
  p_recent_days INT DEFAULT NULL,
  p_has_photos BOOLEAN DEFAULT NULL,
  p_has_signatures BOOLEAN DEFAULT NULL,
  p_needs_signatures BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  client_name TEXT,
  job_type TEXT,
  location TEXT,
  status TEXT,
  risk_score REAL,
  risk_level TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    j.id, j.title, j.client_name, j.job_type, j.location, j.status,
    j.risk_score, j.risk_level, j.created_at, j.updated_at,
    count(*) OVER () AS total_count
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND (p_include_archived OR j.archived_at IS NULL)
    AND (p_status IS NULL OR j.status = p_status)
    AND (p_risk_level IS NULL OR j.risk_level = p_risk_level)
    AND (p_assigned_to_id IS NULL OR j.assigned_to_id = p_assigned_to_id)
    AND (p_risk_score_min IS NULL OR j.risk_score >= p_risk_score_min)
    AND (p_risk_score_max IS NULL OR j.risk_score <= p_risk_score_max)
    AND (p_job_type IS NULL OR j.job_type = p_job_type)
    AND (p_client_ilike IS NULL OR j.client_name ILIKE p_client_ilike)
    AND (p_required_ids IS NULL OR j.id = ANY(p_required_ids))
    AND (p_excluded_ids IS NULL OR j.id <> ALL(p_excluded_ids))
    AND (p_overdue IS NOT TRUE OR (j.end_date IS NOT NULL AND j.end_date::date < CURRENT_DATE))
    AND (p_unassigned IS NOT TRUE OR j.assigned_to_id IS NULL)
    AND (p_recent_days IS NULL OR j.updated_at >= (CURRENT_TIMESTAMP - (p_recent_days || ' days')::interval))
    AND (p_has_photos IS NULL OR (p_has_photos = EXISTS (SELECT 1 FROM job_photos jp WHERE jp.job_id = j.id AND jp.organization_id = p_org_id)))
    AND (p_has_signatures IS NULL OR (p_has_signatures = EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)))
    AND (p_needs_signatures IS NULL OR (p_needs_signatures = NOT EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)))
  ORDER BY
    (CASE WHEN p_sort_column = 'created_at' AND (p_sort_order IS NULL OR LOWER(p_sort_order) = 'asc')  THEN j.created_at END) ASC NULLS LAST,
    (CASE WHEN p_sort_column = 'created_at' AND LOWER(p_sort_order) = 'desc' THEN j.created_at END) DESC NULLS LAST,
    (CASE WHEN p_sort_column = 'updated_at' AND (p_sort_order IS NULL OR LOWER(p_sort_order) = 'asc')  THEN j.updated_at END) ASC NULLS LAST,
    (CASE WHEN p_sort_column = 'updated_at' AND LOWER(p_sort_order) = 'desc' THEN j.updated_at END) DESC NULLS LAST,
    (CASE WHEN p_sort_column = 'risk_score' AND (p_sort_order IS NULL OR LOWER(p_sort_order) = 'asc')  THEN j.risk_score END) ASC NULLS LAST,
    (CASE WHEN p_sort_column = 'risk_score' AND LOWER(p_sort_order) = 'desc' THEN j.risk_score END) DESC NULLS LAST,
    (CASE WHEN p_sort_column = 'end_date' AND (p_sort_order IS NULL OR LOWER(p_sort_order) = 'asc')  THEN j.end_date END) ASC NULLS LAST,
    (CASE WHEN p_sort_column = 'end_date' AND LOWER(p_sort_order) = 'desc' THEN j.end_date END) DESC NULLS LAST,
    (CASE WHEN p_sort_column = 'client_name' AND (p_sort_order IS NULL OR LOWER(p_sort_order) = 'asc')  THEN j.client_name END) ASC NULLS LAST,
    (CASE WHEN p_sort_column = 'client_name' AND LOWER(p_sort_order) = 'desc' THEN j.client_name END) DESC NULLS LAST,
    j.created_at DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 20), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

-- Match 20260230100002_search_use_to_tsquery.sql: get_jobs_ranked includes score and highlight.
DROP FUNCTION IF EXISTS get_jobs_ranked(uuid, text, integer, integer, boolean, text, text, text, text, uuid, real, real, text, text, uuid[], uuid[], boolean, boolean, integer, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION get_jobs_ranked(
  p_org_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_include_archived BOOLEAN DEFAULT false,
  p_sort_column TEXT DEFAULT NULL,
  p_sort_order TEXT DEFAULT 'desc',
  p_status TEXT DEFAULT NULL,
  p_risk_level TEXT DEFAULT NULL,
  p_assigned_to_id UUID DEFAULT NULL,
  p_risk_score_min REAL DEFAULT NULL,
  p_risk_score_max REAL DEFAULT NULL,
  p_job_type TEXT DEFAULT NULL,
  p_client_ilike TEXT DEFAULT NULL,
  p_required_ids UUID[] DEFAULT NULL,
  p_excluded_ids UUID[] DEFAULT NULL,
  p_overdue BOOLEAN DEFAULT NULL,
  p_unassigned BOOLEAN DEFAULT NULL,
  p_recent_days INT DEFAULT NULL,
  p_has_photos BOOLEAN DEFAULT NULL,
  p_has_signatures BOOLEAN DEFAULT NULL,
  p_needs_signatures BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  client_name TEXT,
  job_type TEXT,
  location TEXT,
  status TEXT,
  risk_score REAL,
  risk_level TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT,
  score REAL,
  highlight TEXT
)
LANGUAGE sql
STABLE
AS $$
  WITH q AS (
    SELECT to_tsquery('english', p_query) AS tsq
  )
  SELECT
    j.id,
    j.title,
    j.client_name,
    j.job_type,
    j.location,
    j.status,
    j.risk_score,
    j.risk_level,
    j.created_at,
    j.updated_at,
    count(*) OVER () AS total_count,
    ts_rank(j.search_vector, q.tsq)::REAL AS score,
    ts_headline(
      'english',
      coalesce(j.title, '') || ' ' ||
      coalesce(j.client_name, '') || ' ' ||
      coalesce(j.job_type, '') || ' ' ||
      coalesce(j.description, '') || ' ' ||
      coalesce(j.location, ''),
      q.tsq
    ) AS highlight
  FROM jobs j
  CROSS JOIN q
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND j.search_vector @@ q.tsq
    AND (p_include_archived OR j.archived_at IS NULL)
    AND (p_status IS NULL OR j.status = p_status)
    AND (p_risk_level IS NULL OR j.risk_level = p_risk_level)
    AND (p_assigned_to_id IS NULL OR j.assigned_to_id = p_assigned_to_id)
    AND (p_risk_score_min IS NULL OR j.risk_score >= p_risk_score_min)
    AND (p_risk_score_max IS NULL OR j.risk_score <= p_risk_score_max)
    AND (p_job_type IS NULL OR j.job_type = p_job_type)
    AND (p_client_ilike IS NULL OR j.client_name ILIKE p_client_ilike)
    AND (p_required_ids IS NULL OR j.id = ANY(p_required_ids))
    AND (p_excluded_ids IS NULL OR j.id <> ALL(p_excluded_ids))
    AND (p_overdue IS NOT TRUE OR (j.end_date IS NOT NULL AND j.end_date::date < CURRENT_DATE))
    AND (p_unassigned IS NOT TRUE OR j.assigned_to_id IS NULL)
    AND (p_recent_days IS NULL OR j.updated_at >= (CURRENT_TIMESTAMP - (p_recent_days || ' days')::interval))
    AND (p_has_photos IS NULL OR (
      p_has_photos = EXISTS (SELECT 1 FROM job_photos jp WHERE jp.job_id = j.id AND jp.organization_id = p_org_id)
    ))
    AND (p_has_signatures IS NULL OR (
      p_has_signatures = EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)
    ))
    AND (p_needs_signatures IS NULL OR (
      p_needs_signatures = NOT EXISTS (SELECT 1 FROM signatures s WHERE s.job_id = j.id AND s.organization_id = p_org_id)
    ))
  ORDER BY
    (CASE WHEN p_sort_column = 'created_at' AND (p_sort_order IS NULL OR LOWER(p_sort_order) = 'asc')  THEN j.created_at END) ASC NULLS LAST,
    (CASE WHEN p_sort_column = 'created_at' AND LOWER(p_sort_order) = 'desc' THEN j.created_at END) DESC NULLS LAST,
    (CASE WHEN p_sort_column = 'updated_at' AND (p_sort_order IS NULL OR LOWER(p_sort_order) = 'asc')  THEN j.updated_at END) ASC NULLS LAST,
    (CASE WHEN p_sort_column = 'updated_at' AND LOWER(p_sort_order) = 'desc' THEN j.updated_at END) DESC NULLS LAST,
    (CASE WHEN p_sort_column = 'risk_score' AND (p_sort_order IS NULL OR LOWER(p_sort_order) = 'asc')  THEN j.risk_score END) ASC NULLS LAST,
    (CASE WHEN p_sort_column = 'risk_score' AND LOWER(p_sort_order) = 'desc' THEN j.risk_score END) DESC NULLS LAST,
    (CASE WHEN p_sort_column = 'end_date' AND (p_sort_order IS NULL OR LOWER(p_sort_order) = 'asc')  THEN j.end_date END) ASC NULLS LAST,
    (CASE WHEN p_sort_column = 'end_date' AND LOWER(p_sort_order) = 'desc' THEN j.end_date END) DESC NULLS LAST,
    (CASE WHEN p_sort_column = 'client_name' AND (p_sort_order IS NULL OR LOWER(p_sort_order) = 'asc')  THEN j.client_name END) ASC NULLS LAST,
    (CASE WHEN p_sort_column = 'client_name' AND LOWER(p_sort_order) = 'desc' THEN j.client_name END) DESC NULLS LAST,
    ts_rank(j.search_vector, q.tsq) DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

-- 2) Record this migration so Supabase CLI considers it applied (avoids duplicate key on next db push)
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES (20260230100000, '20260230100000_jobs_boolean_filters_exists.sql', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;
