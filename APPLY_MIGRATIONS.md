# Apply Database Migrations to Supabase

This guide helps you apply all database migrations to ensure web, iOS, and backend share the same schema.

## Where do migrations run?

**Migrations do not run automatically in CI.** You must apply them manually or as part of your release checklist.

| Environment | How migrations run |
|-------------|---------------------|
| **Local / dev** | Supabase Dashboard SQL Editor, or `supabase db push` from your machine |
| **Production** | **Manual**: run each migration in Supabase Dashboard → SQL Editor, or `supabase link` + `supabase db push` from a machine with Supabase CLI |
| **CI** | Not run by default. If you add a CI step, use `supabase db push` with a project ref and service role key in secrets |

**Why this matters:** 90% of "it works locally but prod is broken" in this stack = migrations not applied in production. Before each production deploy, confirm the migration list below is applied in your Supabase project (Dashboard → SQL Editor → run any missing file).

## 🎯 Quick Start

### Option 1: Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor**
4. Run each migration file in order (copy/paste the entire file contents)

**Migration Order (by filename timestamp):**
1. `supabase/migrations/20250126000002_add_exports_failure_reason.sql` – export failure_reason column
2. `supabase/migrations/20250201000000_performance_indexes.sql` – jobs/evidence/exports indexes
3. `supabase/migrations/20251203000000_database_hardening_ledger_compliance.sql`
4. `supabase/migrations/20251203000001_ledger_trigger_safety_net.sql`
5. `supabase/migrations/20251203000002_fix_ledger_chain_of_custody.sql`
6. `supabase/migrations/20251203000003_fix_evidence_lifecycle.sql`
7. `supabase/migrations/20251203000004_export_worker_atomic_claim.sql` ⚠️ **Required for export worker**
8. `supabase/migrations/20251203000005_production_hardening.sql` ⚠️ **Required for exports** (adds `request_id`, `verification_token`, `failure_count` to `exports`)
9. `supabase/migrations/20260201000000_ensure_exports_requested_at.sql` – ensures `requested_at` column exists (fixes PGRST204 export 500)

### Option 2: Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link your project (get project ref from Supabase dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

---

## ✅ Verify Migrations Applied

### Check claim_export_job Function

Run this in Supabase SQL Editor:

```sql
SELECT
  n.nspname AS schema,
  p.proname AS function,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'claim_export_job';
```

**Expected Result:**
```
schema | function          | args
-------|-------------------|------------------
public | claim_export_job  | p_max_concurrent integer DEFAULT 3
```

If you see this, the migration is applied ✅

### Refresh PostgREST Schema Cache

If the function exists but backend still can't find it:

```sql
SELECT pg_notify('pgrst', 'reload schema');
```

Then restart your Railway backend service.

---

## 🔍 Verify All Tables Exist

Run this to check all required tables:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'jobs',
    'hazards',
    'controls',
    'evidence',
    'exports',
    'audit_logs',
    'ledger_roots',
    'organizations',
    'organization_members',
    'users'
  )
ORDER BY table_name;
```

You should see all 10 tables listed.

---

## ⚠️ Common Issues

### "Function claim_export_job does not exist"

**Solution:**
1. Run `20251203000004_export_worker_atomic_claim.sql` in Supabase SQL Editor
2. Verify with the SQL check above
3. Refresh PostgREST cache: `SELECT pg_notify('pgrst', 'reload schema');`
4. Restart Railway backend

### "Migration already applied" errors

**Solution:**
- These are safe to ignore if the migration was already run
- Use `CREATE OR REPLACE FUNCTION` statements (they're idempotent)

### "Permission denied" errors

**Solution:**
- Make sure you're using the SQL Editor (has admin permissions)
- Don't run migrations via API or with anon key

### "Failed to create export job" / DATABASE_ERROR (iOS or web export)

**Cause:** The `exports` table is missing or missing columns the backend expects. The backend inserts `request_id`, `verification_token`, `idempotency_key`, `filters`, `created_by`, `requested_by`, `requested_at` (and base columns). If migration `20251203000005_production_hardening.sql` was not applied, `request_id` and `verification_token` columns are missing and the INSERT fails.

**Solution:**
1. In Supabase SQL Editor, run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'exports' ORDER BY ordinal_position;` (or use Table Editor) and confirm the table has columns: `request_id`, `verification_token`, `idempotency_key`, `failure_count`, `requested_at`, plus base columns from `20251203000000_database_hardening_ledger_compliance.sql`.
2. **Quick fix for PGRST204 (missing requested_at):** Run `20260201000000_ensure_exports_requested_at.sql` or: `ALTER TABLE exports ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;`
3. If the table is missing, run in order: `20251203000000_database_hardening_ledger_compliance.sql`, then `20251203000002_fix_ledger_chain_of_custody.sql` (adds `idempotency_key`), then `20251203000005_production_hardening.sql` (adds `request_id`, `verification_token`, `failure_count`), then `20260201000000_ensure_exports_requested_at.sql`.
4. If the table exists but columns are missing, run `20251203000005_production_hardening.sql` and `20260201000000_ensure_exports_requested_at.sql` (both use `ADD COLUMN IF NOT EXISTS`).
5. If using PostgREST/Supabase schema cache, refresh: `SELECT pg_notify('pgrst', 'reload schema');` then restart the Railway backend.
6. Retry export from iOS or web.

---

## 📋 Migration Checklist

- [ ] `20250126000002_add_exports_failure_reason.sql` - Export failure_reason (user-facing)
- [ ] `20250201000000_performance_indexes.sql` - Performance indexes (jobs, evidence, exports)
- [ ] `20251203000000_database_hardening_ledger_compliance.sql` - Base schema
- [ ] `20251203000001_ledger_trigger_safety_net.sql` - Ledger triggers
- [ ] `20251203000002_fix_ledger_chain_of_custody.sql` - Chain of custody
- [ ] `20251203000003_fix_evidence_lifecycle.sql` - Evidence table
- [ ] `20251203000004_export_worker_atomic_claim.sql` - Export worker RPC
- [ ] `20251203000005_production_hardening.sql` - Exports request_id, verification_token, failure_count
- [ ] Verified `claim_export_job` function exists
- [ ] Refreshed PostgREST schema cache
- [ ] Restarted Railway backend
- [ ] Export worker no longer shows "function not found" errors

---

## 🚀 After Migrations

1. **Test Backend:**
   - Check Railway logs for "claimed export job via RPC" messages
   - No more "function not found" errors

2. **Test Web:**
   - Create a job
   - Upload evidence
   - Generate export

3. **Test iOS:**
   - Log in with same account
   - See job created on web
   - Upload evidence
   - See it on web

---

## 📚 Related- `DATABASE_SYNC_GUIDE.md` - Full sync guide
- `scripts/verify-database-sync.sh` - Verification script