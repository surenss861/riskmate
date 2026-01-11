# Railway Backend Deployment Guide

## Quick Setup

This guide covers deploying the RiskMate backend (`apps/backend`) to Railway.

## Architecture

- **Frontend**: Next.js on Vercel (`riskmate.dev`)
- **Backend**: Express.js on Railway (`api.riskmate.dev` or Railway URL)
- **Proxy**: Next.js API routes proxy to backend via `BACKEND_URL`

## Railway Configuration

### Option A: pnpm Commands (Recommended First Try)

**Service Settings:**
- **Root Directory**: `apps/backend` (leave empty/blank - Railway will use repo root)
- **Install Command**: `pnpm install --frozen-lockfile`
- **Build Command**: `pnpm -C apps/backend build`
- **Start Command**: `pnpm -C apps/backend start`

**Note**: If Railway doesn't support custom install command, set **Root Directory** to repository root (leave blank) and use the build/start commands above.

### Option B: Dockerfile (Guaranteed Fix for Cache Issues)

**Service Settings:**
- **Builder**: `Dockerfile`
- **Dockerfile Path**: `apps/backend/Dockerfile`
- **Root Directory**: Leave empty (Dockerfile handles context)

This bypasses Railway's build cache and is the most reliable option if Option A fails.

## Required Environment Variables

Set these in Railway → Service → Variables:

### Required for Boot
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)
- `STRIPE_SECRET_KEY` - Stripe API secret (if used on startup)

### Optional (but recommended)
- `ALLOWED_ORIGINS` - Comma-separated list: `https://riskmate.dev,https://riskmate.vercel.app`
- `FRONTEND_URL` - Frontend URL for CORS (alternative to ALLOWED_ORIGINS)

### Don't Set These
- `PORT` - Railway injects this automatically (your code reads `process.env.PORT`)
- `BACKEND_URL` - This belongs in **Vercel**, not Railway (Railway hosts the backend, Vercel needs to know where it is)

## Health Check

The backend exposes a health endpoint:

```bash
GET /health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T..."
}
```

Test it after deployment:
```bash
curl https://your-backend.up.railway.app/health
```

## Custom Domain Setup (Optional)

1. **Railway**: Service → Settings → Domains → Add `api.riskmate.dev`
2. **DNS Provider**: Add CNAME record:
   - **Name/Host**: `api`
   - **Target/Value**: (Railway provides this)
3. **Wait**: Railway provisions SSL automatically (usually 1-5 minutes)
4. **Update Vercel**: Change `BACKEND_URL` to `https://api.riskmate.dev` and redeploy

## Vercel Configuration

After Railway backend is deployed:

1. **Vercel** → Project → Settings → Environment Variables
2. Set `BACKEND_URL`:
   - Temporary: `https://your-backend.up.railway.app`
   - Final: `https://api.riskmate.dev` (after custom domain)
3. **Remove/fix** `NEXT_PUBLIC_BACKEND_URL`:
   - Currently: `http://localhost:5173` ❌
   - Should be: `https://api.riskmate.dev` (or delete if not needed)
4. **Redeploy** Vercel (env vars only apply to new deployments)

## Troubleshooting

### Build Cache Errors

If you see `Error: ENOENT: no such file or directory, scandir '/.../node_modules/.pnpm'`:

**Option 1**: Clear build cache
- Railway → Service → Settings → Clear Build Cache → Redeploy

**Option 2**: Use Dockerfile (permanent fix)
- Switch builder to `Dockerfile` (see Option B above)
- Redeploy

### CORS Errors

If frontend can't reach backend:

1. Check `ALLOWED_ORIGINS` in Railway includes your frontend domain
2. Backend already allows Vercel domains (`.vercel.app`, `.vercel.com`) automatically
3. For custom domain, add it to `ALLOWED_ORIGINS`

### Port Errors

- Railway sets `PORT` automatically - don't set it manually
- Backend code reads `process.env.PORT || 5173` (5173 is dev fallback only)

## Verification Checklist

After deployment:

- [ ] Backend health check works: `GET /health` returns `{ status: "ok" }`
- [ ] Railway service URL is accessible
- [ ] Vercel `BACKEND_URL` is set to Railway URL (or custom domain)
- [ ] `NEXT_PUBLIC_BACKEND_URL` is fixed/removed (no localhost)
- [ ] Vercel redeployed with new env vars
- [ ] Proof pack export works (or shows real backend error with Error ID)

## Next Steps

1. Deploy backend on Railway (Option A or B)
2. Test `/health` endpoint
3. Set Vercel `BACKEND_URL` → Railway URL
4. Fix `NEXT_PUBLIC_BACKEND_URL` (remove localhost)
5. Redeploy Vercel
6. Test proof pack export
7. (Optional) Add custom domain `api.riskmate.dev`
8. Update Vercel `BACKEND_URL` to custom domain
9. Redeploy Vercel again

