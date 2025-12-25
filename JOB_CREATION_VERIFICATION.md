# Job Creation Verification Checklist

## Status: ✅ Code Complete - Commit `06da731`

**Latest Commit:** `06da731` - "fix: Correct indentation in logFeatureUsage call"

---

## Step 1: Confirm Production Deployment

### A) Verify Vercel Deployment
- [ ] Go to Vercel Dashboard → Deployments
- [ ] Confirm Production deployment shows commit `06da731` (or newer)
- [ ] Verify deployment status is "Ready" (not "Building" or "Failed")
- [ ] Hard refresh the app (Cmd+Shift+R / Ctrl+Shift+R)

### B) Verify Code is Live
- [ ] Visit `/operations/jobs/new`
- [ ] Open DevTools → Network tab
- [ ] Verify no build errors in console

---

## Step 2: Validate Happy Path (Job Creation Success)

### A) Create a Basic Job
1. [ ] Navigate to `/operations/jobs/new`
2. [ ] Fill in required fields:
   - Client Name: "Test Client"
   - Client Type: "Residential"
   - Job Type: "Repair"
   - Location: "123 Test St"
3. [ ] Click "Create Job & Calculate Risk"
4. [ ] **Expected Result:**
   - Status: `201 Created`
   - Response includes `{ data: { id: "...", ... } }`
   - Redirects to `/operations/jobs/[id]` or shows success message

### B) Verify Job Appears in List
1. [ ] Navigate to `/operations/jobs`
2. [ ] Verify the newly created job appears in the list
3. [ ] Verify job details are visible (client name, job type, location)

### C) Verify Job Detail Page
1. [ ] Click on the newly created job
2. [ ] Navigate to `/operations/jobs/[id]`
3. [ ] Verify job details load correctly
4. [ ] Verify all fields are displayed

---

## Step 3: Validate RLS Edge Case (.maybeSingle() Behavior)

### Test Scenario: Job Created But SELECT Blocked

**Setup:**
- Create a job successfully
- If RLS blocks SELECT after INSERT, you should see graceful handling

**Expected Behavior:**
1. [ ] Create job → API returns `201 Created`
2. [ ] Response includes:
   ```json
   {
     "message": "Job created successfully, but could not retrieve it. This may be due to row-level security policies.",
     "code": "CREATED_BUT_UNREADABLE",
     "warning": "Job may have been created but is not immediately accessible. Check the jobs list to verify."
   }
   ```
3. [ ] **Do NOT see:** Generic "Failed to create job" or 500 error
4. [ ] Navigate to `/operations/jobs` list
5. [ ] If SELECT policy allows → job should appear in list
6. [ ] If job doesn't appear → this is a SELECT policy issue, not a job creation issue

**Note:** This scenario validates that `.maybeSingle()` prevents crashes when RLS blocks SELECT.

---

## Step 4: Validate Error Classifications

### A) Invalid Enum Value
1. [ ] Try to create job with invalid `client_type` (e.g., "InvalidType")
2. [ ] **Expected Result:**
   - Status: `400 Bad Request`
   - Message: `Invalid client_type: "InvalidType". Must be one of: residential, commercial, industrial, government, mixed`

### B) Missing Required Field
1. [ ] Try to create job without `client_name`
2. [ ] **Expected Result:**
   - Status: `400 Bad Request`
   - Message: `Missing required fields: client_name, client_type, job_type, location`

### C) Invalid Template Reference (if template_id is sent)
1. [ ] Send a request with non-existent `applied_template_id`
2. [ ] **Expected Result:**
   - Status: `400 Bad Request`
   - Message: `Template not found or does not belong to your organization.`

### D) Permission Denied (Not a Member)
1. [ ] If possible, test with a user who is not a member
2. [ ] **Expected Result:**
   - Status: `403 Forbidden`
   - Message: `Permission denied: You are not an active member of this organization.`

### E) Schema Cache / Column Error
1. [ ] If you see a `PGRST204` error mentioning "schema cache" or "column"
2. [ ] **Expected Result:**
   - Status: `400 Bad Request`
   - Message includes: `PostgREST schema cache error` or `Invalid column in request`

---

## Step 5: Check Server Logs (Vercel Functions)

### A) Verify Logging Works
1. [ ] Go to Vercel Dashboard → Your Project → Functions → Logs
2. [ ] Filter by Function: `/api/jobs`
3. [ ] Create a job
4. [ ] Verify logs show:
   - `[jobs] insert keys: [array of column names]`
   - `[jobs] request body keys: [array of keys from request]`

### B) Check for Errors
1. [ ] Review logs for any unexpected errors
2. [ ] Verify error messages are specific (not generic "Failed to create job")
3. [ ] If you see errors, note:
   - Status code
   - Error message
   - Error code (if present)

---

## Step 6: Validate Payload Filtering

### A) Check What Gets Sent vs What Gets Inserted
1. [ ] Create a job
2. [ ] Check Vercel logs for:
   - `[jobs] request body keys:` - shows what client sent
   - `[jobs] insert keys:` - shows what actually gets inserted
3. [ ] Verify:
   - `insert keys` only includes valid columns from allowlist
   - No `applied_template_id` or `applied_template_type` in insert keys (these columns don't exist)

---

## Success Criteria

✅ Job creation succeeds and returns 201 with job data
✅ Jobs appear in list after creation
✅ Job detail pages load correctly
✅ RLS blocking is handled gracefully (no 500 errors)
✅ Error messages are specific and actionable
✅ Invalid columns are filtered out before insert
✅ No generic "Failed to create job" errors (unless it's a truly unexpected error)

---

## Troubleshooting

### If job creation still fails with 500/403:

1. **Check Vercel logs** for the actual error message
2. **Check Network tab** in DevTools:
   - Status code
   - Response body JSON
   - Request payload
3. **Verify RLS policies** if you see permission errors
4. **Check database schema** if you see column errors

### If job is created but not visible:

- This is likely a SELECT policy issue, not a creation issue
- Check RLS policies on the `jobs` table for SELECT operations
- Verify `get_user_organization_id()` returns the correct value

### If you see schema cache errors:

- Run `NOTIFY pgrst, 'reload schema';` in Supabase SQL Editor
- Wait 10-30 seconds
- Retry job creation

---

## Next Steps After Verification

If all checks pass:
1. Document any edge cases discovered
2. Consider adding template tracking columns if needed (apply migration first)
3. Monitor for any RLS policy improvements needed

**Commit Verified:** `06da731` includes all fixes:
- ✅ Column allowlist filtering
- ✅ `.maybeSingle()` instead of `.single()`
- ✅ Minimal `.select('id')` to reduce schema cache issues
- ✅ Graceful handling of "created but unreadable" scenario
- ✅ Proper error classification (PGRST204 vs PGRST116)

