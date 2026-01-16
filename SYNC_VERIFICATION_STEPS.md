# Data Sync Verification Steps

**Quick checklist to verify web and iOS share the same data.**

## ✅ Step 1: Verify Supabase URLs Match

Run the automated script:
```bash
./scripts/verify-supabase-sync.sh
```

**Expected**: All URLs match `https://xwxghduwkzmzjrbpzwwq.supabase.co`

**If mismatch**: Update the config file that's different.

---

## ✅ Step 2: Verify User ID Matches

**On Web** (browser console after login):
```javascript
const { data: { user } } = await supabase.auth.getUser()
const { data: userRow } = await supabase
  .from('users')
  .select('organization_id, role')
  .eq('id', user.id)
  .single()

console.log('Web User ID:', user.id)
console.log('Web Email:', user.email)
console.log('Web Org ID:', userRow?.organization_id)
console.log('Web Role:', userRow?.role)
```

**On iOS** (add temporary debug code after login):
```swift
if let user = try? await supabase.auth.user {
    let userRow = try? await supabase
        .from("users")
        .select("organization_id, role")
        .eq("id", user.id)
        .single()
        .execute()
    
    print("iOS User ID: \(user.id)")
    print("iOS Email: \(user.email)")
    print("iOS Org ID: \(userRow?.data.organization_id ?? "nil")")
    print("iOS Role: \(userRow?.data.role ?? "nil")")
}
```

**Expected**: 
- ✅ Same `user.id` on both platforms
- ✅ Same `organization_id` on both platforms

**If different**:
- Different `user.id` → Different accounts (check email/provider mismatch)
- Different `organization_id` → Different org context (iOS creating new org?)

---

## ✅ Step 3: Test RLS (Row-Level Security)

**Test**:
1. Create a job on **web**
2. Note the job `id`
3. Open jobs list on **iOS**
4. Check if the job appears

**Expected**: ✅ Job appears on iOS

**If job doesn't appear**:
- ❌ RLS is blocking (check RLS policies)
- ❌ Different `organization_id` (see Step 2)
- ❌ Job created in different Supabase project (see Step 1)

---

## ✅ Step 4: Verify RPC Function Exists

**In Supabase SQL Editor** (for project `xwxghduwkzmzjrbpzwwq`):
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

**Expected**: 1 row with `args` = `p_max_concurrent integer`

**If missing**: Apply migration `20251203000004_export_worker_atomic_claim.sql`

---

## ✅ Step 5: Verify Export Worker Uses RPC

**Test**:
1. Create an export (queues a job)
2. Watch Railway logs

**Expected Log**:
```
[ExportWorker] Claimed export job via RPC
export_id: <uuid>
```

**If you see**:
```
[ExportWorker] Claimed export job via fallback (optimistic locking)
```

**This means**:
- RPC function doesn't exist (see Step 4)
- OR RPC permissions are broken
- OR wrong Supabase project

**Production Safety**: 
- Set `EXPORT_WORKER_REQUIRE_RPC=true` in Railway
- Worker will fail fast if RPC is missing (prevents silent fallback)

---

## 🎯 Summary

**All 5 steps must pass** for data to sync correctly:

1. ✅ Same Supabase URL (web, iOS, backend)
2. ✅ Same user.id (web and iOS)
3. ✅ Same organization_id (web and iOS)
4. ✅ RLS allows reads (job created on web appears on iOS)
5. ✅ RPC function exists and worker uses it

**Most common issues**:
1. Different Supabase URLs → Fix: Update config files
2. Different user accounts → Fix: Use same login method (email/password or same OAuth provider)
3. Different organization IDs → Fix: Ensure iOS uses existing org, doesn't create new one
4. RLS blocking → Fix: Review RLS policies in `supabase/migrations/*_row_level_security.sql`
5. RPC missing → Fix: Apply migration `20251203000004_export_worker_atomic_claim.sql`

---

## 🚨 Production Safety Improvements

### Fail Fast in Production

Set in Railway environment variables:
```env
EXPORT_WORKER_REQUIRE_RPC=true
```

This ensures:
- Worker fails immediately if RPC is missing
- No silent fallback in production
- Clear error logs for debugging

### Deterministic Org Selection

Both web and iOS use the same pattern:
1. Get `user.id` from auth session
2. Query `users` table: `SELECT organization_id WHERE id = user.id`
3. Use that `organization_id` for all queries

**This ensures**:
- Same user → Same org
- No org selection logic differences
- Consistent data access

---

For detailed troubleshooting, see `DATA_SYNC_VERIFICATION.md`.
