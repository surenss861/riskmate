-- Recreate search_vector so it includes job title/name (client_name) and all searchable fields
ALTER TABLE jobs DROP COLUMN IF EXISTS search_vector;

ALTER TABLE jobs
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(client_name, '') || ' ' ||
        coalesce(job_type, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(location, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_jobs_search ON jobs USING GIN(search_vector);

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

CREATE OR REPLACE FUNCTION search_jobs(
  p_org_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
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
    j.client_name,
    j.job_type,
    j.location,
    j.status,
    j.risk_level,
    ts_rank(j.search_vector, q.tsq)::REAL AS score,
    ts_headline(
      'english',
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

CREATE OR REPLACE FUNCTION search_jobs_count(p_org_id UUID, p_query TEXT)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM jobs j
  WHERE j.organization_id = p_org_id
    AND j.deleted_at IS NULL
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

-- RPC to return jobs filtered like the API and ordered by ts_rank when q is present
CREATE OR REPLACE FUNCTION get_jobs_ranked(
  p_org_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_include_archived BOOLEAN DEFAULT false,
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
  ORDER BY ts_rank(j.search_vector, q.tsq) DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
