# Production Readiness Checklist

**Final verification before going live**

---

## ✅ Pre-Deployment

### Database
- [ ] Migration `20250126000000_add_realtime_events_table.sql` applied
- [ ] Migration `20250126000001_add_realtime_observability.sql` applied
- [ ] RLS enabled on all tables
- [ ] Realtime enabled on `realtime_events` table
- [ ] Indexes created (check with `\d realtime_events`)
- [ ] Retention cleanup scheduled (or manual daily)

### Backend (Railway)
- [ ] Service created with correct root directory (`apps/backend`)
- [ ] Build command: `pnpm install && pnpm build`
- [ ] Start command: `pnpm start`
- [ ] Environment variables set (see `PRODUCTION_DEPLOYMENT_RAILWAY_NEXTJS.md`)
- [ ] Custom domain: `api.riskmate.dev` configured
- [ ] DNS CNAME record added
- [ ] Health endpoint: `GET /health` returns 200

### Web (Vercel)
- [ ] Project imported from GitHub
- [ ] Root directory: `apps/web` (or correct path)
- [ ] Framework: Next.js (auto-detected)
- [ ] Environment variables set (see `PRODUCTION_DEPLOYMENT_RAILWAY_NEXTJS.md`)
- [ ] Custom domains: `riskmate.dev` + `www.riskmate.dev` configured
- [ ] DNS A/CNAME records added
- [ ] Canonical redirect: `www` → `riskmate.dev`

### GitHub
- [ ] Repository connected to Railway
- [ ] Repository connected to Vercel
- [ ] Auto-deploy enabled on `main` branch (both platforms)
- [ ] Secrets stored in platform env vars (not in code)

---

## 🧪 Smoke Tests

### Backend API
```bash
# Health check
curl https://api.riskmate.dev/health
# Expected: {"status":"ok"}

# Jobs list (with auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.riskmate.dev/api/jobs
# Expected: 200 with jobs array

# Read-only enforcement (auditor role)
curl -X POST -H "Authorization: Bearer AUDITOR_TOKEN" \
  https://api.riskmate.dev/api/jobs
# Expected: 403 with "AUTH_ROLE_READ_ONLY"
```

### Web App
```bash
# Homepage loads
curl https://riskmate.dev
# Expected: 200 with HTML

# www redirects
curl -I https://www.riskmate.dev
# Expected: 301 redirect to https://riskmate.dev

# API calls go to correct backend
# Check browser console: NEXT_PUBLIC_API_URL should be https://api.riskmate.dev
```

### Realtime Pipeline
1. **Web → iOS**:
   - Create job on web
   - iOS jobs list should update within 1 second (no refresh)

2. **iOS → Web**:
   - Upload evidence on iOS
   - Web job detail should update (if viewing that job)

3. **Catch-up**:
   - Background iOS app for 2-5 minutes
   - Create jobs on web during background
   - Foreground iOS → should see all new jobs (catch-up refresh)

4. **Rate limiting** (if applicable):
   - Create 100+ jobs rapidly
   - Check logs for dedupe warnings
   - Verify events coalesce correctly

---

## 🔍 Observability Verification

### Database Views
```sql
-- Check event pipeline health
SELECT * FROM realtime_events_hourly_stats 
WHERE hour >= NOW() - INTERVAL '1 hour'
ORDER BY hour DESC;

-- Check deduplication stats
SELECT * FROM realtime_events_dedupe_stats 
WHERE hour >= NOW() - INTERVAL '1 hour'
ORDER BY hour DESC;

-- Check cleanup eligibility
SELECT * FROM realtime_events_cleanup_stats 
WHERE day >= NOW() - INTERVAL '7 days'
ORDER BY day DESC;
```

### Railway Logs
- [ ] No startup errors
- [ ] Realtime events emitting: `[RealtimeEvents] ✅ Emitted`
- [ ] Rate limit warnings (if any) are expected
- [ ] No 500 errors

### Vercel Analytics
- [ ] Page load times < 2s
- [ ] No build failures
- [ ] API route errors < 1%

---

## 🛡️ Security Verification

### RLS Policies
```sql
-- Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('jobs', 'documents', 'realtime_events', 'audit_logs');
-- All should show rowsecurity = true

-- Test RLS: Try to read another org's data (should fail)
-- (Run as authenticated user, not service role)
```

### CORS
- [ ] Requests from `riskmate.dev` → `api.riskmate.dev` work
- [ ] Requests from `www.riskmate.dev` → `api.riskmate.dev` work
- [ ] Requests from other origins → blocked

### Service Role Key
- [ ] Never exposed in client code
- [ ] Only in Railway backend env vars
- [ ] Not in GitHub (use secrets)

---

## 📱 iOS Production Config

### Release Configuration
- [ ] `API_BASE_URL` = `https://api.riskmate.dev`
- [ ] `SUPABASE_URL` = Production Supabase URL
- [ ] `SUPABASE_ANON_KEY` = Production anon key
- [ ] Bundle ID matches App Store Connect
- [ ] Version number incremented

### TestFlight
- [ ] Build uploaded
- [ ] Internal testing group added
- [ ] Test realtime events on TestFlight build
- [ ] Verify catch-up refresh works

---

## 🚀 Final Steps

### 1. Schedule Retention Cleanup
```sql
-- In Supabase SQL Editor
SELECT cron.schedule(
  'cleanup-realtime-events',
  '0 2 * * *',
  $$SELECT cleanup_old_realtime_events()$$
);
```

### 2. Enable HSTS (After Stable)
- Vercel → Project → Settings → Security
- Enable "Force HTTPS"
- Enable "HSTS" (after 1 week of stability)

### 3. Set Up Monitoring Alerts
- Railway: Alert on deployment failures
- Vercel: Alert on build failures
- Supabase: Monitor event pipeline health

### 4. Document Rollback Plan
- Railway: Previous deployment → Redeploy
- Vercel: Previous deployment → Promote to Production
- Database: Migration rollback scripts (if needed)

---

## ✅ Go/No-Go Decision

**Go if**:
- ✅ All smoke tests pass
- ✅ Realtime pipeline works (web ↔ iOS)
- ✅ RLS verified
- ✅ CORS configured
- ✅ No critical errors in logs
- ✅ DNS propagated (check with `dig api.riskmate.dev`)

**No-Go if**:
- ❌ Health endpoint fails
- ❌ RLS not enforced
- ❌ Service role key exposed
- ❌ Realtime events not emitting
- ❌ CORS blocking legitimate requests

---

## 📊 Post-Launch Monitoring (First 24 Hours)

### Hour 1
- [ ] Monitor Railway logs for errors
- [ ] Monitor Vercel analytics for spikes
- [ ] Check realtime events table (should have rows)
- [ ] Verify catch-up refresh works

### Hour 6
- [ ] Check retention cleanup (if scheduled)
- [ ] Review observability views
- [ ] Verify no rate limit issues

### Hour 24
- [ ] Full observability review
- [ ] Check cleanup stats
- [ ] Verify no missed events
- [ ] Performance review

---

**You're ready to ship. Deploy with confidence.** 🚀
