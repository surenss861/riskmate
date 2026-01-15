# RPC Function Setup: claim_export_job

## ✅ Verification: Migration Matches Code

**Migration creates:**
```sql
CREATE OR REPLACE FUNCTION claim_export_job(p_max_concurrent INTEGER DEFAULT 3)
```

**Code calls:**
```typescript
supabase.rpc('claim_export_job', { p_max_concurrent: MAX_CONCURRENT_EXPORTS })
```

✅ **Signature matches perfectly!** The migration is correct.

---

## 🔍 Step 1: Verify Function Exists

Run this in **Supabase SQL Editor**:

```sql
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'claim_export_job';
```

### Expected Result (Function Exists):
```
schema | function_name     | args
-------|-------------------|------------------
public | claim_export_job  | p_max_concurrent integer DEFAULT 3
```

### If You Get 0 Rows:
The function doesn't exist → Go to Step 2

### If Args Don't Match:
The function exists but signature is wrong → Check migration was applied correctly

---

## 🔧 Step 2: Apply Migration

### Option A: Supabase Dashboard (Recommended)

1. Go to https://app.supabase.com
2. Select your project (the one Railway backend uses)
3. Click **SQL Editor**
4. Open file: `supabase/migrations/20251203000004_export_worker_atomic_claim.sql`
5. Copy **entire contents** (all 107 lines)
6. Paste into SQL Editor
7. Click **Run**

### Option B: Supabase CLI

```bash
supabase db push
```

---

## 🔄 Step 3: Refresh PostgREST Schema Cache

**Immediately after applying migration**, run this in Supabase SQL Editor:

```sql
SELECT pg_notify('pgrst', 'reload schema');
```

**Why:** PostgREST caches the schema. This forces it to reload and see the new function.

**Alternative:** In Supabase Dashboard → API → Click "Reload schema cache" button

---

## ✅ Step 4: Verify Function Works

### Test Call (Optional)

Run this to test the function:

```sql
SELECT * FROM claim_export_job(3);
```

**Expected:**
- If no queued exports: Returns 0 rows
- If queued exports exist: Returns 1 row with the claimed job

---

## 🚀 Step 5: Restart Railway Backend

After applying migration and refreshing cache:

1. Go to Railway Dashboard
2. Select your backend service
3. Click **Deploy** → **Redeploy**

Or just wait for the next git push to trigger auto-deploy.

---

## ✅ Step 6: Verify It's Working

### Check Railway Logs

**Good Signs:**
- ✅ `[ExportWorker] claimed export job via RPC`
- ✅ No "function not found" errors
- ✅ No RPC warning spam (should only log once per minute if missing)

**Bad Signs:**
- ❌ `Could not find the function public.claim_export_job`
- ❌ RPC warnings every 5 seconds

### Trigger Test Export

1. Create a job on web app
2. Generate a Proof Pack export
3. Check Railway logs within 10 seconds
4. Should see: `[ExportWorker] claimed export job via RPC`

---

## 🔍 Troubleshooting

### Problem: Function exists but backend still can't find it

**Solution:**
1. Verify Railway `SUPABASE_URL` points to the same project
2. Run `SELECT pg_notify('pgrst', 'reload schema');` again
3. Wait 30 seconds
4. Restart Railway backend

### Problem: Function signature mismatch

**Check:**
- Migration creates: `claim_export_job(p_max_concurrent INTEGER DEFAULT 3)`
- Code calls: `.rpc('claim_export_job', { p_max_concurrent: 3 })`

**If mismatch:**
- Either update migration to match code
- Or update code to match migration

**Current status:** ✅ They match perfectly

### Problem: Function in wrong schema

**Check:**
```sql
SELECT n.nspname, p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'claim_export_job';
```

**Should return:** `public | claim_export_job`

**If different schema:** Update migration to use `public.claim_export_job` or update code to call correct schema.

---

## 📋 Quick Checklist

- [ ] Function exists (verified with SQL query)
- [ ] Function signature matches code call
- [ ] PostgREST schema cache refreshed
- [ ] Railway backend restarted
- [ ] Railway logs show "claimed export job via RPC"
- [ ] No "function not found" errors

---

## 📚 Related Files

- **Migration:** `supabase/migrations/20251203000004_export_worker_atomic_claim.sql`
- **Code:** `apps/backend/src/services/exportWorker.ts` (line 64)
- **Verification SQL:** `scripts/verify-claim-export-job.sql`
- **Fix Script:** `./scripts/fix-claim-export-job.sh`
- **Full Guide:** `FINAL_VERIFICATION.md`

---

## 🎯 Summary

The migration and code are correctly aligned. The only issue is that the migration hasn't been applied to your Supabase database yet. Once you:

1. Apply the migration
2. Refresh PostgREST cache
3. Restart Railway

The export worker will use atomic RPC claims and the "function not found" errors will stop.
