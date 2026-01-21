# Production Smoke Tests

**Fast + brutal tests to verify checkout system works in production**

---

## ✅ Test 1: Double-Click Idempotency

### Steps:
1. [ ] Navigate to `/pricing` in incognito
2. [ ] Log in with test account
3. [ ] Rapidly double-click "Start Pro →" button (within 100ms)
4. [ ] Check browser network tab: should see only ONE `POST /api/subscriptions/checkout` request
5. [ ] Check Stripe dashboard: should see only ONE checkout session created
6. [ ] Verify both requests have same `idempotency_key` (check backend logs)
7. [ ] Complete the single checkout session
8. [ ] Verify subscription activates correctly (no duplicate charges)

**Expected Result**: ✅ Only one Stripe session created, idempotency prevents duplicates

**Failure Mode**: If two sessions created → idempotency broken

---

## ✅ Test 2: Webhook Delay Handling

### Steps:
1. [ ] Complete a checkout (Pro or Business)
2. [ ] On thank-you page, immediately check status
3. [ ] **Simulate webhook delay** (one of these):
   - Option A: Temporarily disable webhook endpoint in Stripe dashboard
   - Option B: Block webhook delivery (firewall/network)
   - Option C: Just wait and observe (webhooks can be delayed naturally)
4. [ ] Verify thank-you page shows "Processing your payment..." state
5. [ ] Verify auto-retry happens every 3 seconds (check console/network tab)
6. [ ] Verify retry stops after 3 attempts (maxRetries = 3)
7. [ ] **Re-enable webhook** (or wait for natural delivery)
8. [ ] Verify subscription eventually activates
9. [ ] Verify thank-you page updates to "Pro Plan Activated" (or Business)
10. [ ] Verify auto-redirect to `/operations` works

**Expected Result**: ✅ Handles webhook delays gracefully, never shows false error, eventually succeeds

**Failure Mode**: If page shows error before webhook arrives, or never resolves → retry logic broken

---

## ✅ Test 3: Reconcile Drift Detection

### Steps:
1. [ ] **Simulate drift**: Manually delete a subscription row from `subscriptions` table (for a test org)
2. [ ] Call reconcile endpoint:
   ```bash
   curl -X POST https://riskmate.dev/api/subscriptions/reconcile \
     -H "Authorization: Bearer ${RECONCILE_SECRET}"
   ```
3. [ ] Verify reconcile:
   - Creates missing subscription (check `created_count` in response)
   - Writes to `reconciliation_logs` table
   - Creates `billing_alerts` row with `alert_type='reconcile_drift'`
4. [ ] Check dashboard: verify `BillingAlertsPanel` shows the alert
5. [ ] Verify alert has correct severity (warning for 1-10, critical for >10)
6. [ ] Mark alert as resolved via dashboard
7. [ ] Verify alert disappears from dashboard

**Expected Result**: ✅ Reconcile detects drift, creates alert, alert visible in dashboard

**Failure Mode**: If drift not detected, or alert not created, or alert not visible → monitoring broken

---

## ✅ Test 4: Admin-Only Access

### Steps:
1. [ ] Log in as **non-admin** user (member role)
2. [ ] Try to access `/api/admin/billing-alerts`
3. [ ] Verify returns 403 Forbidden
4. [ ] Try to resolve an alert: `POST /api/admin/billing-alerts/{id}/resolve`
5. [ ] Verify returns 403 Forbidden
6. [ ] Log in as **admin** user (owner or admin role)
7. [ ] Access `/api/admin/billing-alerts`
8. [ ] Verify returns 200 with alerts
9. [ ] Resolve an alert
10. [ ] Verify returns 200 success

**Expected Result**: ✅ Non-admins blocked, admins allowed

**Failure Mode**: If non-admin can access → privacy hole

---

## ✅ Test 5: Rate Limiting

### Steps:
1. [ ] Call reconcile endpoint 6 times rapidly:
   ```bash
   for i in {1..6}; do
     curl -X POST https://riskmate.dev/api/subscriptions/reconcile \
       -H "Authorization: Bearer ${RECONCILE_SECRET}"
   done
   ```
2. [ ] Verify first 5 return 200
3. [ ] Verify 6th returns 429 (rate limit exceeded)
4. [ ] Wait 1 minute
5. [ ] Call again → should return 200

**Expected Result**: ✅ Rate limiting works (5 requests/minute)

**Failure Mode**: If all 6 succeed → rate limiting broken

---

## ✅ Test 6: Service Role Key Security

### Steps:
1. [ ] Check client bundle (browser DevTools → Sources)
2. [ ] Search for `SUPABASE_SERVICE_ROLE_KEY` or `service.*role`
3. [ ] Verify **NOT found** in any client bundle
4. [ ] Check `NEXT_PUBLIC_*` env vars in Vercel
5. [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is **NOT** in `NEXT_PUBLIC_*` vars
6. [ ] Check backend code (Railway/Render)
7. [ ] Verify service role key only used server-side

**Expected Result**: ✅ Service role key never exposed to clients

**Failure Mode**: If found in client bundle → security vulnerability

---

## ✅ Test 7: RLS Policy Enforcement

### Steps:
1. [ ] Log in as **non-admin** user
2. [ ] Try to query `reconciliation_logs` directly (via Supabase client):
   ```typescript
   const { data } = await supabase
     .from('reconciliation_logs')
     .select('*')
   ```
3. [ ] Verify returns empty array (RLS blocks)
4. [ ] Try to query `billing_alerts`:
   ```typescript
   const { data } = await supabase
     .from('billing_alerts')
     .select('*')
   ```
5. [ ] Verify returns empty array (RLS blocks)
6. [ ] Log in as **admin** user
7. [ ] Query both tables again
8. [ ] Verify returns data (RLS allows)

**Expected Result**: ✅ RLS blocks non-admins, allows admins

**Failure Mode**: If non-admin can read → privacy hole

---

## 📊 Success Criteria

- [x] Double-click creates only one session (idempotency works)
- [x] Webhook delay handled gracefully (retry logic works)
- [x] Reconcile detects drift and creates alerts
- [x] Alerts visible in dashboard
- [x] Admin-only access enforced (403 for non-admins)
- [x] Rate limiting works (429 after limit)
- [x] Service role key never in client bundle
- [x] RLS blocks non-admin reads

---

**Status**: ✅ Ready for production after all tests pass
