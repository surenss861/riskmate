# Production Deployment - Execution Checklist

**Follow this exact order. Don't skip steps.**

---

## ✅ Step 1: Database Migrations (DO THIS FIRST)

### 1.1 Run Migrations

```bash
supabase db push
```

**Expected output**: Both migrations applied successfully.

### 1.2 Sanity Check in Supabase Dashboard

**Go to**: Supabase Dashboard → Database → Tables

**Verify**:
- [ ] `realtime_events` table exists
- [ ] RLS is enabled (should show lock icon)
- [ ] Columns: `id`, `organization_id`, `event_type`, `entity_type`, `entity_id`, `payload`, `dedupe_key`, `created_at`, `created_by`

**Go to**: Supabase Dashboard → Database → Realtime

**Verify**:
- [ ] `realtime_events` table is listed and enabled

**Go to**: Supabase Dashboard → SQL Editor

**Run**:
```sql
-- Check views exist
SELECT * FROM realtime_events_hourly_stats LIMIT 1;
SELECT * FROM realtime_events_dedupe_stats LIMIT 1;
SELECT * FROM realtime_events_cleanup_stats LIMIT 1;
```

**Verify**:
- [ ] All three views return results (even if empty)
- [ ] No errors

---

## 🚂 Step 2: Railway Backend Deployment

### 2.1 Create/Verify Service

