# Railway Environment Variables Checklist

## Required (Backend won't boot without these)

**Note**: These are the absolute minimum. Backend will crash on startup if missing.

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

⚠️ **ALLOWED_ORIGINS** (Conditional - only if calling backend directly from browser)
- Used in: `src/index.ts` (CORS config)
- Required for: Direct browser → Railway backend calls
- Format: Comma-separated URLs: `https://riskmate.dev,https://riskmate.vercel.app`
- **Note**: If using Next.js API routes as proxy (most common), CORS may not be involved since requests are server → server
- **Test**: If frontend works through `/api/*` routes, you're probably fine
- **Only needed if**: You call Railway backend directly from browser (fetch from `https://api.riskmate.dev` in client code)

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

1. **ALLOWED_ORIGINS** - Only if calling backend directly from browser
   - **Test first**: Does your frontend work? If yes through Next.js proxy, you may not need it
   - **If needed**: `https://riskmate.dev,https://riskmate.vercel.app`
   - **Quick test**: `curl -i https://api.riskmate.dev/health -H "Origin: https://riskmate.dev"` → check for `Access-Control-Allow-Origin` header

2. **Email config** (if you need emails)
   - Either `RESEND_API_KEY` + `RESEND_FROM_EMAIL`
   - Or SMTP config

3. **Stripe** (if you need billing)
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`

## Quick Fix Commands

```bash
# Add ALLOWED_ORIGINS (only if calling backend directly from browser)
railway variables set ALLOWED_ORIGINS="https://riskmate.dev,https://riskmate.vercel.app"

# Or in Railway dashboard:
# Settings → Variables → Add:
# ALLOWED_ORIGINS = https://riskmate.dev,https://riskmate.vercel.app
```

## CORS Testing

If you're unsure whether ALLOWED_ORIGINS is needed:

```bash
# Test CORS from your laptop
curl -i https://api.riskmate.dev/health \
  -H "Origin: https://riskmate.dev"

# Look for:
# Access-Control-Allow-Origin: https://riskmate.dev
# (or Access-Control-Allow-Origin: * if not configured)

# If you see the header → CORS is working
# If you don't see it → may need ALLOWED_ORIGINS (but only if calling directly from browser)
```
