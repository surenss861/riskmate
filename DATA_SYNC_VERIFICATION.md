# Data Sync Verification Guide

**Goal**: Ensure web, iOS, and backend all share the same Supabase project and data.

## The 4 Non-Negotiables

### 1. ✅ One Supabase Project Per Environment

**Rule**: All three clients (web, iOS, backend) must use the **exact same** Supabase project URL.

#### Quick Check

**Web (Next.js)**:
- File: `.env.local` or Vercel environment variables
- Variable: `NEXT_PUBLIC_SUPABASE_URL`
- Expected: `https://xwxghduwkzmzjrbpzwwq.supabase.co` (or your project URL)

**iOS**:
- File: `mobile/Riskmate/Riskmate/Config.plist`
- Key: `SUPABASE_URL`
- Expected: **Same URL as web**

**Backend (Railway)**:
- Railway environment variables
- Variable: `SUPABASE_URL`
- Expected: **Same URL as web**

#### Verification Script

Run this to check all three:

```bash
# Check web config
grep "NEXT_PUBLIC_SUPABASE_URL" .env.local | head -1

# Check iOS config
grep -A1 "SUPABASE_URL" mobile/Riskmate/Riskmate/Config.plist

# Check backend (if you have Railway CLI)
railway variables | grep SUPABASE_URL
```

**✅ All three should show the same URL.**

---

### 2. ✅ Same Auth Identity Across Platforms

**Rule**: When a user logs in on web and iOS, they must end up as the **same** `auth.users.id` in Supabase.

#### Common Issues

- **Web uses email/password, iOS uses Sign in with Apple (private relay)** → Creates two accounts
- **Different OAuth providers** → Creates two accounts
- **Email mismatch** → Creates two accounts

#### Verification Steps

**On Web**:
```javascript
// In browser console or your app
const { data: { user } } = await supabase.auth.getUser()
console.log('Web User ID:', user.id)
console.log('Web Email:', user.email)
```

**On iOS**:
```swift
// In your iOS app (add temporary debug code)
if let user = try? await supabase.auth.user {
    print("iOS User ID: \(user.id)")
    print("iOS Email: \(user.email)")
}
```

**✅ Both should show the same `user.id` and `user.email`.**

---

### 3. ✅ Same Organization ID

**Rule**: The user must belong to the **same organization** on both platforms.

#### Verification Steps

**Check Organization Membership**:

```sql
-- Run in Supabase SQL Editor
SELECT 
  u.id as user_id,
  u.email,
  m.organization_id,
  o.name as org_name
FROM auth.users u
LEFT JOIN memberships m ON m.user_id = u.id
LEFT JOIN organizations o ON o.id = m.organization_id
WHERE u.email = 'your-test-email@example.com';
```

**Expected**: One row with the same `organization_id` for both web and iOS sessions.

#### Common Issues

- **iOS creates a new org on first login** → Different `organization_id`
- **Web and iOS use different org selection logic** → Different `organization_id`
- **RLS blocks reads** → iOS "sees nothing" even though data exists

---

### 4. ✅ RLS (Row-Level Security) Not Blocking

**Rule**: RLS policies must allow reads/writes for the same user across platforms.

#### Quick Test

**On Web**: Create a job → Note the `id`

**On iOS**: Query for that same job

```swift
// iOS code
let { data, error } = try await supabase
  .from("jobs")
  .select()
  .eq("id", "the-job-id-from-web")
  .single()

if error != nil {
  print("❌ RLS is blocking: \(error)")
} else {
  print("✅ RLS allows read: \(data)")
}
```

**If iOS returns empty but you can see the row in Supabase table viewer** → RLS is blocking.

#### Fix RLS Issues

Check your RLS policies in `supabase/migrations/*_row_level_security.sql`:

```sql
-- Example: Jobs table should allow reads for org members
CREATE POLICY "Users can read jobs in their organization"
ON jobs FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM memberships 
    WHERE user_id = auth.uid()
  )
);
```

---

## Architecture Recommendation

### ✅ Clean Architecture (Recommended)

