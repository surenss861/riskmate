-- Hazard search: exclude soft-deleted/archived and use stored tsvector + GIN index.
-- Comment 2: Exclude soft-deleted/archived hazards in search_hazards (optional p_include_archived).
-- Comment 3: Add generated search_vector column and GIN index on hazards; use it in search_hazards.

-- Add deleted_at / archived_at to hazards if not present (so we can exclude them in search)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'hazards' AND column_name = 'deleted_at') THEN
    ALTER TABLE hazards ADD COLUMN deleted_at TIMESTAMPTZ;
    COMMENT ON COLUMN hazards.deleted_at IS 'Soft-delete timestamp; excluded from search by default.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'hazards' AND column_name = 'archived_at') THEN
    ALTER TABLE hazards ADD COLUMN archived_at TIMESTAMPTZ;
    COMMENT ON COLUMN hazards.archived_at IS 'Archived timestamp; excluded from search unless p_include_archived.';
  END IF;
END $$;

-- Add generated search_vector to hazards (hazard_type + description) and GIN index
ALTER TABLE hazards DROP COLUMN IF EXISTS search_vector;
ALTER TABLE hazards
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(hazard_type, '') || ' ' || coalesce(description, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_hazards_search ON hazards USING GIN(search_vector);

-- search_hazards: exclude soft-deleted/archived; add p_include_archived; use stored search_vector and ts_rank
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
    SELECT websearch_to_tsquery('english', p_query) AS tsq
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

-- search_hazards_count: same filters and use stored search_vector
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
    AND h.search_vector @@ websearch_to_tsquery('english', p_query);
$$;
