# Stripe Webhook Setup Guide

**Complete guide for setting up Stripe webhooks in production**

---

## 🎯 Webhook Endpoint

**Production URL**: `https://api.riskmate.dev/api/stripe/webhook`

**Local Testing**: `http://localhost:8080/api/stripe/webhook` (using Stripe CLI)

---

## 📋 Step 1: Get Webhook Secret from Stripe

### Option A: Create New Webhook (Production)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks
2. Click **"Add endpoint"**
3. **Endpoint URL**: `https://api.riskmate.dev/api/stripe/webhook`
4. **Description**: "RiskMate Production Webhook"
5. Click **"Select events"**

### Step 2: Select Events to Listen To

**Select these events** (required for subscription management):

✅ **Checkout Events**:
- `checkout.session.completed` - When customer completes checkout

✅ **Subscription Events**:
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription updated (plan change, etc.)
- `customer.subscription.deleted` - Subscription canceled

✅ **Invoice Events**:
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed

**Click "Add events"** → **"Add endpoint"**

### Step 3: Copy Webhook Signing Secret

1. After creating the endpoint, click on it
2. Find **"Signing secret"** section
3. Click **"Reveal"** or **"Click to reveal"**
4. Copy the secret (starts with `whsec_...`)

**This is your `STRIPE_WEBHOOK_SECRET`**

---

## 🔧 Step 2: Configure Railway Environment Variable

### In Railway Dashboard

1. Go to Railway → Your Backend Service → Variables
2. Add new variable:
   ```
   Name: STRIPE_WEBHOOK_SECRET
   Value: whsec_... (paste the secret from Stripe)
   ```
3. Click **"Add"**

**Important**: 
- ✅ Never commit this secret to GitHub
- ✅ Keep it secure (only in Railway env vars)
- ✅ Different secrets for test vs production

---

## ✅ Step 3: Verify Webhook is Working

### Test in Stripe Dashboard

1. Go to Stripe Dashboard → Webhooks → Your endpoint
2. Click **"Send test webhook"**
3. Select event: `checkout.session.completed`
4. Click **"Send test webhook"**

### Check Railway Logs

1. Go to Railway → Service → Deployments → View Logs
2. Look for:
   ```
   [Stripe] ✅ Webhook received: checkout.session.completed
   ```
   or
   ```
   Stripe event evt_... already processed (idempotent)
   ```

### Verify Database

**In Supabase SQL Editor**:

```sql
-- Check webhook events are being recorded
SELECT 
    stripe_event_id,
    event_type,
    created_at,
    processed_at
FROM stripe_webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

**Should show**:
- Events being recorded
- `processed_at` timestamp (if processed successfully)

---

## 🧪 Step 4: Test with Real Subscription Flow

### Create Test Subscription

1. Go to your web app (`riskmate.dev`)
2. Sign up or upgrade plan
3. Complete Stripe checkout
4. **Watch Railway logs** → Should see webhook received
5. **Check database** → Subscription should be created/updated

### Verify Subscription Sync

**In Supabase SQL Editor**:

```sql
-- Check subscription was created
SELECT 
    organization_id,
    tier,
    status,
    stripe_subscription_id,
    stripe_customer_id,
    current_period_start,
    current_period_end
FROM subscriptions
WHERE stripe_subscription_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- Check org_subscriptions was updated
SELECT 
    organization_id,
    plan_code,
    status,
    seats_limit,
    jobs_limit_month
FROM org_subscriptions
ORDER BY updated_at DESC
LIMIT 5;
```

**Both should show**:
- Correct plan code
- Active status
- Stripe IDs populated

---

## 🔒 Step 5: Security Verification

### Verify Signature Verification is Working

**Test with invalid signature**:

```bash
# This should fail (400 error)
curl -X POST https://api.riskmate.dev/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: invalid_signature" \
  -d '{"type":"test"}'
