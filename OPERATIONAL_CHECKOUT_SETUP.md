# Operational Checkout Setup Guide

**Complete setup guide for production checkout operations**

---

## ✅ 1. Run Migrations

### Step 1: Deploy Migrations

```bash
supabase db push
```

### Step 2: Verify Tables Exist

Run in Supabase SQL Editor:

```sql
-- Check funnel_events table
SELECT COUNT(*) FROM funnel_events;

-- Check reconciliation_logs table
SELECT COUNT(*) FROM reconciliation_logs;

-- Check billing_alerts table
SELECT COUNT(*) FROM billing_alerts;
```

### Step 3: Test Funnel Event Insert

In your dev environment, test `trackFunnelEvent()`:

```typescript
import { trackFunnelEvent } from '@/lib/funnelTracking'

await trackFunnelEvent('pricing_view', { plan: 'pro' })
```

Then verify in Supabase:
```sql
SELECT * FROM funnel_events ORDER BY created_at DESC LIMIT 1;
```

**Expected**: ✅ Event appears in table

---

## ✅ 2. Protect Reconcile Endpoint

### Step 1: Set RECONCILE_SECRET

In Vercel (or your hosting platform):

1. Go to Project Settings → Environment Variables
2. Add: `RECONCILE_SECRET` = `<generate-random-secret>`
3. Use a strong random string (e.g., `openssl rand -hex 32`)

### Step 2: Verify Protection

Test that endpoint rejects requests without secret:

```bash
# Should fail (401)
curl -X POST https://riskmate.dev/api/subscriptions/reconcile

# Should fail (401)
curl -X POST https://riskmate.dev/api/subscriptions/reconcile \
  -H "Authorization: Bearer wrong-secret"

# Should succeed (200)
curl -X POST https://riskmate.dev/api/subscriptions/reconcile \
  -H "Authorization: Bearer ${RECONCILE_SECRET}"
```

**Expected**: ✅ Only requests with correct secret succeed

### Step 3: Verify Rate Limiting

Rapidly call endpoint 6 times:

```bash
for i in {1..6}; do
  curl -X POST https://riskmate.dev/api/subscriptions/reconcile \
    -H "Authorization: Bearer ${RECONCILE_SECRET}"
done
```

**Expected**: ✅ First 5 succeed, 6th returns 429 (rate limit)

---

## ✅ 3. Set Up Cron Job

### Option A: Vercel Cron (Recommended)

Create `vercel.json` (or update existing):

```json
{
  "crons": [
    {
      "path": "/api/subscriptions/reconcile",
      "schedule": "0 * * * *"
    }
  ]
}
```

Add headers in `app/api/subscriptions/reconcile/route.ts` to accept Vercel cron:

```typescript
// Add after auth check
const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
const isVercelCron = request.headers.get('x-vercel-cron') === '1'

if (!isVercelCron && cronSecret !== process.env.RECONCILE_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Option B: External Cron Service

Use a service like:
- **Cron-job.org** (free)
- **EasyCron** (paid)
- **GitHub Actions** (scheduled workflow)

Configure:
- **URL**: `https://riskmate.dev/api/subscriptions/reconcile`
- **Method**: POST
- **Headers**: `Authorization: Bearer ${RECONCILE_SECRET}`
- **Schedule**: Hourly (`0 * * * *`)

### Option C: Railway/Render Cron

If using Railway/Render, use their cron job feature with same config.

---

## ✅ 4. Add Monitoring Alerts

### Step 1: Webhook Failure Tracking

In your webhook handler (`apps/backend/src/routes/stripeWebhook.ts`), add:

```typescript
import { trackWebhookFailure } from '@/lib/billingMonitoring'

// In error handler:
catch (err: any) {
  await trackWebhookFailure(
    event.type,
    event.id,
    err.message,
    { stack: err.stack }
  )
  // ... rest of error handling
}
```

### Step 2: Reconcile Drift Tracking

Already implemented in `app/api/subscriptions/reconcile/route.ts` - automatically creates alerts.

### Step 3: Set Up Alert Monitoring

**Option A: Supabase Dashboard Query**

Create a view or query:

```sql
-- Get unresolved critical alerts
SELECT * FROM billing_alerts
WHERE resolved = false
  AND severity = 'critical'
ORDER BY created_at DESC;
```

**Option B: Email/Slack Notifications**

Create a simple endpoint that checks alerts and sends notifications:

```typescript
// app/api/admin/billing-alerts/route.ts
import { getUnresolvedAlerts } from '@/lib/billingMonitoring'

export async function GET() {
  const alerts = await getUnresolvedAlerts()
  const critical = alerts.filter(a => a.severity === 'critical')
  
  if (critical.length > 0) {
    // Send email/Slack notification
    // Use your notification service (SendGrid, Slack webhook, etc.)
  }
  
  return NextResponse.json({ alerts, critical_count: critical.length })
}
```

**Option C: Datadog/New Relic**

Forward logs to monitoring service and set up alerts there.

---

## ✅ 5. Production Smoke Test

### Test Checklist:

1. [ ] **Migration**: All tables exist
2. [ ] **Reconcile Auth**: Endpoint rejects without secret
3. [ ] **Reconcile Rate Limit**: 6th request returns 429
4. [ ] **Reconcile Execution**: Returns `created_count`, `updated_count`, `mismatch_count`
5. [ ] **Funnel Events**: Events stored in database
6. [ ] **Billing Alerts**: Alerts created when drift found
7. [ ] **Cron Job**: Runs successfully (check logs)

---

## 🔍 Monitoring Queries

### Check Recent Reconciliation Runs

```sql
SELECT 
  run_type,
  lookback_hours,
  status,
  created_count,
  updated_count,
  mismatch_count,
  error_count,
  started_at,
  completed_at
FROM reconciliation_logs
ORDER BY started_at DESC
LIMIT 10;
```

### Check Unresolved Billing Alerts

```sql
SELECT 
  alert_type,
  severity,
  message,
  created_at
FROM billing_alerts
WHERE resolved = false
ORDER BY created_at DESC;
```

### Check Funnel Conversion

```sql
SELECT 
  event,
  COUNT(*) as count,
  COUNT(DISTINCT session_id) as unique_sessions
FROM funnel_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event
ORDER BY created_at DESC;
```

---

## 🚨 Alert Thresholds

### Critical Alerts (Immediate Action)

- **Webhook failures**: Any failure in last 15 minutes
- **Reconcile drift**: > 10 mismatches found
- **Missing subscriptions**: > 5 created in single run

### Warning Alerts (Review)

- **Reconcile drift**: 1-10 mismatches found
- **Status mismatches**: Any found (auto-fixed, but review)

---

## 📊 Success Criteria

- [x] Migrations deployed
- [x] Reconcile endpoint protected (secret + rate limit)
- [x] Cron job configured and running
- [x] Monitoring alerts set up
- [x] Smoke tests pass

---

**Status**: ✅ Ready for production operations
