# Team Member Removal & Account Deletion - Server-Side Fix

## Problem
Team member removal and account deletion were failing with generic "API request failed" errors due to:
1. RLS blocking client-side operations
2. FK constraints blocking deletion when users had active assignments
3. Generic error handling hiding actual issues

## Solution
Implemented server-side operations using SECURITY DEFINER RPC functions and admin client for privileged operations.

---

## Changes Made

### 1. Database Migration: RPC Function (`20241225000000_add_remove_team_member_rpc.sql`)

Created `remove_team_member()` SECURITY DEFINER function that:
- ✅ Validates authorization (owner/admin only)
- ✅ Prevents removing yourself
- ✅ Prevents removing last owner
- ✅ Handles active job assignments (reassigns or unassigns)
- ✅ Soft-removes member (archives with `archived_at`)
- ✅ Returns detailed result with assignment counts

**Usage:**
```sql
SELECT remove_team_member(
  p_organization_id := 'org-uuid',
  p_member_user_id := 'user-uuid',
  p_reassign_to := 'reassign-to-user-uuid' -- optional
);
```

### 2. Database Migration: FK Constraints (`20241225000001_fix_fk_constraints_for_deletion.sql`)

Fixed foreign key constraints to allow graceful user deletion:
- `job_assignments.user_id` → `ON DELETE SET NULL` (assignments survive)
- `jobs.created_by` → `ON DELETE SET NULL` (job history preserved)
- `hazards.created_by` → `ON DELETE SET NULL` (hazard records preserved)
- `users.invited_by` → `ON DELETE SET NULL` (invite chain preserved)

### 3. API Route Update (`app/api/team/member/[id]/route.ts`)

**Before:** Direct Supabase client calls (blocked by RLS)
**After:** Calls RPC function via `supabase.rpc('remove_team_member')`

- Uses SECURITY DEFINER function (bypasses RLS)
- Returns specific error messages from RPC
- Handles assignment reassignment automatically

### 4. Admin Client (`lib/supabase/admin.ts`)

Created admin client using `SUPABASE_SERVICE_ROLE_KEY` for:
- Deleting auth users (requires admin privileges)
- Other privileged operations that bypass RLS

**⚠️ IMPORTANT:** Only use in server-side API routes, never expose to browser.

### 5. Account Deactivation Update (`app/api/account/deactivate/route.ts`)

**Before:** Only archived user record
**After:** 
- Archives user record (soft delete)
- Deletes auth user using admin client (hard delete)
- Handles last owner check
- Returns proper error messages

---

## Deployment Steps

### 1. Apply Database Migrations

**Option A: Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Run `20241225000000_add_remove_team_member_rpc.sql`
3. Run `20241225000001_fix_fk_constraints_for_deletion.sql`

**Option B: Supabase CLI**
```bash
supabase db push
```

### 2. Verify Migrations

```sql
-- Check RPC function exists
SELECT proname FROM pg_proc WHERE proname = 'remove_team_member';

-- Check FK constraints
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('job_assignments', 'jobs', 'hazards')
  AND tc.constraint_type = 'FOREIGN KEY';
```

### 3. Environment Variables

Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in:
- Vercel environment variables (production)
- `.env.local` (local development)

---

## Testing

### Team Member Removal

1. **Remove member with no assignments** ✅
   - Should succeed immediately
   - Member archived, removed from team list

2. **Remove member with active assignments** ✅
   - Should reassign to owner/admin automatically
   - Or unassign if no owner/admin available
   - Member archived successfully

3. **Remove last owner** ✅
   - Should show error: "cannot remove last owner"
   - Prevents organization lockout

4. **Remove yourself** ✅
   - Should show error: "cannot remove yourself"
   - Prevents accidental self-removal

### Account Deactivation

1. **Deactivate regular member** ✅
   - User archived in database
   - Auth user deleted
   - Logged out automatically

2. **Deactivate last owner** ✅
   - Should show error: "Cannot deactivate the last owner"
   - Prevents organization lockout

---

## Error Messages

The RPC function returns specific error messages:
- `"not authorized: only owners and admins can remove team members"`
- `"cannot remove yourself: ask another owner or admin to remove you"`
- `"member not found or already removed"`
- `"only owners can remove other owners"`
- `"cannot remove last owner: transfer ownership or add another owner first"`

These are now shown to users instead of generic "API request failed".

---

## Security Notes

1. **SECURITY DEFINER**: RPC function runs with elevated privileges but validates authorization internally
2. **Admin Client**: Only used server-side, never exposed to browser
3. **Soft Delete**: Members are archived, not hard-deleted (preserves audit trail)
4. **FK Constraints**: Set to `ON DELETE SET NULL` to preserve data integrity

---

## Files Changed

- ✅ `supabase/migrations/20241225000000_add_remove_team_member_rpc.sql` (new)
- ✅ `supabase/migrations/20241225000001_fix_fk_constraints_for_deletion.sql` (new)
- ✅ `lib/supabase/admin.ts` (new)
- ✅ `app/api/team/member/[id]/route.ts` (updated)
- ✅ `app/api/account/deactivate/route.ts` (updated)

---

**Status:** ✅ Ready for deployment after migrations are applied

