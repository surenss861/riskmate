# Quick Data Sync Checklist

**Use this checklist to verify web and iOS share the same data.**

## ✅ 1. Same Supabase Project (30 seconds)

Run the verification script:
```bash
./scripts/verify-supabase-sync.sh
```

**Expected**: All URLs match exactly.

**If mismatch**: Update the config file that's different.

---

## ✅ 2. Same User Identity (1 minute)

**On Web** (browser console):
```javascript
const { data: { user } } = await supabase.auth.getUser()
console.log('User ID:', user.id, 'Email:', user.email)
```

**On iOS** (add temporary debug code):
```swift
if let user = try? await supabase.auth.user {
    print("User ID: \(user.id), Email: \(user.email)")
}
```

**Expected**: Same `user.id` and `user.email` on both platforms.

**If different**: User is logged into different accounts. Use the same login method (email/password or same OAuth provider).

---

## ✅ 3. Same Organization ID (1 minute)

Run in Supabase SQL Editor:
```sql
SELECT 
  u.email,
  m.organization_id,
  o.name as org_name
FROM auth.users u
JOIN memberships m ON m.user_id = u.id
JOIN organizations o ON o.id = m.organization_id
WHERE u.email = 'your-test-email@example.com';
```

**Expected**: One row with the same `organization_id`.

**If multiple rows or different orgs**: iOS is creating a new org or using a different org selection logic.

---

## ✅ 4. RLS Not Blocking (2 minutes)

**Test**:
1. Create a job on web
2. Note the job `id`
3. Try to read it on iOS

**Expected**: iOS can read the job.

**If iOS returns empty but you can see the row in Supabase table viewer**: RLS is blocking. Check RLS policies in `supabase/migrations/*_row_level_security.sql`.

---

## ✅ 5. Export Worker RPC (Optional)

**Test**:
1. Create an export (queues a job)
2. Watch backend logs

**Expected**:
- `[ExportWorker] Claimed export job via RPC` ✅ (RPC working)
- OR `[ExportWorker] Claimed export job via fallback` ✅ (Fallback working, but apply migration)

**If RPC not found**: Apply migration `20251203000004_export_worker_atomic_claim.sql` (see `RPC_FUNCTION_SETUP.md`).

---

## 🎯 Summary

If all 5 checks pass, your data will sync perfectly across web and iOS! 

**Most common issues**:
1. Different Supabase URLs → Fix: Update config files
2. Different user accounts → Fix: Use same login method
3. Different organization IDs → Fix: Ensure iOS uses existing org, doesn't create new one
4. RLS blocking → Fix: Review RLS policies

For detailed troubleshooting, see `DATA_SYNC_VERIFICATION.md`.
