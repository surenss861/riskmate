# Team Removal & Account Deletion - Verification Checklist

## ✅ Pre-Verification: Confirm Deployment Status

### A) Check Deployed Commit

**Current commit:** `83cf6fe` - "fix: Implement server-side team removal and account deletion with RPC functions"

**Required files in commit:**
- ✅ `supabase/migrations/20241225000000_add_remove_team_member_rpc.sql`
- ✅ `supabase/migrations/20241225000001_fix_fk_constraints_for_deletion.sql`
- ✅ `lib/supabase/admin.ts`
- ✅ `app/api/team/member/[id]/route.ts` (updated)
- ✅ `app/api/account/deactivate/route.ts` (updated)

**Verify in Vercel:**
1. Go to Vercel Dashboard → Deployments → Production
2. Confirm active deploy shows commit `83cf6fe` (or newer)
3. Hard refresh app (Cmd+Shift+R / Ctrl+Shift+R) to clear cached JS

---

## 🔧 Database Migrations (CRITICAL - Must Be Applied)

### B) Apply Migrations

**Migration 1:** `20241225000000_add_remove_team_member_rpc.sql`
- Creates `remove_team_member()` SECURITY DEFINER function
- **Status:** ⬜ Not Applied / ✅ Applied

**Migration 2:** `20241225000001_fix_fk_constraints_for_deletion.sql`
- Fixes FK constraints (ON DELETE SET NULL)
- **Status:** ⬜ Not Applied / ✅ Applied

**How to Apply:**

**Option A: Supabase Dashboard (Recommended)**
1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/migrations/20241225000000_add_remove_team_member_rpc.sql`
3. Copy entire contents and paste into SQL Editor
4. Click "Run" (or Cmd+Enter / Ctrl+Enter)
5. Wait for success message
6. Repeat for `20241225000001_fix_fk_constraints_for_deletion.sql`

**Option B: Supabase CLI**
```bash
cd "/Users/surensureshkumar/coding projects/riskmate"
supabase db push
```

---

## ✅ Database Verification Queries

### C) Verify RPC Function Exists

Run in Supabase SQL Editor:

```sql
-- Check function exists
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'remove_team_member';
```

**Expected Result:**
- ✅ Returns 1 row
- ✅ `prosecdef = true` (SECURITY DEFINER)

**If missing:** Migration 1 not applied - apply it now.

---

### D) Verify FK Constraints

Run in Supabase SQL Editor:

```sql
-- Check FK delete behavior
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('job_assignments', 'jobs', 'hazards', 'users')
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name IN ('user_id', 'created_by', 'invited_by')
ORDER BY tc.table_name, kcu.column_name;
```

**Expected Results:**
- ✅ `job_assignments.user_id` → `delete_rule = 'SET NULL'` or `'CASCADE'`
- ✅ `jobs.created_by` → `delete_rule = 'SET NULL'`
- ✅ `hazards.created_by` → `delete_rule = 'SET NULL'`
- ✅ `users.invited_by` → `delete_rule = 'SET NULL'`

**If wrong:** Migration 2 not applied - apply it now.

---

### E) Verify Environment Variables

**In Vercel Dashboard → Settings → Environment Variables:**

- ✅ `SUPABASE_SERVICE_ROLE_KEY` exists (Production + Preview)
- ✅ Value is set (not empty)
- ✅ Not exposed in client-side code (check `lib/supabase/admin.ts` is server-only)

**Verify in code:**
```bash
# Should NOT find SERVICE_ROLE_KEY in client code
grep -r "SERVICE_ROLE_KEY" app/operations components/ --exclude-dir=node_modules
# Should only find in server files:
# - lib/supabase/admin.ts ✅
# - app/api/**/*.ts ✅
```

---

## 🧪 Real-World Testing

### F) Team Member Removal Tests

#### Test 1: Remove Regular Member ✅ / ❌
1. Go to `/operations/team`
2. Click "Deactivate Access" on a regular member (not owner)
3. **Expected:** Member removed successfully, removed from list
4. **Error if fails:** [Paste error message here]

#### Test 2: Remove Yourself ✅ / ❌
1. Try to remove yourself
2. **Expected:** Error: "cannot remove yourself: ask another owner or admin to remove you"
3. **Error if fails:** [Paste error message here]

#### Test 3: Remove Last Owner ✅ / ❌
1. If you're the only owner, try to remove another owner (if exists)
2. If you're the only owner, try to remove yourself
3. **Expected:** Error: "cannot remove last owner: transfer ownership or add another owner first"
4. **Error if fails:** [Paste error message here]

#### Test 4: Remove Member with Active Assignments ✅ / ❌
1. Create a job and assign it to a member
2. Try to remove that member
3. **Expected:** 
   - Either: Member removed, assignments auto-reassigned to owner/admin
   - Or: Error asking to reassign first (depending on RPC implementation)
4. **Actual behavior:** [Describe what happened]
5. **Error if fails:** [Paste error message here]

---

### G) Account Deactivation Tests

#### Test 5: Deactivate Regular Account ✅ / ❌
1. Go to `/operations/account` → Danger Zone
2. Type "DELETE" in confirmation field
3. Click "Deactivate Account"
4. Confirm in dialog
5. **Expected:** 
   - Success message shown
   - User logged out
   - Cannot log back in
   - User archived in database
6. **Error if fails:** [Paste error message here]

#### Test 6: Deactivate Last Owner ✅ / ❌
1. As the last owner, try to deactivate account
2. **Expected:** Error: "Cannot deactivate the last owner. Transfer ownership or add another owner first."
3. **Error if fails:** [Paste error message here]

---

## 🔍 Error Verification

### H) Check Error Messages Are Specific

**Before fix:** Generic "API request failed" or "We couldn't remove that member"

**After fix:** Specific messages like:
- ✅ "cannot remove yourself: ask another owner or admin to remove you"
- ✅ "cannot remove last owner: transfer ownership or add another owner first"
- ✅ "member not found or already removed"
- ✅ "only owners can remove other owners"

**Browser Console:**
- ✅ No unhandled promise rejections
- ✅ Errors show specific messages (not generic)

**Vercel Logs:**
- ✅ API route errors include returned messages/codes
- ✅ No silent 400s or 500s

---

## 📋 Quick Verification Script

Run this in Supabase SQL Editor to check everything at once:

```sql
-- 1. Check RPC function
SELECT 
  CASE WHEN COUNT(*) > 0 THEN '✅ RPC function exists' 
       ELSE '❌ RPC function MISSING - apply migration 1' 
  END AS rpc_status
