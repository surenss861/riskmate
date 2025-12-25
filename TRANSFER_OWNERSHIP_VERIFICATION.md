# Ownership Transfer & Account Deletion Verification Checklist

## Status: ✅ Code Complete, ⚠️ Migration Required

**Latest Commit:** `8623738` - "feat: Allow last owner to delete account with ownership transfer or org dissolution"

---

## Step 1: Verify Vercel Deployment

### A) Check Production Deploy
- [ ] Go to Vercel Dashboard → Deployments
- [ ] Confirm Production deployment shows commit `8623738` (or newer)
- [ ] Verify deployment status is "Ready"
- [ ] Hard refresh the app (Cmd+Shift+R / Ctrl+Shift+R)

### B) Verify Code is Live
- [ ] Visit `/operations/account` → Danger Zone section
- [ ] Check that new UI elements are present (conditional rendering based on ownership)

---

## Step 2: Apply Database Migration (REQUIRED)

### A) Run Migration in Supabase
- [ ] Go to Supabase Dashboard → SQL Editor
- [ ] Open file: `supabase/migrations/20241225000002_add_transfer_ownership_rpc.sql`
- [ ] Copy entire contents and paste into SQL Editor
- [ ] Click "Run" (or press Cmd/Ctrl + Enter)
- [ ] Verify success message: "Success. No rows returned"

### B) Verify RPC Function Exists
Run this query in SQL Editor:

```sql
SELECT 
  proname, 
  prosecdef AS is_security_definer,
  proowner::regrole AS owner_role
FROM pg_proc
WHERE proname = 'transfer_team_ownership';
```

**Expected Result:**
- ✅ 1 row returned
- ✅ `proname` = `transfer_team_ownership`
- ✅ `is_security_definer` = `true`
- ✅ `owner_role` = `supabase_admin` (or similar privileged role)

---

## Step 3: Test Scenarios

### Scenario 1: Last Owner + Other Members

**Setup:**
- Organization has 1 owner (you) + at least 1 other member (admin/member/safety_lead/executive)

**Test Steps:**
1. [ ] Navigate to `/operations/account` → Danger Zone
2. [ ] Verify UI shows: "You are the last owner. To delete your account, you must transfer ownership to another member."
3. [ ] Verify "Transfer Ownership To" dropdown appears
4. [ ] Verify dropdown lists other members (excluding yourself)
5. [ ] Try to click "Transfer Ownership & Deactivate Account" without selecting a member
   - [ ] Button should be disabled OR show error "Please select a member to transfer ownership to"
6. [ ] Select a member from dropdown
7. [ ] Type "DELETE" in confirmation field
8. [ ] Click "Transfer Ownership & Deactivate Account"
9. [ ] Confirm dialog appears with member name
10. [ ] Click OK/Confirm
11. [ ] Verify success: Redirects to `/login`
12. [ ] **Verify Ownership Transfer:** Log in as the selected member
    - [ ] Member should now have `role = 'owner'` in the organization

**Expected Behavior:**
- ✅ Cannot proceed without selecting a member
- ✅ Transfer + deactivate succeeds
- ✅ Selected user becomes Owner
- ✅ No "API request failed" errors
- ✅ Specific success message shown

---

### Scenario 2: Last Owner Alone (No Other Members)

**Setup:**
- Organization has only 1 user (you as owner)
- No other members exist

**Test Steps:**
1. [ ] Navigate to `/operations/account` → Danger Zone
2. [ ] Verify UI shows: "You are the last owner and the only member. Deleting your account will effectively dissolve this organization."
3. [ ] Verify "Transfer Ownership To" dropdown does NOT appear
4. [ ] Type "DELETE" in confirmation field
5. [ ] Click "Dissolve Organization & Deactivate Account"
6. [ ] Confirm dialog appears: "This will dissolve the organization and delete your account..."
7. [ ] Click OK/Confirm
8. [ ] Verify success: Redirects to `/login`

**Expected Behavior:**
- ✅ Dissolve messaging appears (no transfer dropdown)
- [ ] Deactivate succeeds
- ✅ Organization effectively dissolved (last user removed)
- ✅ No "API request failed" errors

---

### Scenario 3: Not Last Owner (Regular User Deletion)

**Setup:**
- Organization has multiple owners, OR
- You are admin/member/safety_lead/executive (not owner)

**Test Steps:**
1. [ ] Navigate to `/operations/account` → Danger Zone
2. [ ] Verify UI shows standard deletion message (no transfer dropdown, no dissolve message)
3. [ ] Type "DELETE" in confirmation field
4. [ ] Click "Deactivate Account"
5. [ ] Confirm dialog appears
6. [ ] Click OK/Confirm
7. [ ] Verify success: Redirects to `/login`

**Expected Behavior:**
- ✅ Standard deactivate flow works
- ✅ No transfer/dissolve UI shown
- ✅ Account deactivated successfully
- ✅ No "API request failed" errors

---

## Step 4: Error Handling Verification

### A) Test Error Cases
1. [ ] Try to delete without typing "DELETE"
   - [ ] Error: "Please type DELETE to confirm"

2. [ ] Try to transfer + delete without selecting a member (Scenario 1)
   - [ ] Error: "Please select a member to transfer ownership to"

3. [ ] Check browser console for unhandled promise rejections
   - [ ] No unhandled errors in console

### B) Check Vercel Logs
1. [ ] Go to Vercel Dashboard → Your Project → Logs
2. [ ] Filter by Function: `/api/account/deactivate`
3. [ ] Verify logs show:
   - [ ] `200` responses for successful deletions
   - [ ] `400` responses with specific error messages (not generic)
   - [ ] No `500` errors (unless testing invalid scenarios)

---

## Step 5: Database Verification

### A) Verify Transfer Actually Happened (Scenario 1)
After Scenario 1 test, verify in Supabase:

```sql
-- Check the member you transferred to is now owner
SELECT id, email, role 
FROM public.users 
WHERE organization_id = '<your-org-id>'
ORDER BY role, email;
```

**Expected:**
- ✅ Transferred member has `role = 'owner'`
- ✅ Your user has `archived_at` set (soft deleted)

---

## Troubleshooting

### If RPC function doesn't exist:
- Re-run the migration SQL in Supabase SQL Editor
- Check for syntax errors in the migration file
- Verify you're connected to the correct database

### If transfer fails:
- Check Vercel logs for specific error message
- Verify the target member exists and is active (`archived_at IS NULL`)
- Verify you are actually the owner (check `users.role`)

### If UI doesn't show transfer dropdown:
- Hard refresh the page (Cmd+Shift+R)
- Check browser console for JavaScript errors
- Verify `teamApi.get()` is returning member data
- Verify `isLastOwner` and `hasOtherMembers` state is set correctly

---

## Success Criteria

✅ All 3 scenarios tested and working
✅ Ownership transfer actually happens (Scenario 1)
✅ No "API request failed" generic errors
✅ Vercel logs show proper HTTP status codes
✅ RPC function exists and is SECURITY DEFINER
✅ Migration applied successfully

---

**Next Steps After Verification:**
1. Document any edge cases discovered
2. Update user documentation if needed
3. Consider adding audit log entry for ownership transfers (future enhancement)

