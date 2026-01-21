# RiskMate Production Deployment - Quick Checklist

**Use this alongside `PRODUCTION_DEPLOYMENT_GUIDE.md` for step-by-step execution.**

---

## ✅ Pre-Deployment Security

- [ ] Rotate `test@riskmate.dev` password in Supabase Auth
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is NOT in client code
- [ ] Verify `DEV_AUTH_SECRET` is unset in production
- [ ] Confirm no real passwords in codebase (grep for `password`, `PASSWORD`)

---

## 🚂 Phase B: Backend (Railway)

### Setup
- [ ] Create Railway project: `riskmate-production`
- [ ] Add service: `backend-api`
- [ ] Connect GitHub repo
- [ ] Set root directory: `apps/backend`
- [ ] Set build command: `pnpm install && pnpm build`
- [ ] Set start command: `pnpm start:railway`

### Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `SUPABASE_URL=...`
- [ ] `SUPABASE_SERVICE_ROLE_KEY=...` (server-only)
- [ ] `SUPABASE_ANON_KEY=...` (if needed)
- [ ] `CORS_ORIGINS=https://riskmate.dev,https://www.riskmate.dev`
- [ ] `BACKEND_URL=https://api.riskmate.dev`
- [ ] `STRIPE_SECRET_KEY=...`
- [ ] `STRIPE_WEBHOOK_SECRET=...`
- [ ] `PORT=8080` (or Railway default)
- [ ] `DEV_AUTH_SECRET=` (unset/empty)

### Domain
- [ ] Add custom domain: `api.riskmate.dev`
- [ ] Add DNS CNAME record in DNS provider
- [ ] Wait for SSL certificate (5-10 minutes)

### Verification
- [ ] `curl https://api.riskmate.dev/health` → `200 OK`
- [ ] `curl https://api.riskmate.dev/__version` → shows production
- [ ] Authenticated read works (owner JWT)
- [ ] Write works (owner JWT) → `201 Created`
- [ ] Write blocked (auditor JWT) → `403 AUTH_ROLE_READ_ONLY`

---

## 🌐 Phase C: Web (Vercel)

### Setup
- [ ] Import GitHub repo to Vercel
- [ ] Set framework: Next.js
- [ ] Set build command: `pnpm build`
- [ ] Set install command: `pnpm install`

### Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL=...`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- [ ] `NEXT_PUBLIC_API_URL=https://api.riskmate.dev`
- [ ] `NEXT_PUBLIC_BACKEND_URL=https://api.riskmate.dev` (for legacy code)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...`
- [ ] `NODE_ENV=production`

### Domains
- [ ] Add domain: `riskmate.dev`
- [ ] Add domain: `www.riskmate.dev`
- [ ] Add DNS A record: `riskmate.dev → <vercel-ip>`
- [ ] Add DNS CNAME: `www.riskmate.dev → cname.vercel-dns.com`
- [ ] Enable redirect: `www.riskmate.dev → riskmate.dev` (301)
- [ ] Wait for SSL certificates (5-10 minutes)

### Code Updates (if needed)
- [ ] Verify all API calls use `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_BACKEND_URL`
- [ ] Remove/disable duplicate Next.js API routes (optional, see guide)
- [ ] Test login flow
- [ ] Test jobs list
- [ ] Test job creation

### Verification
- [ ] `curl -I https://www.riskmate.dev` → `301` redirect
- [ ] `curl -I https://riskmate.dev` → `200 OK`
- [ ] Login works
- [ ] API calls go to `https://api.riskmate.dev` (check Network tab)
- [ ] No CORS errors in console
- [ ] Jobs list loads
- [ ] Job creation works (owner)
- [ ] Auditor mode works (read-only)

---

## 📱 Phase D: iOS (App Store)

### Configuration
- [ ] Update `Config.swift` or `Info.plist`:
  - `API_BASE_URL = https://api.riskmate.dev`
  - `SUPABASE_URL = ...`
  - `SUPABASE_ANON_KEY = ...`
- [ ] Set Xcode Release build config values
- [ ] Verify Debug vs Release configs

### App Store Readiness
- [ ] Verify copy claims (no "blockchain", accurate offline claims)
- [ ] Test offline evidence capture
- [ ] Test upload queue status
- [ ] Test auto-upload on reconnect
- [ ] Test auditor mode (read-only)

### TestFlight
- [ ] Archive build in Xcode
- [ ] Upload to App Store Connect
- [ ] Test on device:
  - [ ] Login works
  - [ ] Jobs list loads
  - [ ] Evidence capture offline
  - [ ] Upload syncs when online
  - [ ] Ledger verification UI
  - [ ] Auditor mode blocks writes

### App Store Submission
- [ ] Create app in App Store Connect
- [ ] Set bundle ID: `riskmate.Riskmate`
- [ ] Upload screenshots (dark mode, no marketing)
- [ ] Set description (from `APP_STORE_DESCRIPTION.md`)
- [ ] Submit for review

---

## 🔍 Final Verification

### Backend
- [ ] Health check: `200 OK`
- [ ] Owner write: `201 Created`
- [ ] Auditor write: `403 AUTH_ROLE_READ_ONLY`
- [ ] CORS allows both domains

### Web
- [ ] Canonical domain loads
- [ ] www redirects (301)
- [ ] Login works
- [ ] API calls to Express (not Next.js routes)
- [ ] No CORS errors

### iOS
- [ ] Points to production API
- [ ] Offline capture works
- [ ] Upload queue works
- [ ] Auditor mode enforced

### Supabase
- [ ] RLS enabled on all tables
- [ ] Storage policies locked
- [ ] Service role key NOT in client

---

## 🚨 Common Issues

**CORS errors**: Check `CORS_ORIGINS` includes both domains

**401 Unauthorized**: Verify JWT token, check `authenticate` middleware

**403 for owner**: Check user role in database

**API calls to `/api/*`**: Update code to use `NEXT_PUBLIC_API_URL`

**www redirect doesn't work**: Check DNS CNAME, verify Vercel redirect settings

---

**Deployment complete when all checkboxes are checked.** ✅
