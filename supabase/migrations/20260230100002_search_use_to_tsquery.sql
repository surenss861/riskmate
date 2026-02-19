-- Follow-up: ensure full-text search uses to_tsquery (spec) instead of websearch_to_tsquery.
-- Recreates search_* and get_jobs_ranked so already-applied 20260220000000 gets the fix.

DROP FUNCTION IF EXISTS search_clients(uuid, text, integer);
CREATE OR REPLACE FUNCTION search_clients(
  p_org_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  highlight TEXT,
  rank REAL
)
LANGUAGE sql
STABLE
AS $$
  WITH q AS (
    SELECT to_tsquery('english', p_query) AS tsq
  )
  SELECT
    c.id,
    c.name AS display_name,
    ts_headline('english', coalesce(c.name, ''), q.tsq) AS highlight,
    ts_rank(c.search_vector, q.tsq)::REAL AS rank
  FROM clients c
  CROSS JOIN q
  WHERE c.organization_id = p_org_id
    AND c.deleted_at IS NULL
    AND c.archived_at IS NULL
    AND c.search_vector @@ q.tsq
  ORDER BY rank DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

DROP FUNCTION IF EXISTS search_clients_count(uuid, text);
CREATE OR REPLACE FUNCTION search_clients_count(p_org_id UUID, p_query TEXT)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM clients c
  WHERE c.organization_id = p_org_id
    AND c.deleted_at IS NULL
    AND c.archived_at IS NULL
    AND c.search_vector @@ to_tsquery('english', p_query);
$$;

DROP FUNCTION IF EXISTS search_jobs(uuid, text, integer);
DROP FUNCTION IF EXISTS search_jobs(uuid, text, integer, boolean);
CREATE OR REPLACE FUNCTION search_jobs(
  p_org_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_include_archived BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  client_name TEXT,
  job_type TEXT,
  location TEXT,
  status TEXT,
  risk_level TEXT,
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
    j.risk_level,
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
    AND (p_include_archived OR j.archived_at IS NULL)
    AND j.search_vector @@ q.tsq
  ORDER BY score DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

DROP FUNCTION IF EXISTS search_hazards(uuid, text, integer);
CREATE OR REPLACE FUNCTION search_hazards(
  p_org_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_include_archived BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  job_id UUID,
  hazard_type TEXT,
  description TEXT,
  severity TEXT,
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
    h.id,
    h.job_id,
    h.hazard_type,
    h.description,
    h.severity,
    ts_rank(h.search_vector, q.tsq)::REAL AS score,
    ts_headline('english', coalesce(h.description, ''), q.tsq) AS highlight
  FROM hazards h
  CROSS JOIN q
  WHERE h.organization_id = p_org_id
    AND h.deleted_at IS NULL
    AND (p_include_archived OR h.archived_at IS NULL)
    AND h.search_vector @@ q.tsq
  ORDER BY score DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

DROP FUNCTION IF EXISTS search_jobs_count(uuid, text);
CREATE OR REPLACE FUNCTION search_jobs_count(
  p_org_id UUID,
  p_query TEXT,
  p_include_archived BOOLEAN DEFAULT false
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
    AND (p_include_archived OR j.archived_at IS NULL)
    AND j.search_vector @@ to_tsquery('english', p_query);
$$;

DROP FUNCTION IF EXISTS search_hazards_count(uuid, text);
CREATE OR REPLACE FUNCTION search_hazards_count(
  p_org_id UUID,
  p_query TEXT,
  p_include_archived BOOLEAN DEFAULT false
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM hazards h
  WHERE h.organization_id = p_org_id
    AND h.deleted_at IS NULL
    AND (p_include_archived OR h.archived_at IS NULL)
    AND h.search_vector @@ to_tsquery('english', p_query);
$$;

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
  total_count BIGINT
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
    count(*) OVER () AS total_count
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
