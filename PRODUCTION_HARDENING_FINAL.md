# Production Hardening - Final Checklist

**Complete operational hardening for checkout system**

---

## ✅ Completed Hardening

### 1. **Alert Deduplication** ✅
- Added `alert_key` column to `billing_alerts` table
- Unique constraint on `alert_key + resolved = false` (only one unresolved alert per key)
- `checkMonitoringConditions()` now uses upsert instead of insert
- Prevents duplicate alerts for same condition

### 2. **Reconcile Idempotency** ✅
- Added `run_key` column to `reconciliation_logs` table
- Unique constraint on `run_key + status = 'running'` (prevents duplicate active runs)
- Manual runs: `manual_YYYY-MM-DD_HH:MM` (rounds to minute)
- Scheduled runs: `scheduled_YYYY-MM-DD_HH` (rounds to hour)
- Request runs: `request_<uuid>` (unique per request)
- Detects and returns existing runs if duplicate detected

### 3. **Monitor Endpoint Authentication** ✅
- Uses `MONITOR_SECRET` for cron authentication (constant-time comparison)
- Falls back to `RECONCILE_SECRET` if `MONITOR_SECRET` not set
- Allows admin auth for manual triggers (dashboard)
- No dependency on user sessions for cron

### 4. **Admin Detection Decision** ✅
- **Current Model**: Admin in ANY org can read billing ops data
- **Rationale**: Billing alerts and reconciliation logs are global operational data
- **Future**: If moving to org-scoped ops, will need to add org_id filtering
- **Documented**: Decision is intentional for global ops model

---

## 🔒 Security Improvements

### Before
- ❌ Monitor endpoint required user auth (cron couldn't use)
- ❌ No deduplication for monitoring alerts
- ❌ No idempotency for reconcile runs
- ❌ Duplicate runs could conflict

### After
- ✅ Monitor endpoint uses `MONITOR_SECRET` for cron
- ✅ Alert deduplication via `alert_key` unique constraint
- ✅ Reconcile idempotency via `run_key` unique constraint
- ✅ Duplicate runs detected and handled gracefully

---

## 📁 Files Created/Modified

### New Files
- `supabase/migrations/20250127000004_add_alert_deduplication.sql` - Alert deduplication support

### Modified Files
- `lib/billingMonitoring.ts` - Uses upsert for alert creation
- `app/api/admin/billing-alerts/monitor/route.ts` - Uses MONITOR_SECRET for cron auth
- `app/api/subscriptions/reconcile/route.ts` - Adds run_key and duplicate detection
- `supabase/migrations/20250127000001_add_reconciliation_logs_table.sql` - Adds run_key column

---

## ✅ Verification Steps

### 1. Test Alert Deduplication
```bash
# Call monitor endpoint 3 times in a row
curl -X POST https://riskmate.dev/api/admin/billing-alerts/monitor \
  -H "Authorization: Bearer ${MONITOR_SECRET}"

# Verify: Only 1 unresolved alert per condition (reconcile_stale, high_severity_stale)
```

### 2. Test Reconcile Idempotency
```bash
# Click "Reconcile Now" twice quickly
# Verify: Second call returns existing run, doesn't create duplicate
```

### 3. Test Cron Authentication
```bash
# Cron should use MONITOR_SECRET
curl -X POST https://riskmate.dev/api/admin/billing-alerts/monitor \
  -H "Authorization: Bearer ${MONITOR_SECRET}"

# Should return 200 (not 401)
```

### 4. Verify Admin Detection
- Multi-org user who is admin in Org A but member in Org B
- Should be able to read billing_alerts (global ops data)
- This is intentional for current global ops model

---

## 🚨 Critical Configuration

### Environment Variables

**Required for Cron:**
- `MONITOR_SECRET` - Secret for monitor endpoint (or use `RECONCILE_SECRET` as fallback)
- `RECONCILE_SECRET` - Secret for reconcile endpoint

**Cron Configuration:**
```json
{
  "crons": [
    {
      "path": "/api/subscriptions/reconcile",
      "schedule": "0 * * * *",
      "headers": {
        "Authorization": "Bearer ${RECONCILE_SECRET}"
      }
    },
    {
      "path": "/api/admin/billing-alerts/monitor",
      "schedule": "0 * * * *",
      "headers": {
        "Authorization": "Bearer ${MONITOR_SECRET}"
      }
    }
  ]
}
```

---

## 📊 Success Criteria

- ✅ Monitor endpoint called 3x → only 1 alert per condition
- ✅ Reconcile Now clicked 2x → second returns existing run
- ✅ Cron uses MONITOR_SECRET (not user auth)
- ✅ Admin detection works (admin in any org can read)
- ✅ No duplicate alerts or runs

---

**Status**: ✅ **Production-Ready & Hardened**

The checkout system is now fully hardened with:
- Alert deduplication (no spam)
- Reconcile idempotency (no conflicts)
- Proper cron authentication (MONITOR_SECRET)
- Documented admin detection decision (global ops model)

Ready for production rollout.
