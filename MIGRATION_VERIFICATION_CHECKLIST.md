# Migration Verification Checklist

**Run these checks immediately after `supabase db push`**

---

## ✅ 1. Verify Tables Exist

Run in Supabase SQL Editor:

```sql
-- Check all three tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('funnel_events', 'reconciliation_logs', 'billing_alerts')
ORDER BY table_name;
```

**Expected**: ✅ All 3 tables listed with column counts > 0

---

## ✅ 2. Verify RLS is Enabled

```sql
-- Check RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('funnel_events', 'reconciliation_logs', 'billing_alerts');
```

**Expected**: ✅ `rls_enabled = true` for all 3 tables

---

## ✅ 3. Verify RLS Policies

```sql
-- Check policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('funnel_events', 'reconciliation_logs', 'billing_alerts')
ORDER BY tablename, policyname;
```

**Expected**: ✅ Each table has:
- SELECT policy (users can read)
- INSERT policy with `WITH CHECK (false)` (blocks client inserts, service role bypasses)

---

## ✅ 4. Test Service Role Writes

**This is the critical test - service role must be able to write**

### Test 1: Funnel Events

```sql
-- This should work (service role bypasses RLS)
-- Run from your backend code or use Supabase service role key directly
INSERT INTO funnel_events (
  event,
  metadata
) VALUES (
  'test_event',
  '{"test": true}'::jsonb
) RETURNING id;
```

**Expected**: ✅ Insert succeeds, returns UUID

### Test 2: Reconciliation Logs

```sql
INSERT INTO reconciliation_logs (
  run_type,
  lookback_hours,
  status
) VALUES (
  'manual',
  24,
  'success'
) RETURNING id;
```

**Expected**: ✅ Insert succeeds

### Test 3: Billing Alerts

```sql
INSERT INTO billing_alerts (
  alert_type,
  severity,
  message
) VALUES (
  'test_alert',
  'info',
  'Test alert for verification'
) RETURNING id;
```

**Expected**: ✅ Insert succeeds

---

## ✅ 5. Test Client Reads (RLS Blocks Writes)

### Test: Client Cannot Insert

From a client (using anon key), try to insert:

```typescript
// This should FAIL (RLS blocks it)
const { error } = await supabase
  .from('funnel_events')
  .insert({ event: 'test', metadata: {} })

// error.code should be '42501' (insufficient privileges)
```

**Expected**: ✅ Insert fails with permission error

### Test: Client Can Read

```typescript
// This should SUCCEED (SELECT policy allows it)
const { data, error } = await supabase
  .from('billing_alerts')
  .select('*')
  .eq('resolved', false)
  .limit(10)
```

**Expected**: ✅ Read succeeds (if user is authenticated and has org membership)

---

## ✅ 6. Trigger Reconcile Run

### Step 1: Set RECONCILE_SECRET

In your environment:
```bash
export RECONCILE_SECRET="your-secret-here"
```

### Step 2: Call Reconcile Endpoint

```bash
curl -X POST https://riskmate.dev/api/subscriptions/reconcile \
  -H "Authorization: Bearer ${RECONCILE_SECRET}" \
  -H "Content-Type: application/json"
```

### Step 3: Verify Log Created

```sql
SELECT 
  id,
  run_type,
  lookback_hours,
  status,
  created_count,
  updated_count,
  mismatch_count,
  started_at
FROM reconciliation_logs
ORDER BY started_at DESC
LIMIT 1;
```

**Expected**: ✅ Row exists with `status = 'success'` or `'partial'`

---

## ✅ 7. Simulate Drift and Verify Alert

### Step 1: Create Test Alert

```sql
-- Manually insert a test alert
INSERT INTO billing_alerts (
  alert_type,
  severity,
  message,
  metadata
) VALUES (
  'reconcile_drift',
  'warning',
  'Test: Reconciliation found 5 mismatches',
  '{"test": true, "mismatch_count": 5}'::jsonb
) RETURNING id;
```

### Step 2: Verify Alert Appears

```sql
SELECT * FROM billing_alerts
WHERE resolved = false
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: ✅ Test alert appears in results

### Step 3: Clean Up Test Alert

```sql
DELETE FROM billing_alerts
WHERE metadata->>'test' = 'true';
```

---

## ✅ 8. Verify Indexes

```sql
-- Check indexes exist
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('funnel_events', 'reconciliation_logs', 'billing_alerts')
ORDER BY tablename, indexname;
```

**Expected**: ✅ Each table has indexes on:
- `funnel_events`: user_id, organization_id, event, session_id
- `reconciliation_logs`: started_at, status
- `billing_alerts`: alert_type, resolved, severity

---

## 🚨 Common Issues

### Issue 1: "Permission denied" on INSERT

**Cause**: RLS policy blocks inserts, but service role not being used

**Fix**: Ensure backend code uses `SUPABASE_SERVICE_ROLE_KEY`, not anon key

### Issue 2: "Table does not exist"

**Cause**: Migration didn't run or failed silently

**Fix**: Check migration logs, re-run `supabase db push`

### Issue 3: "Policy violation"

**Cause**: RLS policy too restrictive

**Fix**: Verify policies match migration SQL exactly

---

## ✅ Success Criteria

- [x] All 3 tables exist
- [x] RLS enabled on all tables
- [x] Policies exist (SELECT + INSERT with `WITH CHECK (false)`)
- [x] Service role can insert (tested)
- [x] Client cannot insert (tested)
- [x] Client can read (tested)
- [x] Reconcile run creates log entry
- [x] Alerts can be created and queried
- [x] Indexes exist

---

**Status**: ✅ Ready for production after all checks pass
