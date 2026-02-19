-- Run this in Supabase Dashboard → SQL Editor to fix "Found local migration files to be inserted
-- before the last migration on remote database". It inserts missing migration versions into
-- schema_migrations so the CLI considers them applied. Use only if your remote DB schema already
-- has these migrations applied (e.g. from a previous push or manual run).
-- After running, use:  supabase db push   (no --include-all)

-- Ensure 20260215000000 exists with exact name (fixes duplicate key / CLI mismatch)
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES (20260215000000, '20260215000000_add_notification_preferences.sql', ARRAY[]::text[])
ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES
  (20260216100000, '20260216100000_job_assignments_assignee_org_check.sql', ARRAY[]::text[]),
  (20260216110000, '20260216110000_notification_preferences.sql', ARRAY[]::text[]),
  (20260216110500, '20260216110500_notification_preferences_push_email.sql', ARRAY[]::text[]),
  (20260216115000, '20260216115000_migrate_notification_preferences_to_contract.sql', ARRAY[]::text[]),
  (20260216120000, '20260216120000_notifications_table.sql', ARRAY[]::text[]),
  (20260216130000, '20260216130000_add_notifications_deep_link.sql', ARRAY[]::text[]),
  (20260216140000, '20260216140000_notifications_reintroduce_organization_id.sql', ARRAY[]::text[]),
  (20260217100000, '20260217100000_add_jobs_assignment_denormal.sql', ARRAY[]::text[]),
  (20260217110000, '20260217110000_bulk_delete_cascade_soft_delete.sql', ARRAY[]::text[]),
  (20260217120000, '20260217120000_exports_add_bulk_jobs_type.sql', ARRAY[]::text[]),
  (20260217130000, '20260217130000_bulk_ops_indexes.sql', ARRAY[]::text[]),
  (20260217140000, '20260217140000_bulk_status_assign_rpcs.sql', ARRAY[]::text[]),
  (20260218100000, '20260218100000_bulk_soft_delete_eligibility_checks.sql', ARRAY[]::text[]),
  (20260218123000, '20260218123000_add_email_digest_reminder_preferences.sql', ARRAY[]::text[]),
  (20260220000000, '20260220000000_add_search_vectors.sql', ARRAY[]::text[]),
  (20260221000000, '20260221000000_backfill_clients_and_upsert.sql', ARRAY[]::text[]),
  (20260228000000, '20260228000000_add_tasks.sql', ARRAY[]::text[]),
  (20260229100000, '20260229100000_hazard_search_soft_delete_and_vector.sql', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;
