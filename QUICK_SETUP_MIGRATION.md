# Quick Setup: Apply claim_export_job Migration

This is a quick guide to fix the "function not found" error in your export worker.

## 🎯 The Problem

Your Railway backend logs show:
```
Could not find the function public.claim_export_job(...) in the schema cache
```

This means the migration `20251203000004_export_worker_atomic_claim.sql` hasn't been applied to your Supabase database.

## ✅ The Fix (2 minutes)

### Step 1: Open Supabase SQL Editor

1. Go to https://app.supabase.com
2. Select your project (the one Railway backend is using)
3. Click **SQL Editor** in the left sidebar

### Step 2: Copy and Run the Migration

1. Open this file: `supabase/migrations/20251203000004_export_worker_atomic_claim.sql`
2. Copy the **entire contents**
3. Paste into Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)

### Step 3: Verify It Worked

Run this SQL in the same editor:

```sql
SELECT
  n.nspname AS schema,
  p.proname AS function,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'claim_export_job';
```

**You should see:**
```
schema | function          | args
-------|-------------------|------------------
public | claim_export_job  | p_max_concurrent integer DEFAULT 3
```

### Step 4: Refresh PostgREST Cache

Run this SQL:

```sql
SELECT pg_notify('pgrst', 'reload schema');
```

### Step 5: Restart Railway Backend

1. Go to Railway Dashboard
2. Select your backend service
3. Click **Deploy** → **Redeploy** (or just wait for next auto-deploy)

### Step 6: Verify It's Working

1. Check Railway logs
2. You should see: `[ExportWorker] claimed export job via RPC`
3. No more "function not found" errors

---

## 🔍 Verify All Migrations Applied

Run this to check all required migrations:

```sql
-- Check if all required tables exist
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

You should see all 10 tables.

---

## ⚠️ Still Not Working?

### Issue: Function exists but backend still can't find it

**Solution:**
1. Double-check Railway env var `SUPABASE_URL` points to the same project
2. Run `SELECT pg_notify('pgrst', 'reload schema');` again
3. Wait 30 seconds, then restart Railway

### Issue: Different Supabase projects

**Solution:**
- Web, iOS, and backend **must** all point to the **same** Supabase project URL
- Check:
  - Web: `.env.local` → `NEXT_PUBLIC_SUPABASE_URL`
  - iOS: `Config.plist` → `SUPABASE_URL`
  - Backend: Railway Variables → `SUPABASE_URL`

Run `./scripts/verify-database-sync.sh` to check automatically.

---

## 📚 Full Documentation

- `DATABASE_SYNC_GUIDE.md` - Complete sync guide
- `APPLY_MIGRATIONS.md` - All migrations guide
- `scripts/setup-database-sync.sh` - Automated setup script