FROM pg_proc 
WHERE proname = 'remove_team_member';

-- 2. Check FK constraints
SELECT 
  tc.table_name,
  kcu.column_name,
  rc.delete_rule,
  CASE 
    WHEN rc.delete_rule IN ('SET NULL', 'CASCADE') THEN '✅'
    ELSE '❌'
  END AS status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('job_assignments', 'jobs', 'hazards')
  AND kcu.column_name IN ('user_id', 'created_by')
  AND tc.constraint_type = 'FOREIGN KEY';
```

---

## 🚨 Troubleshooting

### If "API request failed" still appears:

1. **Check migrations applied:** Run verification queries above
2. **Check commit deployed:** Verify Vercel shows `83cf6fe`
3. **Check environment variables:** Verify `SUPABASE_SERVICE_ROLE_KEY` is set
4. **Check browser cache:** Hard refresh (Cmd+Shift+R)
5. **Check Vercel logs:** Look for specific error messages

### If RPC function not found:

- Migration 1 not applied
- Apply `20241225000000_add_remove_team_member_rpc.sql` in Supabase SQL Editor

### If FK constraints wrong:

- Migration 2 not applied
- Apply `20241225000001_fix_fk_constraints_for_deletion.sql` in Supabase SQL Editor

### If account deletion fails:

- Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- Check Vercel logs for admin client errors
- Verify admin client is only used server-side

---

## ✅ Completion Checklist

- [ ] Commit `83cf6fe` deployed to production
- [ ] Migration 1 applied (RPC function exists)
- [ ] Migration 2 applied (FK constraints correct)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel
- [ ] Test 1 passed (remove regular member)
- [ ] Test 2 passed (remove yourself blocked)
- [ ] Test 3 passed (remove last owner blocked)
- [ ] Test 4 passed (remove member with assignments)
- [ ] Test 5 passed (deactivate account)
- [ ] Test 6 passed (deactivate last owner blocked)
- [ ] Error messages are specific (not generic)
- [ ] No unhandled promise rejections in console

---

**Status:** ⬜ Not Verified / ✅ Verified and Working

**Date Verified:** _______________

**Verified By:** _______________

**Notes:** 
_________________________________________________
_________________________________________________
_________________________________________________
