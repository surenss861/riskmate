# Checkout System Rollout Workflow

**Step-by-step rollout that won't bite you**

---

## ✅ Phase 1: Migration & Verification (Do First)

### Step 1: Apply Migration

```bash
supabase db push
```

### Step 2: Verify RLS Policies

Run in Supabase SQL Editor:

**Test 1: Non-admin read attempt (should fail)**
```sql
-- Simulate non-admin user query (RLS should block)
-- This is what happens when a member tries to read billing_alerts
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO '<non-admin-user-id>';

-- Should return empty (RLS blocks)
SELECT COUNT(*) FROM billing_alerts;
SELECT COUNT(*) FROM reconciliation_logs;
```

**Test 2: Admin read attempt (should pass)**
```sql
-- Simulate admin user query (RLS should allow)
SET LOCAL request.jwt.claim.sub TO '<admin-user-id>';

-- Should return data (RLS allows)
SELECT COUNT(*) FROM billing_alerts;
SELECT COUNT(*) FROM reconciliation_logs;
```

**Expected**: ✅ Non-admin gets empty, admin gets data

---

## ✅ Phase 2: Admin Detection Consistency

### Verify Same Logic Used Everywhere

Check these files use `isAdminOrOwner()` from `lib/utils/adminAuth.ts`:
- [ ] `app/api/admin/billing-alerts/route.ts`
- [ ] `app/api/admin/billing-alerts/[id]/resolve/route.ts`
- [ ] `app/api/admin/billing-alerts/reconcile/route.ts`
- [ ] `components/dashboard/BillingAlertsPanel.tsx` (if it checks role client-side)

**Expected**: ✅ All use same helper function

---

## ✅ Phase 3: API Endpoint Testing

### Test Admin Access

**Test 1: Non-admin user**
```bash
# Get token for non-admin user
TOKEN="<non-admin-jwt-token>"

# Should return 403
curl -X GET https://riskmate.dev/api/admin/billing-alerts \
  -H "Authorization: Bearer $TOKEN"
```

**Test 2: Admin user**
```bash
# Get token for admin user
TOKEN="<admin-jwt-token>"

# Should return 200 with alerts
curl -X GET https://riskmate.dev/api/admin/billing-alerts \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: ✅ Non-admin gets 403, admin gets 200

---

## ✅ Phase 4: Cron Setup

### Option A: Vercel Cron (Recommended)

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/subscriptions/reconcile",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/admin/billing-alerts/monitor",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Important**: Vercel cron includes `x-vercel-cron: 1` header. Update reconcile endpoint to accept this OR use `RECONCILE_SECRET` in cron config.

### Option B: External Cron Service

**Reconcile Cron**:
- URL: `https://riskmate.dev/api/subscriptions/reconcile`
- Method: POST
- Headers: `Authorization: Bearer ${RECONCILE_SECRET}`
- Schedule: `0 * * * *` (hourly)

**Monitor Cron**:
- URL: `https://riskmate.dev/api/admin/billing-alerts/monitor`
- Method: POST
- Headers: `Authorization: Bearer ${RECONCILE_SECRET}`
- Schedule: `0 * * * *` (hourly)

---

## ✅ Phase 5: Monitoring Setup

### Check Monitoring Conditions

After cron runs, verify:

1. **Reconcile Stale Check**:
   - If no reconcile in 2 hours → creates `reconcile_stale` alert
   - Check: `SELECT * FROM billing_alerts WHERE alert_type = 'reconcile_stale'`

2. **High Severity Stale Check**:
   - If critical/high alerts unresolved for 30+ mins → creates `high_severity_stale` alert
   - Check: `SELECT * FROM billing_alerts WHERE alert_type = 'high_severity_stale'`

3. **Auto-Resolution**:
   - Drift alerts auto-resolve if mismatch_count becomes 0
   - Check: `SELECT * FROM billing_alerts WHERE resolved = true AND resolved_by IS NULL`

---

## ✅ Phase 6: Production Smoke Tests

**Run in this exact order** (catches permissions first):

### Test 1: Admin Access / 403 Checks
- [ ] Non-admin → `/api/admin/billing-alerts` → 403
- [ ] Admin → `/api/admin/billing-alerts` → 200
- [ ] Non-admin → resolve alert → 403
- [ ] Admin → resolve alert → 200

### Test 2: RLS Checks
- [ ] Non-admin query `billing_alerts` → empty
- [ ] Admin query `billing_alerts` → data
- [ ] Non-admin query `reconciliation_logs` → empty
- [ ] Admin query `reconciliation_logs` → data

### Test 3: Checkout Idempotency
- [ ] Double-click "Start Pro" → only 1 Stripe session
- [ ] Verify idempotency key in backend logs

### Test 4: Webhook Delay Simulation
- [ ] Complete checkout → disable webhook → verify "Processing" state
- [ ] Re-enable webhook → verify resolves

### Test 5: Drift Detection + Reconcile
- [ ] Simulate drift (delete subscription row)
- [ ] Trigger reconcile → verify:
  - Creates missing subscription
  - Writes to `reconciliation_logs`
  - Creates `billing_alerts` row
  - Shows in dashboard

---

## ✅ Phase 7: Dashboard Integration

### Add BillingAlertsPanel to Dashboard

In your main dashboard page (`app/operations/page.tsx` or similar):

```tsx
import { BillingAlertsPanel } from '@/components/dashboard/BillingAlertsPanel'

// In your dashboard JSX, add:
<BillingAlertsPanel />
```

**Expected**: ✅ Alerts visible to admins only

---

## 🚨 Critical Verification Checklist

Before considering rollout complete:

- [ ] Migration applied (`supabase db push`)
- [ ] RLS policies verified (non-admin blocked, admin allowed)
- [ ] Admin detection consistent (all use `isAdminOrOwner()`)
- [ ] API endpoints return 403 for non-admins
- [ ] Cron jobs configured (hourly)
- [ ] Monitoring conditions checked
- [ ] All 5 smoke tests pass
- [ ] Dashboard shows alerts (admin only)
- [ ] "Reconcile Now" button works (admin only)
- [ ] Service role key never in client bundle

---

## 📊 Success Criteria

- ✅ Zero privacy holes (admin-only reads)
- ✅ Zero unauthorized access (403 for non-admins)
- ✅ Cron runs hourly (check `reconciliation_logs`)
- ✅ Monitoring alerts created when conditions met
- ✅ Auto-resolution works (drift alerts resolve when fixed)
- ✅ Dashboard visible to admins only

---

**Status**: ✅ Ready for production rollout after all phases complete