**Web + iOS**: Call backend APIs for all writes
- `/api/jobs/...`
- `/api/evidence/...`
- `/api/exports/...`
- `/api/verify/...`

**Backend**: Uses `service_role` key to write, but enforces org boundaries using user's JWT.

**Why**: 
- Keeps ledger defensible
- Avoids RLS headaches
- One business logic path
- Single source of truth

### ⚠️ Direct Supabase Reads (Optional)

For simple reads like "list jobs", you can query Supabase directly, but **only if RLS is correct**.

---

## Quick Diagnostic Checklist

Run these 4 checks to find data mismatch issues immediately:

### ✅ Check 1: Same Supabase URL

```bash
# Web
echo "Web: $(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d'=' -f2)"

# iOS  
echo "iOS: $(grep -A1 SUPABASE_URL mobile/Riskmate/Riskmate/Config.plist | tail -1 | sed 's/.*<string>\(.*\)<\/string>.*/\1/')"

# Backend (if you have access)
echo "Backend: Check Railway dashboard"
```

**✅ All three should match exactly.**

---

### ✅ Check 2: Same User ID

**On Web** (browser console):
```javascript
const { data: { user } } = await supabase.auth.getUser()
console.log('User ID:', user.id, 'Email:', user.email)
```

**On iOS** (add temporary debug):
```swift
if let user = try? await supabase.auth.user {
    print("User ID: \(user.id), Email: \(user.email)")
}
```

**✅ Both should show the same `user.id`.**

---

### ✅ Check 3: Same Organization ID

```sql
-- Run in Supabase SQL Editor
SELECT 
  u.email,
  m.organization_id,
  o.name as org_name
FROM auth.users u
JOIN memberships m ON m.user_id = u.id
JOIN organizations o ON o.id = m.organization_id
WHERE u.email = 'your-test-email@example.com';
```

**✅ Should return one row with the same `organization_id` for both platforms.**

---

### ✅ Check 4: RLS Not Blocking

**Test**: Create a job on web → Try to read it on iOS

**If iOS returns empty but you can see the row in Supabase table viewer** → RLS is blocking.

**Fix**: Review RLS policies in `supabase/migrations/*_row_level_security.sql`

---

## Verifying RPC Function (Export Worker)

The export worker uses `claim_export_job` RPC for atomic job claiming.

### Test RPC Usage

1. **Create an export** (puts a row in `exports` with `state='queued'`)
2. **Watch backend logs**:

   **If RPC works**:
   ```
   [ExportWorker] Claimed export job via RPC
   export_id: <uuid>
   ```

   **If RPC not found (fallback)**:
   ```
   [ExportWorker] RPC function claim_export_job not found. Using fallback.
   ```

### If RPC Not Working

1. **Check migration applied**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT 
     n.nspname AS schema,
     p.proname AS function_name,
     pg_get_function_identity_arguments(p.oid) AS args
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'claim_export_job';
   ```

2. **If function doesn't exist**: Apply migration `20251203000004_export_worker_atomic_claim.sql`

3. **Refresh PostgREST schema cache**:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

---

## Troubleshooting Common Issues

### Issue: "Data created on web doesn't show on iOS"

**Check**:
1. ✅ Same `SUPABASE_URL`? (Check 1)
2. ✅ Same `user.id`? (Check 2)
3. ✅ Same `organization_id`? (Check 3)
4. ✅ RLS allowing reads? (Check 4)

**Most common cause**: Different `organization_id` or RLS blocking.

---

### Issue: "iOS creates duplicate organizations"

**Fix**: Ensure iOS uses the same org selection logic as web:
- Check if user already has a membership → use that org
- Don't auto-create new org on first login if user already exists

---

### Issue: "Export worker not using RPC"

**Check**:
1. Migration `20251203000004_export_worker_atomic_claim.sql` applied?
2. Function exists in `public` schema?
3. PostgREST schema cache refreshed?

**Fix**: See `RPC_FUNCTION_SETUP.md` for detailed steps.

---

## Summary

**The Golden Rule**: One Supabase project, one auth identity, one organization per user, correct RLS policies.

If all 4 checks pass, your data will sync perfectly across web and iOS. 🎯
