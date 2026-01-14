# Railway Environment Variables Checklist

## Required (Backend won't boot without these)

✅ **SUPABASE_URL**
- Used in: `src/lib/supabaseClient.ts`
- Required for: All database operations
- Format: `https://xxxxx.supabase.co`

✅ **SUPABASE_SERVICE_ROLE_KEY**
- Used in: `src/lib/supabaseClient.ts`
- Required for: Admin operations, bypassing RLS
- Format: Long JWT token

✅ **PORT**
- Used in: `src/index.ts`
- Required for: Server binding
- **Railway auto-injects this** - don't set manually

✅ **ALLOWED_ORIGINS**
- Used in: `src/index.ts` (CORS config)
- Required for: Frontend to call backend
- Format: Comma-separated URLs: `https://riskmate.dev,https://riskmate.vercel.app`
- **Critical**: Without this, frontend requests will be blocked by CORS

## Optional (Features work without these, but may be limited)

### Email (Resend or SMTP)
- **RESEND_API_KEY** - Used in `src/utils/email.ts`
- **RESEND_FROM_EMAIL** - Used in `src/utils/email.ts`
- **SMTP_HOST**, **SMTP_USER**, **SMTP_PASS**, **SMTP_PORT**, **SMTP_SECURE** - Fallback if Resend not configured
- **Impact**: Email notifications won't work without one of these

### Stripe (Billing)
- **STRIPE_SECRET_KEY** - Used in `src/routes/stripeWebhook.ts`, `src/routes/subscriptions.ts`
- **STRIPE_WEBHOOK_SECRET** - Used in `src/routes/stripeWebhook.ts`
- **Impact**: Billing/subscription features won't work

### Report Sharing
- **REPORT_SHARE_BASE_URL** - Used in `src/routes/reports.ts`
- **REPORT_SHARE_SECRET** - Used in `src/routes/reports.ts`
- Falls back to: `FRONTEND_URL` or `SUPABASE_SERVICE_ROLE_KEY`
- **Impact**: Report sharing links may not work correctly

### Frontend URL
- **FRONTEND_URL** - Used in `src/routes/reports.ts`
- **Impact**: Report sharing fallback URL

## Railway-Specific (Auto-injected, don't set manually)

- **PORT** - Railway injects this automatically
- **RAILWAY_GIT_COMMIT_SHA** - Railway injects (for version endpoint)
- **RAILWAY_DEPLOYMENT_ID** - Railway injects (for version endpoint)
- **HOST** - Railway may inject (not currently used)

## Current Status Check

Run this in Railway to verify all required vars are set:

```bash
# Check required vars
echo "SUPABASE_URL: ${SUPABASE_URL:+SET}"
echo "SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:+SET}"
echo "ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:+SET}"
echo "PORT: ${PORT:+SET (Railway auto-injected)}"
```

## Dockerfile vs Start Command

**Current Dockerfile:**
- Uses: `CMD ["pnpm", "-C", "apps/backend", "start"]`
- Which runs: `node dist/apps/backend/src/index.js` (compiled JS)

**Alternative (if using tsx):**
- Could use: `CMD ["pnpm", "-C", "apps/backend", "start:railway"]`
- Which runs: `tsx src/index.ts` (TypeScript directly)

**Current setup is correct** - Dockerfile builds to `dist/` and runs compiled JS.

## Missing in Railway?

Check these in Railway dashboard:

1. **ALLOWED_ORIGINS** - Most likely missing!
   - Should include: `https://riskmate.dev,https://riskmate.vercel.app`
   - Without this, CORS will block frontend requests

2. **Email config** (if you need emails)
   - Either `RESEND_API_KEY` + `RESEND_FROM_EMAIL`
   - Or SMTP config

3. **Stripe** (if you need billing)
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`

## Quick Fix Commands

```bash
# Add ALLOWED_ORIGINS (most critical)
railway variables set ALLOWED_ORIGINS="https://riskmate.dev,https://riskmate.vercel.app"

# Or in Railway dashboard:
# Settings → Variables → Add:
# ALLOWED_ORIGINS = https://riskmate.dev,https://riskmate.vercel.app
```
