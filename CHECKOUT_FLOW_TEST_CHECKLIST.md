# Checkout Flow Test Checklist

**Complete manual test checklist for the hardened checkout flow**

---

## ✅ Pre-Test Setup

- [ ] Clear browser cache / use incognito
- [ ] Have Stripe test card ready: `4242 4242 4242 4242`
- [ ] Have test account ready (or create new one)
- [ ] Open browser DevTools → Console (to see funnel events)
- [ ] Open browser DevTools → Network tab

---

## 🧪 Test 1: Pro Plan Checkout (Happy Path)

### Steps:
1. [ ] Navigate to `/pricing` in incognito
2. [ ] Verify page loads instantly (no "Loading pricing..." stuck state)
3. [ ] Check console for `[Funnel] pricing_view` event
4. [ ] Click on Pro plan card (verify it highlights)
5. [ ] Check console for `[Funnel] plan_selected` event
6. [ ] Click "Start Pro →" button
7. [ ] Check console for:
   - `[Funnel] checkout_clicked`
   - `[Funnel] checkout_session_created`
   - `[Funnel] checkout_redirected`
8. [ ] Verify redirect to Stripe test checkout
9. [ ] Complete payment with test card
10. [ ] Verify redirect to `/pricing/thank-you?session_id=xxx`
11. [ ] Check console for `[Funnel] checkout_return_success`
12. [ ] Verify thank-you page shows "Verifying your purchase..."
13. [ ] Wait for verification (should show "Pro Plan Activated" within 3 seconds)
14. [ ] Check console for `[Funnel] subscription_activated`
15. [ ] Verify auto-redirect to `/operations` after 3 seconds
16. [ ] Check database: `subscriptions` table has new row with `status='active'`
17. [ ] Check database: `org_subscriptions` table has `plan_code='pro'`
18. [ ] In app, verify Pro entitlements work (unlimited jobs, 5 seats, etc.)

**Expected Result**: ✅ Complete flow works, all events logged, subscription active

---

## 🧪 Test 2: Business Plan Checkout

### Steps:
1. [ ] Navigate to `/pricing`
2. [ ] Click "Start Business →"
3. [ ] Complete Stripe checkout
4. [ ] Verify thank-you page shows "Business Plan Activated"
5. [ ] Verify database updated correctly
6. [ ] Test Business-only feature (e.g., generate proof pack)

**Expected Result**: ✅ Business plan activates correctly

---

## 🧪 Test 3: Double-Click Protection (Idempotency)

### Steps:
1. [ ] Navigate to `/pricing`
2. [ ] Rapidly double-click "Start Pro →" button
3. [ ] Verify only ONE Stripe checkout session is created
4. [ ] Check backend logs for idempotency key usage
5. [ ] Complete the single checkout session
6. [ ] Verify subscription activates correctly

**Expected Result**: ✅ Only one session created, no duplicate charges

---

## 🧪 Test 4: Cancel Flow

### Steps:
1. [ ] Navigate to `/pricing`
2. [ ] Click "Start Pro →"
3. [ ] On Stripe checkout page, click "Cancel" or close tab
4. [ ] Verify redirect to `/pricing/cancelled`
5. [ ] Check console for `[Funnel] checkout_return_cancel`
6. [ ] Verify no subscription created in database
7. [ ] Click "Back to Pricing" → verify it works

**Expected Result**: ✅ Cancel flow works, no subscription created

---

## 🧪 Test 5: Webhook Delay Simulation (Processing State)

### Steps:
1. [ ] Complete a checkout (Pro or Business)
2. [ ] On thank-you page, immediately check if it shows "Processing..."
3. [ ] If webhook is delayed, verify:
   - Shows "Processing your payment..." message
   - Auto-retries every 3 seconds (up to 3 times)
   - Eventually resolves to "active" or shows error
4. [ ] Manually trigger webhook (if possible) or wait for it
5. [ ] Verify subscription eventually activates

**Expected Result**: ✅ Handles webhook delays gracefully

---

## 🧪 Test 6: Missing Session ID (Edge Case)

### Steps:
1. [ ] Manually navigate to `/pricing/thank-you` (no session_id)
2. [ ] Verify page shows error or checks subscription status
3. [ ] If user has active subscription, should show success
4. [ ] If no subscription, should show helpful error message

**Expected Result**: ✅ Graceful error handling

---

## 🧪 Test 7: Plan Status Endpoint

### Steps:
1. [ ] Log in to app
2. [ ] Call `GET /api/me/plan`
3. [ ] Verify response includes:
   - `plan_code`: current plan
   - `seats`: seat limit (or null for unlimited)
   - `jobs_limit`: job limit (or null for unlimited)
   - `is_active`: boolean
   - `status`: subscription status
   - `renewal_date`: ISO date string or null
4. [ ] Verify plan_code matches database
5. [ ] Test with different plans (Starter, Pro, Business)

**Expected Result**: ✅ Endpoint returns accurate plan information

---

## 🧪 Test 8: Pricing Page from Demo

### Steps:
1. [ ] Navigate to `/pricing?from=demo`
2. [ ] Verify Business plan shows "Shown in Demo" badge
3. [ ] Verify Business plan is pre-highlighted
4. [ ] Verify page loads instantly (no Suspense delay)

**Expected Result**: ✅ Demo parameter works, no loading issues

---

## 🔍 Verification Checklist

After all tests, verify:

- [ ] **No Suspense delays**: Pricing page always renders instantly
- [ ] **Idempotency works**: Double-clicks don't create duplicate sessions
- [ ] **Funnel tracking**: All events logged in console
- [ ] **Server verification**: Thank-you page verifies from server, not client
- [ ] **Webhook resilience**: Handles delayed webhooks gracefully
- [ ] **Error handling**: All error states show helpful messages
- [ ] **Database consistency**: Subscriptions match Stripe state
- [ ] **Plan endpoint**: `/api/me/plan` returns accurate data

---

## 🐛 Common Issues to Watch For

1. **"Loading pricing..." stuck**: Should never happen (Suspense removed)
2. **Duplicate checkout sessions**: Should be prevented by idempotency
3. **Thank-you page stuck on "Verifying..."**: Check `/api/subscriptions/verify` endpoint
4. **Subscription not activating**: Check webhook logs, Stripe dashboard
5. **Plan mismatch**: Verify `org_subscriptions` and `subscriptions` tables are in sync

---

## 📊 Success Criteria

✅ All 8 tests pass  
✅ No console errors  
✅ All funnel events logged  
✅ Database state matches Stripe  
✅ User experience is smooth (no stuck states)  

---

**Last Updated**: After checkout flow hardening implementation
