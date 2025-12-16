# Final "Ship It" Verification Guide

## ✅ Implementation Complete

### Enterprise Features Added
- ✅ Deterministic status ordering
- ✅ Cursor-based pagination
- ✅ Optimistic updates with rollback
- ✅ Template field shape validation
- ✅ Integration test structure
- ✅ Dev meta guardrails

## 🔍 Step-by-Step Verification

### 1. Optimistic + Rollback Test

**Test:** Kill network (or force API to 500) and click Archive/Delete

**Expected:**
- Row disappears instantly (optimistic update)
- Then returns with error toast (rollback)
- Previous cache state restored

**How to test:**
```javascript
// In browser console, before archiving:
// Block network requests or modify jobsApi.archive to throw error
// Archive a job
// Verify: job disappears → error toast → job reappears
```

**Code verification:**
- `confirmArchive()` stores `previousData` before optimistic update
- On error, restores `previousData` then revalidates
- Same for `confirmDelete()`

### 2. Sort Correctness

**Test:** Verify sorting works correctly

**Expected:**
- `?sort=risk_desc` → risk scores strictly descending
- `?sort=created_desc` → newest first (default)
- `?sort=status_asc` → deterministic order: draft → in_progress → completed → archived

**How to test:**
```bash
# Risk descending
GET /api/jobs?sort=risk_desc
# Verify: risk_score[0] >= risk_score[1] >= risk_score[2] ...

# Created descending (default)
GET /api/jobs
# Verify: created_at[0] >= created_at[1] >= created_at[2] ...

# Status ascending (deterministic)
GET /api/jobs?sort=status_asc
# Verify: status order follows: draft → in_progress → completed → archived
```

**Status order definition:**
```typescript
const statusOrder = ['draft', 'in_progress', 'completed', 'archived', 'cancelled', 'on_hold']
```

### 3. Cache Coherence

**Test:** Visit /operations then /operations/jobs

**Expected:**
- Same dataset on both pages
- No "different page = different truth" behavior
- SWR keys match (same query params)

**How to test:**
1. Open `/operations` → note job count and IDs
2. Navigate to `/operations/jobs`
3. Verify same jobs appear
4. Check Network tab for deduped requests

**SWR key format:**
```
jobs-list-{page}-{filterStatus}-{filterRiskLevel}-{filterTemplateSource}-{filterTemplateId}
```

### 4. Dev Indicator Guardrails

**Test:** Verify _meta never leaks to production

**Expected:**
- In production: `_meta` never appears
- In dev: `_meta` appears only with `?debug=1`

**How to test:**
```bash
# Dev mode with debug
GET /api/jobs?debug=1
# Should include _meta field

# Dev mode without debug
GET /api/jobs
# Should NOT include _meta field

# Production build
NODE_ENV=production next build && next start
GET /api/jobs?debug=1
# Should NOT include _meta (even with debug flag)
```

**Code verification:**
```typescript
// Backend check (apps/backend/src/routes/jobs.ts)
...(process.env.NODE_ENV === 'development' && authReq.query.debug === '1' && {
  _meta: { ... }
})
```

### 5. Template Field Shape

**Test:** Verify all jobs have template fields

**Expected:**
- All jobs have `applied_template_id` (nullable)
- All jobs have `applied_template_type` (nullable)
- Never `undefined` (field missing)

**How to test:**
```javascript
// In browser console:
const jobs = await jobsApi.list()
jobs.data.forEach(job => {
  console.assert('applied_template_id' in job, 'Missing applied_template_id')
  console.assert('applied_template_type' in job, 'Missing applied_template_type')
  console.assert(job.applied_template_id !== undefined, 'applied_template_id is undefined')
  console.assert(job.applied_template_type !== undefined, 'applied_template_type is undefined')
})
```

**Code verification:**
- Backend: `applied_template_id: job.applied_template_id ?? null`
- Frontend: `job.applied_template_id = job.applied_template_id ?? null`

### 6. Filtering Invariants

**Test:** Verify filtering rules

