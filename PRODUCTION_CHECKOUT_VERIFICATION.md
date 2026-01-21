# Production Checkout Verification Guide

**Critical checks to ensure checkout flow is production-ready**

---

## ✅ 1. Stripe Redirect Contract Verification

### Check: `success_url` includes `{CHECKOUT_SESSION_ID}`

**Location**: `app/api/subscriptions/checkout/route.ts`

**Current Implementation**:
```typescript
success_url: success_url || `${process.env.NEXT_PUBLIC_APP_URL || 'https://riskmate.dev'}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`
```

**Verification Steps**:
1. [ ] Check `NEXT_PUBLIC_APP_URL` is set to `https://riskmate.dev` in production
2. [ ] Create a test checkout session
3. [ ] Verify Stripe redirects to: `https://riskmate.dev/pricing/thank-you?session_id=cs_test_...`
4. [ ] Confirm `session_id` parameter is present (not empty)
5. [ ] Test with `cancel_url`: should redirect to `https://riskmate.dev/pricing/cancelled`

**Expected**: ✅ `session_id` always present, domain correct

**Failure Mode**: If `session_id` missing, verification fails → user sees error

---

## ✅ 2. Webhook → DB Consistency

### Check: Webhook updates DB, `/api/me/plan` reflects immediately

**Verification Steps**:
1. [ ] Complete a test checkout
2. [ ] Check Stripe webhook logs: webhook delivered successfully
3. [ ] Check database: `subscriptions` table has new row with `status='active'`
4. [ ] Check database: `org_subscriptions` table has `plan_code` updated
5. [ ] Call `GET /api/me/plan` → should return `is_active: true`
6. [ ] Verify this happens within 5 seconds of webhook delivery

**Expected**: ✅ DB updated within seconds, plan endpoint reflects immediately

**Failure Mode**: If webhook fails, subscription stuck in "processing" state

---

## ✅ 3. DB Preference Over Stripe (Never Lock Out Customers)

### Check: System trusts DB even if Stripe is lagging

**Location**: `app/api/subscriptions/verify/route.ts`

**Current Implementation**:
- If DB has subscription → trust it (even if Stripe incomplete)
- Logs warning for billing mismatch but never blocks access
- Only shows "processing" if DB has no subscription but Stripe says paid

**Verification Steps**:
1. [ ] Manually set DB subscription to `status='active'` (simulate DB ahead of Stripe)
2. [ ] Call `/api/subscriptions/verify` with incomplete Stripe session
3. [ ] Verify returns `status: 'active'` (trusts DB)
4. [ ] Check logs: should see billing mismatch warning but not block access
5. [ ] Verify user can access features (not locked out)

**Expected**: ✅ Never locks out customer due to Stripe lag

**Failure Mode**: If system blocks access when DB says active, customer locked out

---

## ✅ 4. `/api/me/plan` as Gatekeeper

### Check: All features use `/api/me/plan` for entitlements

**Current State**:
- ✅ `lib/entitlements.ts` uses `getOrgSubscription()` (DB-first)
- ✅ Routes like `/api/jobs/[id]/permit-pack` use entitlements system
- ⚠️ Some UI components still use `subscriptionsApi.get()` (old endpoint)

**Action Items**:
1. [ ] Audit all UI components that check plan/entitlements
2. [ ] Replace `subscriptionsApi.get()` with `/api/me/plan` calls
3. [ ] Update pricing page to show "Current Plan" badge using `/api/me/plan`
4. [ ] Update dashboard to use `/api/me/plan` for feature gating
5. [ ] Remove direct Supabase queries for subscription data

**Files to Update**:
- `app/operations/page.tsx` (uses `subscriptionsApi.get()`)
- `app/operations/account/page.tsx` (uses `subscriptionsApi.get()`)
- `app/operations/account/change-plan/page.tsx` (uses `subscriptionsApi.get()`)
- Any component that checks `subscription_tier` directly

**Expected**: ✅ Single source of truth (`/api/me/plan`) used everywhere

---

## ✅ 5. Reconciliation Job

### Check: Automated reconciliation catches drift

**Location**: `app/api/subscriptions/reconcile/route.ts`

**What It Does**:
- Finds completed Stripe sessions without DB subscription
- Finds DB subscriptions that don't match Stripe status
- Finds Stripe subscriptions missing from DB

**Setup Steps**:
1. [ ] Deploy reconciliation endpoint
2. [ ] Set up cron job (Vercel Cron or external service):
   - Run daily: `POST /api/subscriptions/reconcile`
   - Or hourly for high-volume
3. [ ] Monitor logs for reconciliation issues
4. [ ] Set up alerts if issues found

**Expected**: ✅ Catches billing drift automatically

**Failure Mode**: If reconciliation not run, drift goes unnoticed

---

## ✅ 6. Funnel Events Table

### Check: Events stored in database for SQL debugging

**Location**: `supabase/migrations/20250127000000_add_funnel_events_table.sql`

**Setup Steps**:
1. [ ] Run migration: `supabase db push`
2. [ ] Verify table exists: `funnel_events`
3. [ ] Verify RLS policies enabled
4. [ ] Wire up `lib/funnelTracking.ts` in checkout flow
5. [ ] Test: complete checkout → verify events in table

**Query Examples**:
```sql
-- Get conversion funnel for last 7 days
SELECT 
  event,
  COUNT(*) as count,
  COUNT(DISTINCT session_id) as unique_sessions
FROM funnel_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event
ORDER BY created_at DESC;

-- Find failed checkouts
SELECT * FROM funnel_events
WHERE event = 'checkout_error'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**: ✅ Events stored, queryable for debugging

---

## 🧪 Production Smoke Test

### Run This Before Launch:

1. [ ] **Stripe Redirect Test**
   - Create checkout → verify `session_id` in URL
   - Complete payment → verify thank-you page works

2. [ ] **Webhook Test**
   - Complete checkout → check webhook delivered
   - Verify DB updated within 5 seconds
   - Verify `/api/me/plan` returns active

3. [ ] **Double-Click Test**
   - Rapidly double-click checkout button
   - Verify only 1 session created
   - Verify idempotency works

4. [ ] **Webhook Delay Test**
   - Complete checkout
   - Temporarily disable webhook
   - Verify thank-you shows "Processing"
   - Re-enable webhook → verify resolves

5. [ ] **DB Preference Test**
   - Set DB subscription active manually
   - Verify user not locked out even if Stripe incomplete

---

## 📊 Monitoring Checklist

### Set Up Alerts For:

- [ ] Webhook delivery failures (Stripe dashboard)
- [ ] Reconciliation job finds issues (cron logs)
- [ ] Thank-you page stuck on "Processing" (error logs)
- [ ] Missing `session_id` in thank-you URL (error logs)
- [ ] Billing mismatches (verify endpoint warnings)

---

## 🚨 Critical Failure Modes

### 1. Missing `session_id` in URL
**Symptom**: Thank-you page shows error
**Fix**: Verify `{CHECKOUT_SESSION_ID}` in `success_url`

### 2. Webhook Never Delivers
**Symptom**: Subscription stuck in "processing"
**Fix**: Manual reconciliation or retry webhook

### 3. DB and Stripe Out of Sync
**Symptom**: User locked out or has access they shouldn't
**Fix**: Run reconciliation job, fix drift manually

### 4. Idempotency Broken
**Symptom**: Duplicate charges
**Fix**: Verify idempotency key passed to Stripe correctly

---

**Status**: ✅ Ready for production verification

Run all checks above before launch, then monitor for first 24 hours.
