# Constraint Verification - NULL Bypass & Resolved Logic

**Sanity check for unique constraints on alert_key and run_key**

---

## ✅ Constraint Definitions

### 1. Alert Deduplication (`billing_alerts`)

```sql
CREATE UNIQUE INDEX idx_billing_alerts_key_unresolved 
ON billing_alerts(alert_key) 
WHERE alert_key IS NOT NULL AND resolved = false;
```

**Logic:**
- ✅ Only enforces uniqueness when `alert_key IS NOT NULL` AND `resolved = false`
- ✅ NULL values bypass constraint (allowed - for legacy/one-off alerts)
- ✅ Multiple resolved alerts with same key allowed (for history)
- ✅ Only one unresolved alert per key allowed

### 2. Reconcile Idempotency (`reconciliation_logs`)

```sql
CREATE UNIQUE INDEX idx_reconciliation_logs_key_running 
ON reconciliation_logs(run_key) 
WHERE run_key IS NOT NULL AND status = 'running';
```

**Logic:**
- ✅ Only enforces uniqueness when `run_key IS NOT NULL` AND `status = 'running'`
- ✅ NULL values bypass constraint (allowed - for legacy runs)
- ✅ Multiple completed runs with same key allowed (for history)
- ✅ Only one running run per key allowed

---

## 🚨 Gotcha #1: NULL Bypass

### Test Case: Can NULL values bypass the constraint?

**Expected Behavior:**
- NULL values should bypass the constraint (not checked)
- Multiple NULL values should be allowed
- This is CORRECT for legacy/one-off alerts/runs

**Test SQL:**
```sql
-- Test 1: Multiple NULL alert_key (should succeed)
INSERT INTO billing_alerts (alert_type, severity, message, alert_key, resolved)
VALUES ('test', 'info', 'Test 1', NULL, false);

INSERT INTO billing_alerts (alert_type, severity, message, alert_key, resolved)
VALUES ('test', 'info', 'Test 2', NULL, false);
-- ✅ Should succeed (NULL bypasses constraint)

-- Test 2: Multiple NULL run_key (should succeed)
INSERT INTO reconciliation_logs (run_type, lookback_hours, status, run_key)
VALUES ('test', 24, 'running', NULL);

INSERT INTO reconciliation_logs (run_type, lookback_hours, status, run_key)
VALUES ('test', 24, 'running', NULL);
-- ✅ Should succeed (NULL bypasses constraint)
```

**Verdict:** ✅ **SAFE** - NULL bypass is intentional and correct

---

## 🚨 Gotcha #2: Resolved vs Unresolved Logic

### Test Case: Does constraint correctly handle resolved vs unresolved?

**Expected Behavior:**
- Only one unresolved alert per key
- Multiple resolved alerts per key allowed
- Can create new unresolved after resolving old one

**Test SQL:**
```sql
-- Test 1: First unresolved alert (should succeed)
INSERT INTO billing_alerts (alert_type, severity, message, alert_key, resolved)
VALUES ('test', 'info', 'Test 1', 'test_key', false);
-- ✅ Should succeed

-- Test 2: Second unresolved alert with same key (should fail)
INSERT INTO billing_alerts (alert_type, severity, message, alert_key, resolved)
VALUES ('test', 'info', 'Test 2', 'test_key', false);
-- ❌ Should fail (unique constraint violation)

-- Test 3: Resolved alert with same key (should succeed)
INSERT INTO billing_alerts (alert_type, severity, message, alert_key, resolved, resolved_at)
VALUES ('test', 'info', 'Test 3', 'test_key', true, NOW());
-- ✅ Should succeed (resolved doesn't conflict)

-- Test 4: Resolve old alert, create new unresolved (should succeed)
UPDATE billing_alerts 
SET resolved = true, resolved_at = NOW() 
WHERE alert_key = 'test_key' AND resolved = false;

INSERT INTO billing_alerts (alert_type, severity, message, alert_key, resolved)
VALUES ('test', 'info', 'Test 4', 'test_key', false);
-- ✅ Should succeed (old one is resolved, new one is allowed)
```

**Verdict:** ✅ **SAFE** - Resolved/unresolved logic is correct

---

## 🚨 Gotcha #3: Running vs Completed Logic

### Test Case: Does constraint correctly handle running vs completed?

**Expected Behavior:**
- Only one running run per key
- Multiple completed runs per key allowed
- Can create new run after completing old one

**Test SQL:**
```sql
-- Test 1: First running run (should succeed)
INSERT INTO reconciliation_logs (run_type, lookback_hours, status, run_key)
VALUES ('test', 24, 'running', 'test_key');
-- ✅ Should succeed

-- Test 2: Second running run with same key (should fail)
INSERT INTO reconciliation_logs (run_type, lookback_hours, status, run_key)
VALUES ('test', 24, 'running', 'test_key');
-- ❌ Should fail (unique constraint violation)

-- Test 3: Completed run with same key (should succeed)
INSERT INTO reconciliation_logs (run_type, lookback_hours, status, run_key, completed_at)
VALUES ('test', 24, 'success', 'test_key', NOW());
-- ✅ Should succeed (completed doesn't conflict)

-- Test 4: Complete old run, create new running (should succeed)
UPDATE reconciliation_logs 
SET status = 'success', completed_at = NOW() 
WHERE run_key = 'test_key' AND status = 'running';

INSERT INTO reconciliation_logs (run_type, lookback_hours, status, run_key)
VALUES ('test', 24, 'running', 'test_key');
-- ✅ Should succeed (old one is completed, new one is allowed)
```

**Verdict:** ✅ **SAFE** - Running/completed logic is correct

---

## ✅ Final Verdict

**Both constraints are correctly designed:**

1. ✅ **NULL Bypass**: Intentional and correct - allows legacy/one-off alerts/runs
2. ✅ **Resolved Logic**: Correct - only enforces uniqueness on unresolved alerts
3. ✅ **Running Logic**: Correct - only enforces uniqueness on running runs
4. ✅ **History Preservation**: Correct - allows multiple resolved/completed entries

**No changes needed** - Constraints are production-ready.

---

## 📊 Edge Cases Covered

### Edge Case 1: Upsert with NULL key
- **Behavior**: Upsert will insert new row (NULL doesn't match)
- **Result**: ✅ Correct - allows multiple NULL keys

### Edge Case 2: Upsert with existing unresolved key
- **Behavior**: Upsert will update existing row (same key, unresolved)
- **Result**: ✅ Correct - prevents duplicates, updates existing

### Edge Case 3: Upsert with existing resolved key
- **Behavior**: Upsert will insert new row (resolved doesn't conflict)
- **Result**: ✅ Correct - allows history of resolved alerts

### Edge Case 4: Race condition (two inserts at same time)
- **Behavior**: Second insert will fail with unique constraint violation
- **Result**: ✅ Correct - prevents duplicate runs/alerts

---

**Status**: ✅ **Production-Ready**

All constraints are correctly designed with proper NULL handling and resolved/running logic. No gotchas found.