```

**Expected**: `400 Bad Request` with "Webhook Error: ..."

**This confirms**:
- ✅ Signature verification is working
- ✅ Invalid webhooks are rejected
- ✅ Only Stripe can send valid webhooks

---

## 📊 Step 6: Monitor Webhook Health

### Stripe Dashboard

1. Go to Stripe Dashboard → Webhooks → Your endpoint
2. Check **"Recent deliveries"** tab
3. **Green checkmarks** = Success
4. **Red X** = Failed (check logs)

### Railway Logs

**Watch for**:
- ✅ `Stripe event evt_... received`
- ✅ `Stripe event evt_... already processed` (idempotent - good)
- ❌ `Stripe webhook signature verification failed` (security issue)
- ❌ `Error handling Stripe webhook` (processing error)

### Database Monitoring

**Check for stuck events**:

```sql
-- Events that were recorded but not processed
SELECT 
    stripe_event_id,
    event_type,
    created_at,
    processed_at
FROM stripe_webhook_events
WHERE processed_at IS NULL
AND created_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

**If you see stuck events**:
- Check Railway logs for errors
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check database connectivity

---

## 🚨 Troubleshooting

### Webhook Not Receiving Events

**Check**:
1. ✅ Endpoint URL is correct: `https://api.riskmate.dev/api/stripe/webhook`
2. ✅ SSL certificate is valid (green lock)
3. ✅ Railway service is running
4. ✅ `STRIPE_WEBHOOK_SECRET` is set in Railway

**Test**:
```bash
# Health check
curl https://api.riskmate.dev/health
# Should return: {"status":"ok"}
```

### Signature Verification Failing

**Check**:
1. ✅ `STRIPE_WEBHOOK_SECRET` matches the secret in Stripe Dashboard
2. ✅ No extra spaces or newlines in the secret
3. ✅ Using the correct secret (production vs test)

**Fix**:
- Copy secret again from Stripe Dashboard
- Update Railway env var
- Redeploy service

### Events Not Processing

**Check Railway logs** for:
- Database connection errors
- Missing metadata (plan_code, organization_id)
- Supabase errors

**Common issues**:
- Missing `plan_code` in checkout session metadata
- Missing `organization_id` in subscription metadata
- Database constraint violations

**Fix**:
- Ensure checkout sessions include metadata:
  ```typescript
  metadata: {
    plan_code: "pro",
    organization_id: orgId,
    user_id: userId
  }
  ```

---

## 🔄 Step 7: Test Mode vs Production

### Test Mode (Development)

**Stripe Test Mode**:
- Use test API keys (`sk_test_...`, `pk_test_...`)
- Use test webhook secret (`whsec_test_...`)
- Test webhook endpoint: `https://api.riskmate.dev/api/stripe/webhook` (same URL)

**Stripe CLI (Local Testing)**:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8080/api/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed
```

### Production Mode

**Stripe Live Mode**:
- Use live API keys (`sk_live_...`, `pk_live_...`)
- Use production webhook secret (`whsec_live_...`)
- Same endpoint URL: `https://api.riskmate.dev/api/stripe/webhook`

**Important**: 
- ✅ Use separate webhook endpoints for test vs live (or same endpoint, different secrets)
- ✅ Railway env vars should match the mode you're using
- ✅ Test thoroughly in test mode before going live

---

## 📝 Environment Variables Checklist

### Railway Backend (Required)

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for test mode)

# Webhook Secret (from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_... (from webhook endpoint settings)

# Supabase (for database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## ✅ Final Verification Checklist

- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] All 6 events selected (checkout.session.completed, subscription created/updated/deleted, invoice payment succeeded/failed)
- [ ] Webhook secret copied and added to Railway env vars
- [ ] Test webhook sent from Stripe Dashboard → Success in logs
- [ ] Real subscription flow tested → Database updated correctly
- [ ] Signature verification working (invalid signature rejected)
- [ ] Railway logs show successful webhook processing
- [ ] Database shows webhook events being recorded

---

## 🎯 Quick Reference

**Webhook URL**: `https://api.riskmate.dev/api/stripe/webhook`

**Events Handled**:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**Required Env Var**: `STRIPE_WEBHOOK_SECRET`

**Security**: Signature verification enabled (rejects invalid requests)

**Idempotency**: Built-in (duplicate events are skipped)

---

**Your webhook is production-ready once all checks pass.** ✅
