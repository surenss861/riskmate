-- Change hazard_id FK from ON DELETE SET NULL to ON DELETE CASCADE
-- When a hazard is deleted, its controls are cascade-deleted instead of orphaned (hazard_id=NULL
-- would reclassify them as hazards in GET hazards/controls).
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
  WHERE c.conrelid = 'public.mitigation_items'::regclass
    AND c.contype = 'f'
    AND a.attname = 'hazard_id';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE mitigation_items DROP CONSTRAINT %I', constraint_name);
    ALTER TABLE mitigation_items
      ADD CONSTRAINT mitigation_items_hazard_id_fkey
      FOREIGN KEY (hazard_id) REFERENCES mitigation_items(id) ON DELETE CASCADE;
    RAISE NOTICE 'Changed hazard_id FK to ON DELETE CASCADE';
  ELSE
    RAISE NOTICE 'hazard_id FK constraint not found - migration may have been applied differently';
  END IF;
END $$;
