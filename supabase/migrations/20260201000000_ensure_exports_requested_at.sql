-- Add missing column with default
ALTER TABLE exports 
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing records (use created_at for historical data)
UPDATE exports 
SET requested_at = created_at 
WHERE requested_at IS NULL;

-- Add index for performance (requested_at is frequently queried)
CREATE INDEX IF NOT EXISTS idx_exports_requested_at ON exports(requested_at DESC);
