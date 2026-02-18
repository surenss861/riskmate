ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS search_vector tsvector
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
    OR user_id = auth.uid()
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
      coalesce(j.description, '') || ' ' || coalesce(j.location, ''),
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
  score REAL
)
LANGUAGE sql
STABLE
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', p_query) AS tsq
  )
  SELECT
    h.id,
    h.job_id,
    h.hazard_type,
    h.description,
    h.severity,
    ts_rank(
      to_tsvector('english', coalesce(h.hazard_type, '') || ' ' || coalesce(h.description, '')),
      q.tsq
    )::REAL AS score
  FROM hazards h
  CROSS JOIN q
  WHERE h.organization_id = p_org_id
    AND to_tsvector('english', coalesce(h.hazard_type, '') || ' ' || coalesce(h.description, '')) @@ q.tsq
  ORDER BY score DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;
