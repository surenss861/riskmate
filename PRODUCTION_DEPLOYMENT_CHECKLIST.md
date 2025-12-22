# Production Deployment Checklist

## Pre-Deployment Verification ✅

### 1. Code Quality Checks (COMPLETED)
- ✅ `pnpm lint` - All passing (only pre-existing warnings in unrelated files)
- ✅ `pnpm type-check` - All TypeScript checks passing
- ✅ `pnpm build` - Build successful, readiness page bundled correctly

### 2. Database Migrations (REQUIRED BEFORE DEPLOY)

**Critical migrations to apply:**

```bash
# Option 1: Using Supabase CLI
supabase migration up

# Option 2: Manual application in Supabase SQL Editor
# Run these in order:
```

1. **20250124000000_add_idempotency_keys_table.sql**
   - Creates `idempotency_keys` table with unique constraints
   - Required for preventing duplicate readiness resolutions
   - **Without this: 500 errors on readiness/resolve endpoints**

2. **20250124000001_add_idempotency_cleanup_job.sql**
   - Creates cleanup function for expired idempotency keys
   - Optional: Schedule with pg_cron (see migration comments)
   - **Without this: idempotency table grows unbounded**

3. **20250123000000_recategorize_audit_events.sql** (if not already applied)
   - Recategorizes audit events for ledger consistency
   - **Check if already applied in your Supabase dashboard**

**Verification Query:**
```sql
-- Check if idempotency_keys table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'idempotency_keys'
);

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'idempotency_keys';
```

### 3. Environment Variables (Verify in Vercel Dashboard)

**Required for readiness endpoints:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for backend operations
- `DATABASE_URL` - Direct database connection (if using)
- `NODE_ENV` - Should be `production` in Vercel

**Optional but recommended:**
- Set up pg_cron extension if you want automatic cleanup:
  ```sql
  SELECT cron.schedule('cleanup-idempotency-keys', '0 2 * * *', 'SELECT cleanup_expired_idempotency_keys();');
  ```

## Post-Deployment Smoke Test

### A) Readiness Page Load Test

**URL:** `https://riskmate.vercel.app/operations/audit/readiness`

**Checklist:**
1. ✅ Page loads without errors
2. ✅ Summary cards show counts (Audit-Ready Score, Total Items, etc.)
3. ✅ Category tabs show counts (Evidence, Controls, Attestations, etc.)
4. ✅ Filters update URL query params when changed
5. ✅ Sorting works (Severity, Oldest First, Risk Score)
6. ✅ No console errors or warnings
7. ✅ Fix Queue sidebar opens/closes correctly

### B) Single Resolve Test (Idempotency Proof)

**Steps:**
1. Click "Resolve" on a readiness item (Evidence or Attestation)
2. Fill out the modal and submit
3. **Verify:**
   - ✅ Toast notification appears: "Resolved — readiness updated"
   - ✅ Item is optimistically removed from list
   - ✅ Score updates after background refetch
   - ✅ Request ID is visible in dev mode toast

4. **Idempotency test (double-click/retry):**
   - Submit the same request again (reload page, find same item, or use same idempotency key)
   - **Verify:**
     - ✅ No duplicate ledger entries
     - ✅ Response is replayed (in dev mode: "Response replayed from cache")
     - ✅ Status code is 200 (not 409 or error)

**Check Compliance Ledger:**
```sql
SELECT * FROM audit_logs 
WHERE event_name = 'readiness.resolved' 
ORDER BY created_at DESC 
LIMIT 5;
```
- Should see exactly ONE entry per resolution (not duplicates)

### C) Bulk Resolve Test

**Steps:**
1. Select 3-5 items in Fix Queue
2. Click "Bulk Resolve"
3. **Verify:**
   - ✅ Toast appears with success count
   - ✅ Succeeded items removed from queue and list
   - ✅ If failures exist: Bulk Result Modal shows failure details
   - ✅ Failed items remain selected in queue

**Check Ledger:**
```sql
SELECT * FROM audit_logs 
WHERE event_name = 'readiness.bulk_resolved' 
ORDER BY created_at DESC 
LIMIT 1;
```
- Should see summary metadata with successful/failed counts

### D) Permission Test (Executive Read-Only)

**Steps:**
1. Log in as Executive role
2. Try to resolve a readiness item
3. **Verify:**
   - ✅ 403 Forbidden response
   - ✅ Toast shows error message
   - ✅ Ledger entry created: `auth.role_violation` event

**Check Ledger:**
```sql
SELECT * FROM audit_logs 
WHERE event_name = 'auth.role_violation' 
AND metadata->>'target_type' = 'readiness_item'
ORDER BY created_at DESC 
LIMIT 1;
```

### E) Error Handling Test

**Test invalid requests:**
1. Submit resolve with invalid `readiness_item_id`
   - ✅ Should return 404 with clear error message
   - ✅ Error includes `requestId` in response

2. Submit bulk resolve with >100 items
   - ✅ Should return 400 with `BULK_LIMIT_EXCEEDED` code
   - ✅ Error message explains limit

3. Submit resolve with missing required payload fields
   - ✅ Should return 400 with specific validation error
   - ✅ Error code indicates which field is missing

## Production Verification Queries

### Verify Idempotency Keys are Being Stored

```sql
SELECT 
  organization_id,
  endpoint,
  COUNT(*) as key_count,
  MAX(created_at) as latest_key
FROM idempotency_keys
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY organization_id, endpoint
ORDER BY latest_key DESC;
```

### Verify Readiness Resolutions in Ledger

```sql
SELECT 
  event_name,
  metadata->>'rule_code' as rule_code,
  metadata->>'action_type' as action_type,
  metadata->>'readiness_item_id' as item_id,
  created_at
FROM audit_logs
WHERE event_name IN ('readiness.resolved', 'readiness.bulk_resolved')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Verify No Duplicate Resolutions (Idempotency Working)

```sql
-- This should return 0 rows if idempotency is working correctly
SELECT 
  idempotency_key,
  organization_id,
  endpoint,
  COUNT(*) as duplicate_count
FROM idempotency_keys
WHERE endpoint = '/api/audit/readiness/resolve'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY idempotency_key, organization_id, endpoint
HAVING COUNT(*) > 1;
```

## Rollback Plan

If issues are detected:

1. **Code rollback:** Revert the last commit in Vercel
2. **Database rollback:** Migrations can be rolled back if needed (use Supabase CLI)
3. **Idempotency keys:** Table can be truncated if corrupted (keys are short-lived anyway)

## Known Issues / Future Improvements

- Consider adding "Recent Remediations" panel (last 10 readiness.* events)
- Add Sentry integration with requestId tagging for error tracking
- Consider adding rate limiting for bulk resolve endpoints
- Monitor idempotency_keys table growth and adjust cleanup schedule if needed

