# Production Deployment: Railway + Next.js + GitHub

**Complete deployment guide for RiskMate production**

---

## 🎯 Deployment Architecture

```
GitHub (main branch)
    ↓ (auto-deploy)
Railway (Backend API) → api.riskmate.dev
    ↓
Vercel (Next.js Web) → riskmate.dev + www.riskmate.dev
    ↓
Supabase (Database + Auth + Realtime)
```

---

## 📋 Prerequisites

- [ ] Railway account (railway.app)
- [ ] Vercel account (vercel.com)
- [ ] GitHub repository (riskmate)
- [ ] Domain: `riskmate.dev` (DNS access)
- [ ] Supabase project (production)

---

## 🚂 Step 1: Railway Backend Deployment

### 1.1 Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your `riskmate` repository
5. Select the repository

### 1.2 Create Backend Service

1. Click "New Service"
2. Select "GitHub Repo" → Choose `riskmate`
3. **Root Directory**: `apps/backend`
4. **Build Command**: `pnpm install && pnpm build`
5. **Start Command**: `pnpm start`

### 1.3 Configure Environment Variables

In Railway → Service → Variables, add:

```bash
# Node
NODE_ENV=production
PORT=8080

# Supabase (use production keys)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Backend URL (will be set after domain)
BACKEND_URL=https://api.riskmate.dev

# CORS (web domains)
CORS_ORIGINS=https://riskmate.dev,https://www.riskmate.dev

# Auth (if you use JWT secrets)
JWT_SECRET=your-jwt-secret

# Disable dev auth in production
DEV_AUTH_SECRET=

# Any other secrets you use
```

### 1.4 Set Custom Domain

1. Railway → Service → Settings → Domains
2. Click "Generate Domain" (or "Custom Domain")
3. Add: `api.riskmate.dev`
4. Copy the CNAME record Railway provides

### 1.5 Configure DNS

In your DNS provider (where you bought `riskmate.dev`):

```
Type: CNAME
Name: api
Value: [Railway-provided-domain].up.railway.app
TTL: 3600
```

Wait for DNS propagation (5-30 minutes).

### 1.6 Verify Backend

```bash
# Test health endpoint
curl https://api.riskmate.dev/health

# Should return: {"status":"ok"}
```

---

## 🌐 Step 2: Vercel Web Deployment

### 2.1 Import Project

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import from GitHub → Select `riskmate`
4. **Root Directory**: `apps/web` (or wherever Next.js is)
5. **Framework Preset**: Next.js (auto-detected)

### 2.2 Configure Build Settings

**Build Command**: `pnpm install && pnpm build`  
**Output Directory**: `.next` (default)  
**Install Command**: `pnpm install`

### 2.3 Configure Environment Variables

In Vercel → Project → Settings → Environment Variables:

```bash
# Supabase (same as backend, but anon key only)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API URL
NEXT_PUBLIC_API_URL=https://api.riskmate.dev

# Node
NODE_ENV=production

# Any other Next.js env vars
```

### 2.4 Set Custom Domains

1. Vercel → Project → Settings → Domains
2. Add: `riskmate.dev`
3. Add: `www.riskmate.dev`
4. Vercel will show DNS records

### 2.5 Configure DNS

In your DNS provider:

```
# Apex domain (riskmate.dev)
Type: A
Name: @
Value: 76.76.21.21 (Vercel IP - check Vercel dashboard for current IP)
TTL: 3600

# OR use CNAME flattening if supported:
Type: CNAME
Name: @
Value: cname.vercel-dns.com
TTL: 3600

# www subdomain
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

### 2.6 Set Canonical Redirect

In Vercel → Project → Settings → Domains:
- Set `riskmate.dev` as primary
- `www.riskmate.dev` will auto-redirect to `riskmate.dev`

Or in `next.config.js`:

```javascript
async redirects() {
  return [
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'www.riskmate.dev' }],
      destination: 'https://riskmate.dev/:path*',
      permanent: true,
    },
  ];
}
```

### 2.7 Verify Web

```bash
# Test web app
curl https://riskmate.dev

# Should return HTML
```

---

## 🔐 Step 3: Security Hardening

### 3.1 Supabase RLS Verification

```sql
-- Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('jobs', 'documents', 'realtime_events', 'audit_logs');

