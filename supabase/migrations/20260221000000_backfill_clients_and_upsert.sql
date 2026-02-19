-- Backfill clients from jobs and add ongoing upsert support
-- 1. Add unique index for upsert (case-insensitive, trim-normalized)
-- 2. Backfill distinct client names from non-deleted, non-archived jobs
-- 3. Create upsert_client RPC for job flows to call

-- Unique index: one client per (organization_id, lower(trim(name)))
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_org_name_unique
  ON clients (organization_id, lower(trim(name)));

-- Backfill: insert distinct client names from jobs where deleted_at/archived_at null
INSERT INTO clients (organization_id, name)
SELECT organization_id, trim(client_name) AS name
FROM (
  SELECT DISTINCT ON (organization_id, lower(trim(client_name)))
    organization_id,
    trim(client_name) AS client_name
  FROM jobs
  WHERE deleted_at IS NULL
    AND archived_at IS NULL
    AND client_name IS NOT NULL
    AND trim(client_name) != ''
) sub
ON CONFLICT (organization_id, lower(trim(name))) DO UPDATE SET updated_at = now();

-- RPC for job creation/update flows to upsert client records
CREATE OR REPLACE FUNCTION upsert_client(p_org_id UUID, p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trimmed TEXT;
  v_id UUID;
BEGIN
  v_trimmed := trim(p_name);
  IF v_trimmed = '' OR v_trimmed IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO clients (organization_id, name)
  VALUES (p_org_id, v_trimmed)
  ON CONFLICT (organization_id, lower(trim(name))) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
