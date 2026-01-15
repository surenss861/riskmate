# Final Verification: Web ↔ iOS Database Sync

This guide ensures your web app and iOS app share the same database and data carries over seamlessly.

---

## ✅ Step 1: Apply Migration to Supabase

### 1.1 Open Supabase SQL Editor

1. Go to https://app.supabase.com
2. Select your project (the one Railway backend is using)
3. Click **SQL Editor** in the left sidebar

### 1.2 Apply the Migration

1. Open this file: `supabase/migrations/20251203000004_export_worker_atomic_claim.sql`
2. Copy the **entire contents** (all 107 lines)
3. Paste into Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)

**Expected:** "Success. No rows returned" or similar success message

### 1.3 Refresh PostgREST Schema Cache

Immediately after applying the migration, run this in the same SQL Editor:

```sql
SELECT pg_notify('pgrst', 'reload schema');
```

**Expected:** "Success. No rows returned"

---

## ✅ Step 2: Verify RPC Function Exists

Run this SQL to confirm the function was created:

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

**Expected Result:**
```
schema | function_name     | args
-------|-------------------|------------------
public | claim_export_job  | p_max_concurrent integer DEFAULT 3
```

✅ **If you see this row, the migration is applied correctly.**

---

## ✅ Step 3: Verify Configuration Consistency

### 3.1 Check Web Configuration

**File:** `.env.local` (or Vercel Environment Variables)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note the URL:** `https://xxxxx.supabase.co` ← This is your Supabase project

### 3.2 Check iOS Configuration

**File:** `mobile/Riskmate/Riskmate/Config.plist`

```xml
<key>SUPABASE_URL</key>
<string>https://xxxxx.supabase.co</string>
<key>SUPABASE_ANON_KEY</key>
<string>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</string>
```

**Verify:**
- ✅ `SUPABASE_URL` matches web's `NEXT_PUBLIC_SUPABASE_URL` exactly
- ✅ `SUPABASE_ANON_KEY` matches web's `NEXT_PUBLIC_SUPABASE_ANON_KEY` exactly

### 3.3 Check Backend Configuration (Railway)

**Railway Dashboard → Your Service → Variables**

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (different from anon key)
```

**Verify:**
- ✅ `SUPABASE_URL` matches web/iOS exactly
- ✅ `SUPABASE_SERVICE_ROLE_KEY` is set (different from anon key)

### 3.4 Automated Verification

Run the verification script:

```bash
./scripts/verify-database-sync.sh
```

**Expected:** All checks pass ✅

---

## ✅ Step 4: Restart Railway Backend

After applying the migration and refreshing the schema cache:

1. Go to Railway Dashboard
2. Select your backend service
3. Click **Deploy** → **Redeploy** (or wait for next auto-deploy)

**Alternative:** Just wait for the next git push to trigger auto-deploy

---

## ✅ Step 5: Verify Export Worker is Using RPC

### 5.1 Check Railway Logs

1. Go to Railway Dashboard → Your Backend Service → Logs
2. Look for export worker messages

**Good Signs:**
- ✅ `[ExportWorker] claimed export job via RPC`
- ✅ No "function not found" errors
- ✅ No RPC warning spam

**Bad Signs:**
- ❌ `Could not find the function public.claim_export_job`
- ❌ RPC warnings every 5 seconds

### 5.2 Trigger a Test Export

1. On web app, create a job
2. Generate an export (Proof Pack or PDF)
3. Check Railway logs within 10 seconds

**Expected:** You should see the export worker claim the job via RPC

---

## ✅ Step 6: Smoke Test Web ↔ iOS Sync

### Test 1: Web → iOS

1. **On Web:**
   - Log in to your account
   - Go to Operations → Jobs
   - Create a new job (e.g., "Test Job - Web Created")
   - Add a hazard
   - Upload evidence (if possible)

2. **On iOS:**
   - Log in with the **same email/password**
   - Navigate to Work Records
   - **Expected:** You should see "Test Job - Web Created"
   - Open the job → **Expected:** Hazard and evidence should be visible

✅ **If you see the job, web → iOS sync is working!**

### Test 2: iOS → Web

1. **On iOS:**
   - Log in (same account)
   - Create a new job (e.g., "Test Job - iOS Created")
   - Upload evidence

2. **On Web:**
   - Refresh the page (or navigate away and back)
   - Go to Operations → Jobs
   - **Expected:** You should see "Test Job - iOS Created"
   - Open the job → **Expected:** Evidence should be visible

✅ **If you see the job, iOS → web sync is working!**

### Test 3: Export Generation

1. **On Web:**
   - Create a job with some data
   - Generate a Proof Pack export

2. **Check Railway Logs:**
   - Should see: `[ExportWorker] claimed export job via RPC`
   - Export should complete successfully

3. **On iOS:**
   - Open the same job
   - Go to Exports tab
   - **Expected:** Export should appear in "Recent Exports"

✅ **If export appears on both platforms, full sync is working!**

---

## ✅ Step 7: Verify Organization Context

### 7.1 Check User Organization Membership

Run this SQL in Supabase (replace `YOUR_USER_EMAIL`):

```sql
SELECT 
  u.email,
  om.organization_id,
  o.name AS organization_name,
  om.role
