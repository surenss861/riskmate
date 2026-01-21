# RiskMate Production Deployment Guide

**Version**: 1.0  
**Last Updated**: January 2025  
**Target**: Web + iOS unified production release

---

## 🎯 Production Topology

```
┌─────────────────────────────────────────────────────────┐
│                    Production Stack                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Web (Vercel)          Backend (Railway)                │
│  ┌──────────────┐     ┌──────────────────┐            │
│  │ Next.js App  │────▶│ Express API      │            │
│  │              │     │                  │            │
│  │ riskmate.dev │     │ api.riskmate.dev │            │
│  │ www.riskmate │     │                  │            │
│  │    .dev      │     │ Single Source of │            │
│  └──────────────┘     │      Truth       │            │
│         │              └──────────────────┘            │
│         │                       │                       │
│         │                       ▼                       │
│         │              ┌──────────────────┐            │
│         │              │   Supabase       │            │
│         │              │   (PostgreSQL)   │            │
│         │              └──────────────────┘            │
│         │                       ▲                       │
│         │                       │                       │
│  ┌──────┴──────────┐            │                       │
│  │  iOS App        │────────────┘                       │
│  │  (App Store)    │                                    │
│  │  api.riskmate.dev│                                    │
│  └─────────────────┘                                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Key Principle**: Express API (`api.riskmate.dev`) is the **single source of truth** for all business logic. Web and iOS are clients.

---

## ⚠️ Critical: Next.js API Routes Decision

### Current State
Next.js has **86 API routes** in `app/api/` that duplicate Express functionality:
- `/api/jobs/*` - Job CRUD (duplicates Express `/api/jobs/*`)
- `/api/reports/*` - Report generation (duplicates Express `/api/reports/*`)
- `/api/audit/*` - Audit logging (duplicates Express `/api/audit/*`)
- `/api/proof-packs/*` - Proof pack generation (duplicates Express `/api/jobs/:id/proof-pack`)

### Recommendation: **Option 1 - Express API Only**

**Action**: Route all web calls to Express API, disable/remove Next.js API routes.

**Why**:
- ✅ Single enforcement layer (middleware, rate limiting, audit logging)
- ✅ Consistent behavior for web + iOS
- ✅ No "works on web but not iOS" bugs
- ✅ Easier to maintain (one codebase)

**Implementation**:
1. Set `NEXT_PUBLIC_API_URL=https://api.riskmate.dev` in Vercel
2. Update all web API calls to use `NEXT_PUBLIC_API_URL` instead of `/api/*`
3. Keep Next.js API routes only for:
   - Vercel-specific routes (cron jobs, webhooks)
   - Simple proxies (if needed)
   - Routes that don't exist in Express (verify first)

---

## 📋 Phase A: Security & Sanity Checks

### 1. Rotate Exposed Credentials

**Test Account Password**:
- Location: `apps/backend/src/__tests__/helpers/testData.ts`
- Action: Rotate `test@riskmate.dev` password in Supabase Auth
- Update: `TEST_USER_PASSWORD` env var in CI (if used)

**Service Role Key**:
- ✅ Never shipped to clients (backend-only)
- ✅ Verify: Check that `SUPABASE_SERVICE_ROLE_KEY` is NOT in:
  - `NEXT_PUBLIC_*` env vars
  - iOS build settings
  - Client-side code

**Dev Auth Secret**:
- Location: `apps/backend/src/routes/devAuth.ts`
- Action: Ensure `DEV_AUTH_SECRET` is **unset** in production
- Verify: `devAuthRouter` is not mounted in production Express app

### 2. Verify Environment Variable Security

**Backend (Railway)** - Server-only:
```bash
SUPABASE_SERVICE_ROLE_KEY=xxx  # ✅ Server-only
JWT_SECRET=xxx                 # ✅ Server-only
STRIPE_SECRET_KEY=xxx          # ✅ Server-only
DEV_AUTH_SECRET=               # ✅ Unset in prod
```

**Web (Vercel)** - Public (safe to expose):
```bash
NEXT_PUBLIC_SUPABASE_URL=xxx        # ✅ Public (anon key)
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx  # ✅ Public (anon key)
NEXT_PUBLIC_API_URL=xxx             # ✅ Public (API URL)
STRIPE_PUBLISHABLE_KEY=xxx          # ✅ Public (publishable key)
```

**iOS (Xcode)** - Public (safe to expose):
```bash
SUPABASE_URL=xxx        # ✅ Public (anon key)
SUPABASE_ANON_KEY=xxx   # ✅ Public (anon key)
API_BASE_URL=xxx        # ✅ Public (API URL)
```

---

## 📋 Phase B: Backend Deployment (Railway)

### Step 1: Create Railway Service

1. **Create Railway Project**:
   - Go to [railway.app](https://railway.app)
   - Create new project: `riskmate-production`
   - Add service: `backend-api`

2. **Connect Repository**:
   - Connect GitHub repo
   - Set root directory: `apps/backend`

3. **Configure Build**:
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm start:railway` (or `tsx src/index.ts`)
   - **Root Directory**: `apps/backend`

### Step 2: Set Environment Variables

**Required Variables** (Railway Dashboard → Variables):

```bash
# Environment
NODE_ENV=production

# Supabase (server-only)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_ANON_KEY=xxx  # Only if needed server-side

# CORS
CORS_ORIGINS=https://riskmate.dev,https://www.riskmate.dev

# Backend URL (for links/logs)
BACKEND_URL=https://api.riskmate.dev

# Stripe
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx

# Port (Railway injects automatically, but set if needed)
PORT=8080

# Dev Auth (UNSET in production)
# DEV_AUTH_SECRET=  # Leave empty or don't set

# Optional: Request ID tracking
REQUEST_ID_HEADER=X-Request-ID
```

### Step 3: Set Custom Domain

1. **In Railway Dashboard**:
   - Go to `backend-api` service → Settings → Domains
   - Add custom domain: `api.riskmate.dev`
   - Railway will show DNS records to add

2. **In DNS Provider** (where you manage `riskmate.dev`):
   - Add CNAME record:
     ```
     api.riskmate.dev → <railway-provided-domain>
     ```
   - Or use Railway's provided A record if CNAME not supported

3. **Wait for SSL**:
   - Railway automatically provisions SSL certificate
   - Wait 5-10 minutes for DNS propagation

### Step 4: Verify Backend Deployment

**Health Check**:
```bash
curl https://api.riskmate.dev/health
# Expected: {"status":"ok","timestamp":"...","db":"ok"}
```

**Version Check**:
```bash
curl https://api.riskmate.dev/__version
# Expected: {"status":"ok","service":"riskmate-api","environment":"production",...}
```

**Routes Check**:
```bash
curl https://api.riskmate.dev/__routes
# Expected: List of all registered routes
```

**Authenticated Read** (requires JWT):
```bash
curl -H "Authorization: Bearer <jwt_token>" \
  https://api.riskmate.dev/api/dashboard/summary
# Expected: Dashboard data or 401 if invalid token
```

**Read-Only Enforcement** (requires auditor JWT):
```bash
curl -X POST \
  -H "Authorization: Bearer <auditor_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"client_name":"Test"}' \
  https://api.riskmate.dev/api/jobs
# Expected: 403 {"message":"Auditors have read-only access","code":"AUTH_ROLE_READ_ONLY"}
```

**Owner Write** (requires owner JWT):
```bash
curl -X POST \
  -H "Authorization: Bearer <owner_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"client_name":"Test","job_type":"electrical"}' \
  https://api.riskmate.dev/api/jobs
# Expected: 201 with job object
```

---

## 📋 Phase C: Web Deployment (Vercel)

### Step 1: Create Vercel Project

1. **Connect Repository**:
   - Go to [vercel.com](https://vercel.com)
   - Import GitHub repository
   - Set root directory: `/` (project root)

2. **Configure Build**:
   - **Framework Preset**: Next.js
   - **Build Command**: `pnpm build` (or `next build`)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `pnpm install`

### Step 2: Set Environment Variables

**Required Variables** (Vercel Dashboard → Settings → Environment Variables):

```bash
# Supabase (public - safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Backend API (public - safe to expose)
NEXT_PUBLIC_API_URL=https://api.riskmate.dev

# Stripe (public - safe to expose)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=xxx

# Optional: Backend URL (for legacy code that uses NEXT_PUBLIC_BACKEND_URL)
NEXT_PUBLIC_BACKEND_URL=https://api.riskmate.dev

# Node Environment
NODE_ENV=production
```

**Important**: Do NOT set `SUPABASE_SERVICE_ROLE_KEY` in Vercel. It's backend-only.

### Step 3: Set Custom Domains

1. **In Vercel Dashboard**:
   - Go to Project → Settings → Domains
   - Add domain: `riskmate.dev`
   - Add domain: `www.riskmate.dev`

2. **In DNS Provider**:
   - Add A record for root domain:
     ```
     riskmate.dev → <vercel-ip-address>
     ```
     (Vercel will show the exact IP in the Domains UI)
   - Add CNAME for www:
     ```
     www.riskmate.dev → cname.vercel-dns.com
     ```
     (Use exactly what Vercel shows)

3. **Set Canonical Redirect**:
   - In Vercel → Domains → `www.riskmate.dev`
   - Enable "Redirect to Primary Domain" → `riskmate.dev`
   - This creates a 301 redirect: `www.riskmate.dev` → `riskmate.dev`

4. **Wait for SSL**:
   - Vercel automatically provisions SSL certificates
   - Wait 5-10 minutes for DNS propagation

### Step 4: Update Web Code to Use Express API

**Current State**: Some pages use Next.js API routes (`/api/*`), some use `NEXT_PUBLIC_BACKEND_URL`.

**Action**: Standardize all API calls to use `NEXT_PUBLIC_API_URL`.

**Files to Update**:

1. **`app/operations/audit/page.tsx`**:
   - Already uses `NEXT_PUBLIC_BACKEND_URL` ✅
   - Verify: Points to `https://api.riskmate.dev`

2. **`app/operations/audit/readiness/page.tsx`**:
   - Already uses `NEXT_PUBLIC_BACKEND_URL` ✅
   - Verify: Points to `https://api.riskmate.dev`

3. **Create API Client Utility** (recommended):
   ```typescript
   // lib/api/client.ts
   const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.riskmate.dev';
   
   export async function apiRequest(endpoint: string, options?: RequestInit) {
     const url = `${API_BASE_URL}${endpoint}`;
     // ... fetch logic
   }
   ```

4. **Update All API Calls**:
   - Search for `/api/` in `app/` directory
   - Replace with `NEXT_PUBLIC_API_URL` + endpoint
   - Example: `/api/jobs` → `${NEXT_PUBLIC_API_URL}/api/jobs`

### Step 5: Disable/Remove Duplicate Next.js API Routes

**Routes to Keep** (Vercel-specific):
- `/api/cron/*` - Vercel cron jobs
- `/api/stripe/webhook` - Stripe webhook (if using Vercel serverless)

**Routes to Remove/Disable** (duplicate Express):
- `/api/jobs/*` - Use Express `/api/jobs/*`
- `/api/reports/*` - Use Express `/api/reports/*`
- `/api/audit/*` - Use Express `/api/audit/*`
- `/api/proof-packs/*` - Use Express `/api/jobs/:id/proof-pack`

**Action**:
1. Option A (Recommended): Delete duplicate routes
2. Option B: Keep as simple proxies (not recommended - adds complexity)

### Step 6: Verify Web Deployment

**Domain Redirect**:
```bash
curl -I https://www.riskmate.dev
# Expected: 301 redirect to https://riskmate.dev
```

**Canonical Domain**:
```bash
curl -I https://riskmate.dev
# Expected: 200 OK
```

**Login Flow**:
1. Visit `https://riskmate.dev/login`
2. Sign in with test account
3. Verify: Redirects to `/operations`
4. Check browser console: No CORS errors

**API Calls**:
1. Open browser DevTools → Network tab
2. Navigate to `/operations/jobs`
3. Verify: API calls go to `https://api.riskmate.dev/api/jobs`
4. Verify: No calls to `/api/jobs` (Next.js routes)

**Read-Only Enforcement** (if testing auditor role):
1. Sign in as auditor
2. Try to create job
3. Verify: UI hides "Create Job" button
4. Verify: API returns `403 AUTH_ROLE_READ_ONLY` if called directly

---

## 📋 Phase D: iOS Production Configuration

### Step 1: Update iOS Config

**File**: `mobile/Riskmate/Riskmate/Config.swift` or `Info.plist`

**Production Values**:
```swift
// Config.swift
struct Config {
    static let apiBaseURL = "https://api.riskmate.dev"
    static let supabaseURL = "https://xxx.supabase.co"
    static let supabaseAnonKey = "xxx"
}
```

**Or in `Info.plist`**:
```xml
<key>API_BASE_URL</key>
<string>https://api.riskmate.dev</string>
<key>SUPABASE_URL</key>
<string>https://xxx.supabase.co</string>
<key>SUPABASE_ANON_KEY</key>
<string>xxx</string>
```

### Step 2: Update Xcode Build Settings

1. **Open Xcode**:
   - Open `mobile/Riskmate/Riskmate.xcodeproj`

2. **Set Build Configuration**:
   - Select project → Build Settings
   - Filter: "API_BASE_URL" or "SUPABASE"
   - Set Release configuration values:
     - `API_BASE_URL = https://api.riskmate.dev`
     - `SUPABASE_URL = https://xxx.supabase.co`
     - `SUPABASE_ANON_KEY = xxx`

3. **Verify Debug vs Release**:
   - Debug: Can use `http://localhost:8080` for local testing
   - Release: Must use `https://api.riskmate.dev`

### Step 3: App Store Readiness Checklist

**Copy Claims** (verify truthful):
- ✅ "Tamper-evident ledger" (not "blockchain")
- ✅ "Hash-chained proof records"
- ✅ "Cryptographically hashed and linked in a chain"
- ✅ "Capture evidence offline. Uploads sync when you're back online."

**Offline Functionality**:
- ✅ Evidence capture works offline
- ✅ Upload queue shows status (queued/uploading/synced/failed)
- ✅ Auto-upload when connection restored

**Read-Only Auditor Mode**:
- ✅ UI hides write actions
- ✅ Server returns `403 AUTH_ROLE_READ_ONLY` on mutations
- ✅ "Read-only audit mode" banner displayed

### Step 4: TestFlight Build

1. **Archive**:
   - Xcode → Product → Archive
   - Wait for build to complete

2. **Upload to TestFlight**:
   - Xcode Organizer → Distribute App
   - Select "App Store Connect"
   - Upload build

3. **TestFlight Verification**:
   - Install on test device
   - Test flows:
     - ✅ Login → Jobs list
     - ✅ Create job (owner)
     - ✅ Capture evidence offline
     - ✅ Reconnect → Verify "Synced" status
     - ✅ Ledger verification UI
     - ✅ Auditor mode (read-only)

4. **Auditor Mode Test**:
   - Sign in as auditor
   - Verify: Launches to Ledger tab
   - Verify: "Add Evidence" button hidden
   - Verify: "Create Job" button hidden
   - Verify: Server blocks mutations (403)

### Step 5: App Store Submission

1. **App Store Connect**:
   - Create app (if not exists)
   - Set bundle ID: `riskmate.Riskmate`
   - Set version: `1.0.0`
   - Set build number: Increment from previous

2. **Screenshots**:
   - Follow `APP_STORE_READINESS.md` guidelines
   - Dark mode only
   - No marketing copy
   - Literal captions only

3. **Description**:
   - Use `APP_STORE_DESCRIPTION.md` content
   - Verify: No "blockchain" claims
   - Verify: Offline claims are accurate

4. **Submit for Review**:
   - App Store Connect → Submit for Review
   - Wait for Apple review (typically 24-48 hours)

---

## 🔍 Production Verification Checklist

### Backend (Railway)

- [ ] `GET /health` returns `200 OK`
- [ ] `GET /__version` shows production environment
- [ ] `GET /api/dashboard/summary` (authenticated) returns data
- [ ] `POST /api/jobs` (owner) returns `201 Created`
- [ ] `POST /api/jobs` (auditor) returns `403 AUTH_ROLE_READ_ONLY`
- [ ] CORS allows `https://riskmate.dev` and `https://www.riskmate.dev`
- [ ] Service role key NOT exposed in client
- [ ] Dev auth route NOT accessible

### Web (Vercel)

- [ ] `https://riskmate.dev` loads (200 OK)
- [ ] `https://www.riskmate.dev` redirects to `https://riskmate.dev` (301)
- [ ] Login flow works
- [ ] API calls go to `https://api.riskmate.dev` (not `/api/*`)
- [ ] No CORS errors in browser console
- [ ] Jobs list loads
- [ ] Job creation works (owner)
- [ ] Auditor mode works (read-only)

### iOS (App Store)

- [ ] Release build points to `https://api.riskmate.dev`
- [ ] Login works
- [ ] Jobs list loads
- [ ] Evidence capture works offline
- [ ] Upload queue shows status
- [ ] Auto-upload works when reconnected
- [ ] Ledger verification UI works
- [ ] Auditor mode blocks writes (UI + server)

### Supabase

- [ ] RLS enabled on all tables
- [ ] Storage policies locked (no public listing)
- [ ] Service role key NOT in client code
- [ ] Test account password rotated

---

## 🚨 Troubleshooting

### Backend Issues

**Problem**: CORS errors in browser
- **Solution**: Verify `CORS_ORIGINS` includes both `https://riskmate.dev` and `https://www.riskmate.dev`

**Problem**: 401 Unauthorized on all requests
- **Solution**: Verify JWT token is valid, check `authenticate` middleware

**Problem**: 403 AUTH_ROLE_READ_ONLY for owner
- **Solution**: Verify user role in database, check `requireWriteAccess` middleware

### Web Issues

**Problem**: API calls go to `/api/*` instead of Express
- **Solution**: Update code to use `NEXT_PUBLIC_API_URL`, remove Next.js API routes

**Problem**: CORS errors
- **Solution**: Verify backend `CORS_ORIGINS` includes web domain

**Problem**: www redirect doesn't work
- **Solution**: Check DNS CNAME record, verify Vercel redirect settings

### iOS Issues

**Problem**: API calls fail
- **Solution**: Verify `API_BASE_URL` in Release build config

**Problem**: Offline upload doesn't work
- **Solution**: Check `BackgroundUploadManager` configuration, verify URLSession background config

---

## 📊 Post-Deployment Monitoring

### Backend Monitoring

**Health Checks**:
- Set up uptime monitoring: `GET /health` every 5 minutes
- Alert if status != `200 OK`

**Error Tracking**:
- Check Railway logs for `AUTH_ROLE_READ_ONLY` violations
- Monitor `logErrorForSupport` calls
- Track request IDs for debugging

**Performance**:
- Monitor response times for `/api/jobs`, `/api/dashboard/summary`
- Track database query performance

### Web Monitoring

**Vercel Analytics**:
- Enable Vercel Analytics (already configured)
- Monitor page load times
- Track error rates

**Error Tracking**:
- Check browser console errors
- Monitor API call failures

### iOS Monitoring

**Crash Reporting**:
- `CrashReporting` service already configured
- Monitor crash rates in App Store Connect

**Analytics**:
- `Analytics` service tracks key events
- Monitor user flows

---

## 🎯 Next Steps After Deployment

1. **Monitor for 24-48 hours**:
   - Check error logs
   - Verify no CORS issues
   - Confirm read-only enforcement works

2. **User Testing**:
   - Test with real accounts
   - Verify all flows work
   - Check offline functionality

3. **Performance Optimization**:
   - Monitor slow queries
   - Optimize database indexes
   - Cache frequently accessed data

4. **Documentation**:
   - Update README with production URLs
   - Document environment variables
   - Create runbook for common issues

---

**RiskMate is ready for production deployment.** 🚀