-- All should show rowsecurity = true
```

### 3.2 CORS Verification

Test from browser console:

```javascript
fetch('https://api.riskmate.dev/api/jobs', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
.then(r => r.json())
.then(console.log);
```

Should work from `riskmate.dev` origin.

### 3.3 Service Role Key Security

✅ **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to:
- Client-side code
- GitHub (use secrets)
- Public env vars

✅ **Only** use in:
- Railway backend env vars
- Server-side API routes (if any)

---

## 🔄 Step 4: GitHub Actions (Auto-Deploy)

### 4.1 Railway Auto-Deploy

Railway auto-deploys on push to `main` branch (if connected via GitHub).

**Verify**:
1. Railway → Service → Settings → Source
2. Should show: "Connected to GitHub"
3. Branch: `main`
4. Auto-deploy: Enabled

### 4.2 Vercel Auto-Deploy

Vercel auto-deploys on push to `main` branch (if imported from GitHub).

**Verify**:
1. Vercel → Project → Settings → Git
2. Should show: "Connected to GitHub"
3. Production Branch: `main`
4. Auto-deploy: Enabled

### 4.3 GitHub Actions (Optional - for CI/CD)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test
      # Railway and Vercel handle deployment automatically
```

---

## ✅ Step 5: Production Verification Checklist

### Backend (Railway)

- [ ] Health endpoint: `GET https://api.riskmate.dev/health` → 200
- [ ] Jobs list: `GET https://api.riskmate.dev/api/jobs` → 200 (with auth)
- [ ] CORS: Request from `riskmate.dev` → allowed
- [ ] Read-only enforcement: Auditor role → 403 on writes
- [ ] Realtime events: Backend emits events → visible in DB

### Web (Vercel)

- [ ] Homepage: `https://riskmate.dev` → loads
- [ ] Auth: Login → redirects correctly
- [ ] API calls: All go to `https://api.riskmate.dev`
- [ ] Realtime: `useRealtimeEvents()` → subscribed
- [ ] Redirect: `www.riskmate.dev` → redirects to `riskmate.dev`

### Database (Supabase)

- [ ] RLS: Enabled on all tables
- [ ] Realtime: Enabled on `realtime_events`
- [ ] Storage: Policies locked (no public listing)
- [ ] Retention: Cleanup function scheduled

### End-to-End Tests

- [ ] Create job on web → iOS updates instantly
- [ ] Upload evidence on iOS → web updates instantly
- [ ] Background iOS → foreground → catch-up refresh works
- [ ] Switch org → old subscription dies, new one starts

---

## 📊 Step 6: Monitoring Setup

### 6.1 Railway Logs

Railway → Service → Deployments → View Logs

**Watch for**:
- Startup errors
- Rate limit warnings
- Realtime event emission failures

### 6.2 Vercel Analytics

Vercel → Project → Analytics

**Watch for**:
- Page load times
- API route errors
- Build failures

### 6.3 Supabase Observability

```sql
-- Check event pipeline health
SELECT * FROM realtime_events_hourly_stats 
WHERE hour >= NOW() - INTERVAL '1 hour'
ORDER BY hour DESC;

-- Check deduplication (rate limiting)
SELECT * FROM realtime_events_dedupe_stats 
WHERE hour >= NOW() - INTERVAL '1 hour'
ORDER BY hour DESC;
```

---

## 🚨 Step 7: Rollback Plan

### Railway Rollback

1. Railway → Service → Deployments
2. Find previous working deployment
3. Click "Redeploy"

### Vercel Rollback

1. Vercel → Project → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

---

## 🔧 Step 8: Post-Deployment Tasks

### 8.1 Schedule Retention Cleanup

In Supabase SQL Editor:

```sql
-- Schedule daily cleanup at 2 AM
SELECT cron.schedule(
  'cleanup-realtime-events',
  '0 2 * * *',
  $$SELECT cleanup_old_realtime_events()$$
);
```

### 8.2 Enable HSTS (After Stable)

In Vercel → Project → Settings → Security:
- Enable "Force HTTPS"
- Enable "HSTS" (after confirming everything works)

### 8.3 Set Up Error Tracking (Optional)

- Sentry
- LogRocket
- Or Railway/Vercel built-in error tracking

---

## 📝 Environment Variables Reference

### Railway (Backend)

```bash
NODE_ENV=production
PORT=8080
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
BACKEND_URL=https://api.riskmate.dev
CORS_ORIGINS=https://riskmate.dev,https://www.riskmate.dev
```

### Vercel (Web)

```bash
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_API_URL=https://api.riskmate.dev
```

---

## 🎯 Final Checklist

- [ ] Railway backend deployed → `api.riskmate.dev` works
- [ ] Vercel web deployed → `riskmate.dev` works
- [ ] DNS configured (api + www redirect)
- [ ] Environment variables set (both platforms)
- [ ] CORS configured correctly
- [ ] RLS verified on Supabase
- [ ] Realtime enabled on `realtime_events`
- [ ] End-to-end test: web ↔ iOS updates work
- [ ] Retention cleanup scheduled
- [ ] Monitoring/logging set up
- [ ] Rollback plan documented

---

**You're production-ready. Deploy with confidence.** 🚀
