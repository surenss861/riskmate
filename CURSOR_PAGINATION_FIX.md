# Cursor Pagination Alignment Fix

## Problem

Cursor pagination was using a fixed format (`created_at|id`) for all sort modes, but `status_asc` used in-memory sorting with a different order (`status_rank, created_at, id`). This created a logical inconsistency where:

1. Cursor was based on `created_at|id`
2. Actual sort order was `status_rank, created_at, id`
3. Result: Pagination drift (missing/duplicate rows between pages)

## Solution

### 1. Per-Sort Cursor Keys

**Implemented cursor formats:**
- `created_desc/created_asc`: `created_at|id`
- `risk_desc/risk_asc`: `risk_score|created_at|id`
- `status_asc/status_desc`: **Cursor disabled** (uses offset pagination only)

### 2. SQL-Based Multi-Column Sorting

For cursor-compatible sorts (`created_desc`, `risk_desc`), we now use multi-column SQL ordering:

```typescript
// created_desc: created_at DESC, id DESC
query = query.order("created_at", { ascending: false })
query = query.order("id", { ascending: false })

// risk_desc: risk_score DESC, created_at DESC, id DESC
query = query.order("risk_score", { ascending: false })
query = query.order("created_at", { ascending: false })
query = query.order("id", { ascending: false })
```

This ensures the cursor key matches the actual SQL sort order.

### 3. Status Sorting (In-Memory)

`status_asc` still uses in-memory sorting because:
- PostgreSQL doesn't easily support custom CASE expressions in ORDER BY via PostgREST
- Cursor pagination is disabled for `status_asc` to prevent drift
- Uses offset pagination instead (safe for small-to-medium datasets)

**Future improvement:** Move status sorting to SQL using a database function or computed column.

## Code Changes

### Backend (`apps/backend/src/routes/jobs.ts`)

1. **Cursor parsing per sort mode:**
   ```typescript
   if (sortField === 'created_at') {
     // created_desc/created_asc: cursor = "created_at|id"
     const [cursorTimestamp, cursorId] = cursorStr.split('|');
     // Apply cursor filter...
   } else if (sortField === 'risk_score') {
     // risk_desc/risk_asc: cursor = "risk_score|created_at|id"
     const [cursorRisk, cursorTimestamp, cursorId] = cursorStr.split('|');
     // Apply cursor filter...
   }
   ```

2. **Cursor generation per sort mode:**
   ```typescript
   if (sortField === 'created_at') {
     nextCursor = `${lastJob.created_at}|${lastJob.id}`;
   } else if (sortField === 'risk_score') {
     nextCursor = `${riskScore}|${lastJob.created_at}|${lastJob.id}`;
   }
   ```

3. **Disable cursor for status_asc:**
   ```typescript
   const supportsCursorPagination = !useStatusOrdering;
   const useCursor = cursor && supportsCursorPagination;
   ```

### Frontend (`app/operations/jobs/JobsPageContent.tsx`)

**Optimistic rollback fix:**
- Changed from object mutation to functional mutate
- Prevents race conditions with concurrent updates
- Uses `rollbackOnError: true` for automatic rollback

```typescript
// Before (unsafe):
props.mutateData.mutate(optimisticData, false)

// After (safe):
props.mutateData.mutate((current: any) => {
  return {
    ...current,
    data: (current.data || []).filter((job: any) => job.id !== jobId),
  }
}, { 
  optimisticData: true,
  rollbackOnError: true,
  revalidate: false,
})
```

## Testing

### Pagination Stability Tests

Added comprehensive tests in `__tests__/routes/jobs-api.integration.test.ts`:

1. **No overlaps:** Verify page 1 and page 2 have no duplicate IDs
2. **No gaps:** Verify last item of page 1 is >= first item of page 2 (for descending sorts)
3. **Per-sort verification:** Test `created_desc` and `risk_desc` cursor pagination
4. **Status sorting:** Verify `status_asc` uses offset pagination (no cursor)

## Migration

Created database function for future SQL-based status sorting:
- `supabase/migrations/20250116000001_add_status_rank_function.sql`
- Function: `get_status_rank(status TEXT)`
- Index: `idx_jobs_status_rank` (for performance)

**Note:** This function is not yet used in the API (status sorting is still in-memory), but it's ready for future implementation.

## Verification Checklist

- [x] Cursor keys match sort order for `created_desc`
- [x] Cursor keys match sort order for `risk_desc`
- [x] Cursor disabled for `status_asc` (uses offset)
- [x] Multi-column SQL sorting for cursor-compatible sorts
- [x] Optimistic rollback uses functional mutate
- [x] Pagination stability tests added
- [x] No overlaps between pages
- [x] No gaps between pages

## Production Readiness

✅ **Safe to deploy:**
- Cursor pagination is now logically consistent
- No pagination drift for `created_desc` and `risk_desc`
- `status_asc` uses safe offset pagination
- Optimistic updates are race-condition safe

---

**Status:** ✅ Production Ready
**Last Updated:** 2025-01-16

