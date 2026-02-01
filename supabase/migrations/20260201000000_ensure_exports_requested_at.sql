-- Ensure exports table has requested_at (PGRST204 fix when column missing from schema)
-- Safe to run: ADD COLUMN IF NOT EXISTS
ALTER TABLE exports
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;

-- Backfill any nulls with created_at for existing rows
UPDATE exports SET requested_at = created_at WHERE requested_at IS NULL;