**Expected:**
- Default: excludes `archived_at != null` and `deleted_at != null`
- `include_archived=true`: includes archived, still excludes deleted
- Delete action always "wins" (deleted never reappears)

**How to test:**
```bash
# Default (excludes archived and deleted)
GET /api/jobs
# Verify: no jobs with archived_at or deleted_at

# Include archived (still excludes deleted)
GET /api/jobs?include_archived=true
# Verify: may include archived_at, but never deleted_at

# Delete a job
DELETE /api/jobs/{id}
# Verify: job never reappears in any query
```

## 🚀 Cursor Pagination (Per-Sort Keys)

### Format (Per Sort Mode)
```
created_desc/created_asc: cursor = "{created_at}|{id}"
Example: "2025-01-16T10:30:00Z|550e8400-e29b-41d4-a716-446655440000"

risk_desc/risk_asc: cursor = "{risk_score}|{created_at}|{id}"
Example: "85.5|2025-01-16T10:30:00Z|550e8400-e29b-41d4-a716-446655440000"

status_asc/status_desc: DISABLED (uses offset pagination only)
Reason: In-memory sorting incompatible with cursor pagination
```

### Usage
```typescript
// First page (created_desc - cursor enabled)
const first = await jobsApi.list({ limit: 20, sort: 'created_desc' })

// Next page
if (first.pagination.cursor) {
  const second = await jobsApi.list({ 
    limit: 20, 
    sort: 'created_desc',
    cursor: first.pagination.cursor 
  })
}

// status_asc uses offset pagination (cursor disabled)
const statusPage = await jobsApi.list({ 
  limit: 20, 
  sort: 'status_asc',
  page: 2  // Uses offset, not cursor
})
```

### Benefits
- More efficient at scale (no offset calculation)
- Deterministic (no duplicate/missing rows)
- Works with large datasets (200+ jobs)
- **Cursor keys match sort order** (prevents pagination drift)

### Critical Fix
**Before:** Cursor was always `created_at|id`, but `status_asc` used in-memory sorting → pagination drift
**After:** 
- `created_desc/created_asc`: cursor = `created_at|id` ✅
- `risk_desc/risk_asc`: cursor = `risk_score|created_at|id` ✅
- `status_asc/status_desc`: cursor disabled, uses offset only ✅

## 📝 Integration Tests

**Location:** `__tests__/routes/jobs-api.integration.test.ts`

**Test Coverage:**
- ✅ Filtering invariants (excludes archived/deleted)
- ✅ Sorting correctness (risk_desc, created_desc, status_asc)
- ✅ Template field shape (never undefined)
- ✅ Cursor pagination
- ✅ Dev meta guardrails

**To run:**
```bash
# Requires test database setup
pnpm test __tests__/routes/jobs-api.integration.test.ts
```

## 🎯 Production Readiness Checklist

- [x] Optimistic updates with rollback
- [x] Deterministic status ordering
- [x] Cursor pagination support
- [x] Template fields never undefined
- [x] Dev meta guardrails (NODE_ENV + debug flag)
- [x] Filtering invariants enforced
- [x] Integration test structure
- [x] Cache coherence verified
- [x] Error handling with state restoration

## 🔧 Quick Verification Commands

```bash
# Build verification
pnpm run build

# Type check
pnpm run type-check

# Lint check
pnpm run lint

# Production build test
NODE_ENV=production pnpm run build
```

## 📊 API Endpoint Reference

### Default
```
GET /api/jobs
→ Excludes archived/deleted
→ Includes drafts
→ Sorted by created_at DESC
→ Offset pagination
```

### With Parameters
```
GET /api/jobs?include_archived=true
→ Includes archived, excludes deleted

GET /api/jobs?sort=risk_desc
→ Sorted by risk_score DESC

GET /api/jobs?sort=status_asc
→ Deterministic status order (draft → archived)

GET /api/jobs?cursor=2025-01-16T10:30:00Z|uuid
→ Cursor-based pagination

GET /api/jobs?debug=1
→ Includes _meta (dev mode only)
```

---

**Status:** ✅ Production Ready
**Last Verified:** $(date)

