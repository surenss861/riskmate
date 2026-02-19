-- Run this in Supabase Dashboard → SQL Editor ONCE.
-- The remote has a row for 20260215000000 but the CLI doesn't recognize it (wrong name/format).
-- Deleting it lets the CLI re-insert it when you run: supabase migration repair 20260215000000 --status applied

DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260215000000';