1. Go to [railway.app](https://railway.app)
2. Create new project or select existing
3. Add service → "Deploy from GitHub repo"
4. Select `riskmate` repository
5. **Root Directory**: `apps/backend`
6. **Build Command**: `pnpm install && pnpm build`
7. **Start Command**: `pnpm start`

### 2.2 Set Environment Variables

**Railway → Service → Variables → Add**:

```bash
NODE_ENV=production
PORT=8080

# Supabase (PRODUCTION keys)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Backend URL (set after domain is configured)
BACKEND_URL=https://api.riskmate.dev

# CORS (both web domains)
CORS_ORIGINS=https://riskmate.dev,https://www.riskmate.dev

# Disable dev auth
DEV_AUTH_SECRET=

# Any other secrets you use
```

### 2.3 Configure Custom Domain

1. Railway → Service → Settings → Domains
2. Click "Custom Domain"
3. Enter: `api.riskmate.dev`
4. Copy the CNAME record shown

### 2.4 Configure DNS

**In your DNS provider** (where you bought `riskmate.dev`):

```
Type: CNAME
Name: api
Value: [Railway-provided-domain].up.railway.app
TTL: 3600
```

**Wait 5-30 minutes for DNS propagation.**

### 2.5 Verify Backend Health

**After DNS propagates**:

```bash
# Health check
curl https://api.riskmate.dev/health

# Expected: {"status":"ok"}
```

**If you have a version endpoint**:

```bash
curl https://api.riskmate.dev/__version

# Expected: commit hash or build info
```

**Verify**:
- [ ] Health endpoint returns 200
- [ ] SSL is green (HTTPS works)
- [ ] No CORS errors in browser console

---

## 🌐 Step 3: Vercel Web Deployment

### 3.1 Import Project

1. Go to [vercel.com](https://vercel.com)
2. "Add New" → "Project"
3. Import from GitHub → Select `riskmate`
4. **Root Directory**: `apps/web` (or wherever Next.js is)
5. **Framework**: Next.js (auto-detected)

### 3.2 Set Environment Variables

**Vercel → Project → Settings → Environment Variables**:

```bash
NODE_ENV=production

# Supabase (public keys only)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key

# Backend API
NEXT_PUBLIC_API_URL=https://api.riskmate.dev
```

### 3.3 Configure Custom Domains

1. Vercel → Project → Settings → Domains
2. Add: `riskmate.dev`
3. Add: `www.riskmate.dev`
4. Vercel will show DNS records

### 3.4 Configure DNS

**In your DNS provider**:

**Option A: Apex domain (riskmate.dev)**
```
Type: A
Name: @
Value: 76.76.21.21 (check Vercel dashboard for current IP)
TTL: 3600
```

**Option B: CNAME flattening (if supported)**
```
Type: CNAME
Name: @
Value: cname.vercel-dns.com
TTL: 3600
```

**www subdomain**:
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

### 3.5 Set Canonical Redirect

**Choose ONE** (recommended: apex is canonical):

**Option 1: www → apex** (recommended)
- In Vercel, set `riskmate.dev` as primary
- `www.riskmate.dev` auto-redirects

**Option 2: apex → www**
- In `next.config.js`:
```javascript
async redirects() {
  return [
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'riskmate.dev' }],
      destination: 'https://www.riskmate.dev/:path*',
      permanent: true,
    },
  ];
}
```

### 3.6 Verify Web Deployment

**After DNS propagates**:

```bash
# Homepage loads
curl -I https://riskmate.dev

# Expected: 200 OK

# www redirects
curl -I https://www.riskmate.dev

# Expected: 301 redirect to https://riskmate.dev (if apex is canonical)
```

**Verify**:
- [ ] Both domains resolve
- [ ] SSL is green (HTTPS works)
- [ ] Redirect works correctly
- [ ] Homepage loads without errors

---

## 🔒 Step 4: DNS + SSL Verification

### 4.1 SSL Certificate Check

**Check all domains**:
- [ ] `https://riskmate.dev` → Green lock ✅
- [ ] `https://www.riskmate.dev` → Green lock ✅
- [ ] `https://api.riskmate.dev` → Green lock ✅

**Tool**: [SSL Labs](https://www.ssllabs.com/ssltest/) (optional, for deep check)

### 4.2 CORS Verification

**Open browser console on `riskmate.dev`**:

```javascript
// Test API call
fetch('https://api.riskmate.dev/api/jobs', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Verify**:
- [ ] No CORS errors
- [ ] Request succeeds (if authenticated)
- [ ] Response headers include `Access-Control-Allow-Origin: https://riskmate.dev`

**Test from www**:
- [ ] Same test from `www.riskmate.dev` → No CORS errors

---

## 🧪 Step 5: Smoke Tests (Ruthless)

### 5.1 Setup Observability Dashboard

**In Supabase SQL Editor**, keep this query open:

```sql
-- Watch events in real-time
SELECT 
    event_type,
    entity_type,
    entity_id,
    dedupe_key,
    created_at
FROM realtime_events
WHERE created_at >= NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 50;
```

**Open in another tab**:

```sql
-- Watch dedupe stats
SELECT * FROM realtime_events_dedupe_stats
WHERE hour >= NOW() - INTERVAL '1 hour'
ORDER BY hour DESC;
```

### 5.2 Test 1: Web → iOS Update

**Steps**:
1. Open iOS app (logged in)
2. Stay on jobs list
3. Create job on web (`riskmate.dev`)
4. Watch Supabase query → Should see `job.created` event
5. iOS should update within 1 second (no pull-to-refresh)

**Verify**:
- [ ] Event appears in `realtime_events` table
- [ ] iOS jobs list updates automatically
- [ ] No errors in iOS logs

### 5.3 Test 2: iOS → Web Update

**Steps**:
1. Open web job detail page (logged in)
2. Upload evidence on iOS app
3. Watch Supabase query → Should see `evidence.uploaded` event
4. Web job detail should update (evidence count)

**Verify**:
- [ ] Event appears in `realtime_events` table
- [ ] Web job detail updates automatically
- [ ] No errors in browser console

### 5.4 Test 3: Web → iOS Update (Job Status)

**Steps**:
1. Open iOS job detail (logged in)
2. Update job status on web
3. Watch Supabase query → Should see `job.updated` event
4. iOS job detail should refresh

**Verify**:
- [ ] Event appears in `realtime_events` table
- [ ] iOS job detail updates
- [ ] No errors

### 5.5 Test 4: Catch-Up Refresh

**Steps**:
1. Open iOS app (logged in)
2. Background the app (home button)
3. Create 3-5 jobs on web (while iOS is backgrounded)
4. Wait 2-5 minutes
5. Foreground iOS app
6. Watch iOS logs → Should see catch-up refresh

**Verify**:
- [ ] iOS unsubscribed on background (check logs)
- [ ] iOS resubscribed on foreground (check logs)
- [ ] All new jobs appear in iOS list (catch-up worked)
- [ ] No duplicate jobs

### 5.6 Test 5: Storm Control (Rate Limiting)

**Steps**:
1. Open Supabase dedupe stats query
2. Rapidly update the same job 20-50 times (script or manual)
3. Watch backend logs → Should see rate limit warnings
4. Watch Supabase query → Should see `dedupe_key` values
5. Check dedupe stats → Should show dedupe percentage > 0

**Verify**:
- [ ] Backend logs show: `[RealtimeEvents] Rate limit exceeded for org, using dedupe`
- [ ] Events have `dedupe_key` set
- [ ] Clients don't melt down (iOS/web still responsive)
- [ ] Dedupe stats show coalescing happening

---

## 📊 Step 6: Post-Launch Monitoring (First 24 Hours)

### 6.1 Hour 1 Check

**Supabase SQL Editor**:

```sql
-- Event volume sanity check
SELECT 
    DATE_TRUNC('hour', created_at) AS hour,
    COUNT(*) AS total_events,
    COUNT(DISTINCT organization_id) AS orgs_active
FROM realtime_events
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY hour
ORDER BY hour DESC;
```

**Verify**:
- [ ] Event volume is reasonable (< 1000/hour per org)
- [ ] No errors in Railway/Vercel logs

### 6.2 Hour 6 Check

**Check deduplication**:

```sql
SELECT * FROM realtime_events_dedupe_stats
WHERE hour >= NOW() - INTERVAL '6 hours'
ORDER BY hour DESC;
```

**Verify**:
- [ ] Dedupe percentage is > 0 (rate limiting is working)
- [ ] No orgs hitting 100% dedupe (that would indicate a problem)

### 6.3 Hour 24 Check

**Full observability review**:

```sql
-- Hourly stats
SELECT * FROM realtime_events_hourly_stats
WHERE hour >= NOW() - INTERVAL '24 hours'
ORDER BY hour DESC;

-- Dedupe stats
SELECT * FROM realtime_events_dedupe_stats
WHERE hour >= NOW() - INTERVAL '24 hours'
ORDER BY hour DESC;

-- Cleanup stats
SELECT * FROM realtime_events_cleanup_stats
WHERE day >= NOW() - INTERVAL '7 days'
ORDER BY day DESC;
```

**Verify**:
- [ ] Event pipeline is healthy
- [ ] Rate limiting is working (dedupe stats show activity)
- [ ] Cleanup is scheduled (or run manually: `SELECT cleanup_old_realtime_events();`)

---

## 🚨 Troubleshooting

### Backend Health Check Fails

**Check**:
- Railway logs for startup errors
- Environment variables are set correctly
- DNS has propagated (`dig api.riskmate.dev`)

### Web Not Loading

**Check**:
- Vercel deployment succeeded
- DNS has propagated
- Environment variables are set
- Build logs for errors

### Realtime Events Not Appearing

**Check**:
- Backend logs: `[RealtimeEvents] ✅ Emitted`
- Supabase Realtime is enabled on `realtime_events` table
- RLS policies allow reads for your org

### iOS Not Receiving Events

**Check**:
- iOS logs: `[RealtimeEventService] ✅ Subscribed`
- Organization ID is correct
- Supabase anon key is correct
- Network connectivity

### Web Not Receiving Events

**Check**:
- Browser console: `[RealtimeEvents] ✅ Subscribed`
- `useRealtimeEvents()` hook is mounted
- Organization ID is fetched correctly
- SWR cache invalidation is working

---

## ✅ Go/No-Go Decision

**GO if**:
- ✅ All smoke tests pass
- ✅ Observability views show healthy pipeline
- ✅ No critical errors in logs
- ✅ SSL is green on all domains
- ✅ CORS is configured correctly

**NO-GO if**:
- ❌ Health endpoints fail
- ❌ Realtime events not emitting
- ❌ Clients not receiving events
- ❌ Rate limiting not working
- ❌ Critical errors in logs

---

**Follow this checklist in order. Don't skip steps.** 🚀
