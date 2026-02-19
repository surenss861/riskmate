-- Add p_include_archived to search_clients and search_clients_count so /api/search
-- can include archived clients when include_archived=true.

DROP FUNCTION IF EXISTS search_clients(uuid, text, integer);
CREATE OR REPLACE FUNCTION search_clients(
  p_org_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_include_archived BOOLEAN DEFAULT false
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
    AND (p_include_archived OR c.archived_at IS NULL)
    AND c.search_vector @@ q.tsq
  ORDER BY rank DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

DROP FUNCTION IF EXISTS search_clients_count(uuid, text);
CREATE OR REPLACE FUNCTION search_clients_count(
  p_org_id UUID,
  p_query TEXT,
  p_include_archived BOOLEAN DEFAULT false
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM clients c
  WHERE c.organization_id = p_org_id
    AND c.deleted_at IS NULL
    AND (p_include_archived OR c.archived_at IS NULL)
    AND c.search_vector @@ to_tsquery('english', p_query);
$$;
