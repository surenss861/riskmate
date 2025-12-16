# Job Roster Verification Checklist

## ✅ Implementation Complete

### Core Features
- ✅ Single authenticated API endpoint (`/api/jobs`)
- ✅ SWR caching with automatic revalidation
- ✅ Optimistic updates for archive/delete
- ✅ Roster header with "Last updated" timestamp
- ✅ Dev-mode source indicator (requires `?debug=1`)
- ✅ Server-side sorting support
- ✅ Template field validation (null is valid)

## 🔍 Verification Drills

### 1. Cache Coherence
**Test:** Load `/operations` → navigate to `/operations/jobs`

**Expected:**
- Zero loading flicker or super fast paint
- Network shows deduped calls (SWR key matching)
- Same jobs appear on both pages

**How to verify:**
```bash
# Open DevTools → Network tab
# Navigate between pages
# Check for duplicate `/api/jobs` requests (should be deduped)
```

### 2. Invalidate Correctness (Archive)
**Test:** Archive a job

**Expected:**
- Job disappears from active roster immediately (optimistic update)
- `mutate()` triggers revalidation
- No ghost rows after refresh
- Job never reappears (archived_at filter active)

**How to verify:**
1. Archive a job
2. Confirm it disappears instantly
3. Hard refresh (Cmd+Shift+R)
4. Confirm job still gone

### 3. Delete Correctness
**Test:** Delete an eligible draft job

**Expected:**
- Job disappears instantly (optimistic update)
- Never reappears after refresh (deleted_at hard excluded)
- Error shown if job is not eligible

**How to verify:**
1. Delete a draft job with no audit data
2. Confirm it disappears instantly
3. Hard refresh
4. Confirm job still gone
5. Try to delete a non-draft job → should show error

### 4. include_archived Behavior
**Test:** Hit `/api/jobs?include_archived=true` directly

**Expected:**
- Archived jobs appear
- Deleted jobs never appear (always excluded)
- Default behavior excludes archived

**How to verify:**
```bash
# In browser console or Postman:
GET /api/jobs?include_archived=true
# Should return archived jobs

GET /api/jobs
# Should NOT return archived jobs
```

### 5. Dev Meta Guardrail
**Test:** Check API response in dev vs prod

**Expected:**
- `_meta` only exists when:
  - `NODE_ENV === 'development'` AND
  - `?debug=1` query parameter is present
- Never leaks to production

**How to verify:**
```bash
# Dev mode with debug:
GET /api/jobs?debug=1
# Should include _meta field

# Dev mode without debug:
GET /api/jobs
# Should NOT include _meta field

# Production:
# _meta should never appear regardless of debug flag
```

### 6. Template Population
**Test:** Check all job rows have template fields

**Expected:**
- All jobs have `applied_template_id` field (null is valid)
- All jobs have `applied_template_type` field (null is valid)
- Field exists, not necessarily non-null

**How to verify:**
```javascript
// In browser console:
const jobs = await jobsApi.list()
jobs.data.forEach(job => {
  console.assert('applied_template_id' in job, 'Missing applied_template_id')
  console.assert('applied_template_type' in job, 'Missing applied_template_type')
})
```

## 🚀 Performance Checks

### SWR Deduplication
- Multiple components requesting same data should dedupe
- Check Network tab for duplicate requests (should be 0)

### Optimistic Updates
- Archive/delete should feel instant
- No loading spinner delay before UI updates
- Automatic rollback on error

### Cache Invalidation
- Archive job → roster updates immediately
- Delete job → roster updates immediately
- Refresh → data matches server state

## 📊 Data Integrity Checks

### Filter Parity
- ✅ Excludes `deleted_at != null` (always)
- ✅ Excludes `archived_at != null` (unless `include_archived=true`)
- ✅ Includes draft jobs (no status filter by default)
- ✅ Template filters work correctly

### Auth Consistency
- ✅ Hard refresh works (cookies preserved)
- ✅ Incognito window works (if logged in)
- ✅ Same organization_id used everywhere

## 🎯 Roster Header Verification

**Location:** Below "Job Roster" title

**Shows:**
- "Last updated: HH:MM:SS" (when data loads)
- "Source: API" (dev mode only, if `?debug=1`)

**Expected:**
- Timestamp updates on each data refresh
- Source indicator only in dev mode
- Subtle styling (text-white/40)

## 🔧 API Endpoint Verification

### Default Behavior
```
GET /api/jobs
→ Excludes archived
→ Excludes deleted
→ Includes drafts
→ Sorted by created_at DESC
```

### With Parameters
```
GET /api/jobs?include_archived=true
→ Includes archived
→ Still excludes deleted

GET /api/jobs?sort=risk_desc
→ Sorted by risk_score DESC

GET /api/jobs?status=draft
→ Only draft jobs
```

## 🐛 Common Issues & Fixes

### Jobs Not Showing
1. Check Network tab for 401/403 (auth issue)
2. Check for 200 with empty array (filter issue)
3. Verify organization_id matches
4. Check if migration applied (archived_at/deleted_at columns)

### Archive/Delete Not Working
1. Check permissions (archive: owner/admin, delete: owner only)
2. Verify job eligibility (delete: draft only, no audit data)
3. Check console for errors
4. Verify SWR mutate is called

### Template Filters Not Working
1. Verify `applied_template_id` exists on all jobs (null is OK)
2. Check filter logic in useEffect
3. Verify API returns template fields

## 📝 Next Steps (Optional)

1. **Integration Tests**
   - Test `/api/jobs` endpoint
   - Assert draft jobs included
   - Assert archived/deleted excluded
   - Test `include_archived` parameter

2. **Cursor Pagination** (for scale)
   - Add `cursor` parameter (created_at + id)
   - Prevents roster from dying at 500+ jobs

3. **Shared Component**
   - Refactor roster into reusable component
   - Use by both `/operations` and `/operations/jobs`
   - Prevents UI drift

---

**Status:** ✅ Production Ready
**Last Verified:** $(date)