FROM auth.users u
JOIN organization_members om ON om.user_id = u.id
JOIN organizations o ON o.id = om.organization_id
WHERE u.email = 'YOUR_USER_EMAIL';
```

**Expected:** You should see your user's organization membership

### 7.2 Verify RLS is Working

Try to access data from a different organization (should fail):

```sql
-- This should return 0 rows (RLS blocks cross-org access)
SELECT * FROM jobs 
WHERE organization_id != (
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid()
  LIMIT 1
);
```

---

## 🎯 Success Criteria

You're fully synced when:

- [x] Migration `20251203000004_export_worker_atomic_claim.sql` applied
- [x] `claim_export_job` function exists (verified with SQL)
- [x] PostgREST schema cache refreshed
- [x] Web, iOS, and backend all use same `SUPABASE_URL`
- [x] Web and iOS use same `SUPABASE_ANON_KEY`
- [x] Railway backend restarted/redeployed
- [x] Export worker uses RPC (no "function not found" errors)
- [x] Job created on web appears on iOS
- [x] Job created on iOS appears on web
- [x] Evidence uploaded on web appears on iOS
- [x] Evidence uploaded on iOS appears on web
- [x] Exports generated on web appear on iOS

---

## 🔧 Troubleshooting

### Problem: "Data doesn't appear on iOS after creating on web"

**Check:**
1. ✅ Same Supabase URL in both?
2. ✅ Same user account (same email)?
3. ✅ User is member of same organization?
4. ✅ RLS policies allow read access?

**Fix:**
- Run `./scripts/verify-database-sync.sh`
- Check iOS logs for auth errors
- Verify user's `organization_id` matches

### Problem: "Export worker still shows 'function not found'"

**Check:**
1. ✅ Migration applied to correct Supabase project?
2. ✅ Function exists (run verification SQL)?
3. ✅ PostgREST cache refreshed?
4. ✅ Railway backend restarted?

**Fix:**
```sql
-- Re-apply migration
-- Then refresh cache
SELECT pg_notify('pgrst', 'reload schema');
-- Wait 30 seconds, restart Railway
```

### Problem: "User can't log in on iOS with web credentials"

**Check:**
1. ✅ Same Supabase project?
2. ✅ Same anon key?
3. ✅ User exists in `auth.users`?

**Fix:**
- Verify `Config.plist` matches web env vars
- Check Supabase Auth dashboard for user
- Try resetting password on web, then use new password on iOS

---

## 📚 Quick Reference

**Migration File:** `supabase/migrations/20251203000004_export_worker_atomic_claim.sql`

**Verification SQL:**
```sql
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'claim_export_job';
```

**Refresh Cache:**
```sql
SELECT pg_notify('pgrst', 'reload schema');
```

**Verification Script:** `./scripts/verify-database-sync.sh`

**Setup Script:** `./scripts/setup-database-sync.sh`

---

## 🎉 You're Done!

Once all checks pass, your web and iOS apps are fully synced. Data created on one platform will immediately appear on the other, and exports will use atomic RPC claims for reliability.
