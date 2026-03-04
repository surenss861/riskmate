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

✅ **WEBHOOK_SECRET_ENCRYPTION_KEY** (Required in production when webhook worker is enabled)
- Used in: `src/workers/webhookDelivery.ts`
- Required for: Decrypting webhook endpoint secrets; without it, webhook delivery is degraded or fails
- **In production** the backend will **exit(1) on boot** if this is missing (unless `DISABLE_WEBHOOK_WORKER=true`)
- Format: Strong 32+ character random string; **keep the same value on web app and backend** (Railway + Vercel)
- Generate once and store in both places

⚠️ **INTERNAL_API_KEY** (Recommended)
- Used in: webhook worker wake-up from Next.js
- If not set: Worker still runs on poll interval; Next.js cannot wake it after enqueue (log warning at boot)
- Set same value on backend (Railway) and web (Vercel) for reliable delivery

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

### Startup sanity check (optional, prod)
- **HEALTHCHECK_ORG_ID** - Used in `src/index.ts` for the post-listen analytics RPC sanity check
- If set (must be a valid UUID), the sanity check calls `get_hazard_frequency_buckets` with this org id so the function is validated against real org-scoped data
- If not set, the check uses a dummy UUID `00000000-0000-0000-0000-000000000000`
- **Impact**: With a real org id, schema/RLS issues that only appear for real orgs are caught at boot; optional

## Railway-Specific (Auto-injected, don't set manually)

- **PORT** - Railway injects this automatically
- **RAILWAY_GIT_COMMIT_SHA** - Railway injects (for version endpoint)
- **RAILWAY_DEPLOYMENT_ID** - Railway injects (for version endpoint)
- **HOST** - Railway may inject (not currently used)

## Production hardening (so prod doesn't randomly break)

1. **Startup checks** (in code)
   - In **production**, the backend **exits with code 1** if required env is missing: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and (when webhook worker enabled) `WEBHOOK_SECRET_ENCRYPTION_KEY`.
   - After listen, it calls the analytics RPC `get_hazard_frequency_buckets` once; if the error indicates a **schema mismatch** (e.g. "column does not exist"), it **exits(1)** with a message to run migrations. If **HEALTHCHECK_ORG_ID** is set (valid UUID), that org id is used; otherwise a dummy UUID is used.

2. **Apply hazard-frequency migration in Supabase**
   - The dashboard analytics 500 on `/api/analytics/hazard-frequency` is fixed only after you **apply** the migration in the **same Supabase project** the backend uses.
   - Migration: `supabase/migrations/20260348000000_hazard_frequency_from_hazards_table.sql`
   - Apply via: **Supabase Dashboard → SQL Editor** (paste and run), or `supabase link` + `supabase db push`.
   - Verify: In SQL editor, run `select * from public.get_hazard_frequency_buckets('...'::uuid, now() - interval '30 days', now(), now() - interval '60 days', now() - interval '30 days', 'type') limit 10;` (use a real org id). Should return rows or empty set, not an error.

3. **Dependency health**
   - **GET /health** – always 200, no DB check.
   - **GET /healthz** – 200 if Supabase is reachable, **503** if not (use for k8s/Railway readiness probes).

## Current Status Check

Run this in Railway to verify all required vars are set:

```bash
# Check required vars
echo "SUPABASE_URL: ${SUPABASE_URL:+SET}"
echo "SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:+SET}"
echo "WEBHOOK_SECRET_ENCRYPTION_KEY: ${WEBHOOK_SECRET_ENCRYPTION_KEY:+SET}"
echo "INTERNAL_API_KEY: ${INTERNAL_API_KEY:+SET}"
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
