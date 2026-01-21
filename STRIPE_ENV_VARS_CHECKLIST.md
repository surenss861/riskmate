# Stripe Environment Variables Checklist

**⚠️ DO NOT COMMIT THIS FILE WITH ACTUAL VALUES**

This is a checklist to ensure all Stripe environment variables are set in Railway.

---

## 🔐 Required Environment Variables (Railway)

### Stripe API Keys

**In Railway → Backend Service → Variables**, add:

```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
```

**Note**: 
- Use `sk_test_...` for test mode
- Use `sk_live_...` for production
- Never commit to git

### Stripe Webhook Secret

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Note**:
- Get this from Stripe Dashboard → Webhooks → Your endpoint → Signing secret
- Different secrets for test vs production webhooks
- Never commit to git

---

## 📋 Product IDs (Used in Code)

These are referenced in your subscription code but don't need to be env vars:

- **Business**: `prod_TpczVi0pxfQhfH`
- **Pro**: `prod_TpcyAbLnS5VDz7`
- **Starter**: `prod_TpcwqnpnlA9keA`

**Note**: These are safe to commit (they're public product IDs)

---

## ✅ Verification Steps

### 1. Check Railway Env Vars

Railway → Backend Service → Variables should have:

- [ ] `STRIPE_SECRET_KEY` (starts with `sk_test_` or `sk_live_`)
- [ ] `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)

### 2. Test Webhook

1. Go to Stripe Dashboard → Webhooks
2. Click your endpoint
3. Click "Send test webhook"
4. Check Railway logs → Should see webhook received

### 3. Test Subscription Flow

1. Create test subscription in your app
2. Complete checkout
3. Check database → Subscription should be created
4. Check Railway logs → Webhook should be processed

---

## 🚨 Security Reminders

- ✅ **Never commit** Stripe keys/secrets to git
- ✅ **Never share** keys/secrets in chat (delete after use)
- ✅ **Rotate keys** if accidentally exposed
- ✅ **Use test keys** for development
- ✅ **Use live keys** only in production Railway

---

## 🔄 Switching Between Test and Production

### Test Mode
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_test_...` (from test webhook endpoint)

### Production Mode
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_live_...` (from production webhook endpoint)

**Important**: Create separate webhook endpoints in Stripe for test vs production, or use the same endpoint with different secrets.

---

**Keep this checklist, but never commit actual values.** 🔒
