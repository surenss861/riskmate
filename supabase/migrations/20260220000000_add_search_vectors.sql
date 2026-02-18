-- Ensure job title/name column exists for search coverage (optional; may already exist).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS title TEXT;

-- Recreate search_vector so it includes job title/name and all searchable fields
ALTER TABLE jobs DROP COLUMN IF EXISTS search_vector;

ALTER TABLE jobs
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(title, '') || ' ' ||
        coalesce(client_name, '') || ' ' ||
        coalesce(job_type, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(location, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_jobs_search ON jobs USING GIN(search_vector);

-- Clients table for search (display names per organization; exclude deleted/archived in search)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id);

ALTER TABLE clients DROP COLUMN IF EXISTS search_vector;
ALTER TABLE clients
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_clients_search ON clients USING GIN(search_vector);

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view clients in org" ON clients;
CREATE POLICY "Users can view clients in org"
  ON clients FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert clients in org" ON clients;
CREATE POLICY "Users can insert clients in org"
  ON clients FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update clients in org" ON clients;
CREATE POLICY "Users can update clients in org"
  ON clients FOR UPDATE
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete clients in org" ON clients;
CREATE POLICY "Users can delete clients in org"
  ON clients FOR DELETE
  USING (organization_id = get_user_organization_id());

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
    SELECT websearch_to_tsquery('english', p_query) AS tsq
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
    AND c.search_vector @@ websearch_to_tsquery('english', p_query);
$$;

CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filter_config JSONB NOT NULL DEFAULT '{}',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_org ON saved_filters(organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(user_id);

DROP TRIGGER IF EXISTS update_saved_filters_updated_at ON saved_filters;
CREATE TRIGGER update_saved_filters_updated_at
  BEFORE UPDATE ON saved_filters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view saved filters in org or owned" ON saved_filters;
CREATE POLICY "Users can view saved filters in org or owned"
  ON saved_filters FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (user_id = auth.uid() OR is_shared = true)
  );

DROP POLICY IF EXISTS "Users can insert own saved filters" ON saved_filters;
CREATE POLICY "Users can insert own saved filters"
  ON saved_filters FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = get_user_organization_id()
  );

DROP POLICY IF EXISTS "Users can update own saved filters" ON saved_filters;
CREATE POLICY "Users can update own saved filters"
  ON saved_filters FOR UPDATE
  USING (
    user_id = auth.uid()
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = get_user_organization_id()
  );

DROP POLICY IF EXISTS "Users can delete own saved filters" ON saved_filters;
CREATE POLICY "Users can delete own saved filters"
  ON saved_filters FOR DELETE
  USING (
    user_id = auth.uid()
    AND organization_id = get_user_organization_id()
  );

-- Drop so return type can change (added title to RETURNS TABLE)
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
    SELECT websearch_to_tsquery('english', p_query) AS tsq
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

CREATE OR REPLACE FUNCTION search_hazards(
  p_org_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20
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
    SELECT websearch_to_tsquery('english', p_query) AS tsq
  ),
  hv AS (
    SELECT
      h.id,
      h.job_id,
      h.hazard_type,
      h.description,
      h.severity,
      to_tsvector('english', coalesce(h.hazard_type, '') || ' ' || coalesce(h.description, '')) AS vec
    FROM hazards h
    WHERE h.organization_id = p_org_id
  )
  SELECT
    hv.id,
    hv.job_id,
    hv.hazard_type,
    hv.description,
    hv.severity,
    ts_rank(hv.vec, q.tsq)::REAL AS score,
    ts_headline('english', coalesce(hv.description, ''), q.tsq) AS highlight
  FROM hv
  CROSS JOIN q
  WHERE hv.vec @@ q.tsq
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
    AND j.search_vector @@ websearch_to_tsquery('english', p_query);
$$;

CREATE OR REPLACE FUNCTION search_hazards_count(p_org_id UUID, p_query TEXT)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM hazards h
  WHERE h.organization_id = p_org_id
    AND to_tsvector('english', coalesce(h.hazard_type, '') || ' ' || coalesce(h.description, '')) @@ websearch_to_tsquery('english', p_query);
$$;

-- RPC to return jobs filtered like the API; ordered by caller sort/order when provided, else by ts_rank
-- Drop so return type can change (added title to RETURNS TABLE)
DROP FUNCTION IF EXISTS get_jobs_ranked(uuid, text, integer, integer, boolean, text, text, text, text, uuid, real, real, text, text, uuid[], uuid[], boolean, boolean, integer);
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
  p_recent_days INT DEFAULT NULL
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
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', p_query) AS tsq
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
    j.updated_at
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
