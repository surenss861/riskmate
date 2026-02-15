-- Expand audit_logs.category CHECK constraint to match API-supported categories.
-- The original migration (20250119000000) only allowed governance, operations, access.
-- The API supports eight categories; this migration updates existing environments.

-- Drop the existing CHECK constraint (PostgreSQL names it tablename_columnname_check)
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_category_check;

-- Add the expanded constraint with all API-supported categories
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_category_check CHECK (
  category IN (
    'governance',
    'operations',
    'access',
    'review_queue',
    'incident_review',
    'attestations',
    'system',
    'access_review'
  )
);

COMMENT ON COLUMN audit_logs.category IS 'Event category: governance, operations, access, review_queue, incident_review, attestations, system, access_review';
