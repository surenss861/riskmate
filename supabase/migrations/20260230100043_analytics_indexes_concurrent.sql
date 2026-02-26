-- Analytics indexes are created with CREATE INDEX CONCURRENTLY outside a transaction
-- to avoid long write locks. Run supabase/scripts/create_analytics_indexes_concurrent.sql
-- manually or as a pre-deploy step (outside the migration transaction).
-- This migration only verifies that the indexes exist; it does not create them.
DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
  idx text;
  required text[] := ARRAY[
    'idx_mitigation_items_org_created',
    'idx_signatures_org_job',
    'idx_signatures_org_signed_at',
    'idx_documents_org_job_type',
    'idx_jobs_org_created'
  ];
BEGIN
  FOREACH idx IN ARRAY required
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = idx) THEN
      missing := array_append(missing, idx);
    END IF;
  END LOOP;
  IF array_length(missing, 1) > 0 THEN
    RAISE NOTICE 'Analytics indexes missing: %. Run supabase/scripts/create_analytics_indexes_concurrent.sql outside a transaction (e.g. pre-deploy step) to create them with zero write lock.', array_to_string(missing, ', ');
  END IF;
END $$;
