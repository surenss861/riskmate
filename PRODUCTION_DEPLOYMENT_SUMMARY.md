# RiskMate Production Deployment - Executive Summary

**Status**: Ready for Production  
**Date**: January 2025  
**Target**: Unified Web + iOS release on `riskmate.dev`

---

## ✅ Current State

### Web App (Next.js)
- ✅ **Already configured** to use Express API via `lib/config.ts`
- ✅ Defaults to `https://api.riskmate.dev` in production
- ✅ Centralized API client in `lib/api.ts` routes all calls to backend
- ✅ Some pages use `NEXT_PUBLIC_BACKEND_URL` (already defaults to production)

### Backend (Express)
- ✅ Production-ready with proper middleware
- ✅ Read-only enforcement (`requireWriteAccess`)
- ✅ Health checks (`/health`, `/__version`)
- ✅ CORS configuration ready

### iOS App
- ✅ Production-ready SwiftUI app
- ✅ Offline support with background uploads
- ✅ Read-only auditor mode
- ✅ Needs production API URL in Release config

---

## 🎯 Deployment Plan

### Phase 1: Backend (Railway) - `api.riskmate.dev`
1. Create Railway service: `backend-api`
2. Set env vars (see checklist)
3. Add custom domain: `api.riskmate.dev`
4. Verify: `/health`, read-only enforcement

### Phase 2: Web (Vercel) - `riskmate.dev` + `www.riskmate.dev`
1. Import repo to Vercel
2. Set env vars:
   - `NEXT_PUBLIC_API_URL=https://api.riskmate.dev`
   - `NEXT_PUBLIC_BACKEND_URL=https://api.riskmate.dev` (for legacy code)
3. Add domains: `riskmate.dev`, `www.riskmate.dev`
4. Set redirect: `www` → `riskmate.dev` (301)
5. Verify: Login, API calls go to Express

### Phase 3: iOS (App Store)
1. Set Release config: `API_BASE_URL=https://api.riskmate.dev`
2. TestFlight build
3. Verify: Offline capture, upload queue, auditor mode
4. Submit to App Store

---

## 🔐 Security Checklist

- [ ] Rotate `test@riskmate.dev` password
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` NOT in client code
- [ ] Verify `DEV_AUTH_SECRET` unset in production
- [ ] Confirm RLS enabled on all Supabase tables
- [ ] Confirm storage policies locked

---

## 📋 Environment Variables

### Backend (Railway)
```bash
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...  # Server-only
CORS_ORIGINS=https://riskmate.dev,https://www.riskmate.dev
BACKEND_URL=https://api.riskmate.dev
STRIPE_SECRET_KEY=...
PORT=8080
```

### Web (Vercel)
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=https://api.riskmate.dev
NEXT_PUBLIC_BACKEND_URL=https://api.riskmate.dev  # For legacy code
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
```

### iOS (Xcode Release)
```bash
API_BASE_URL=https://api.riskmate.dev
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

---

## 🚀 Quick Start

1. **Deploy Backend** (Railway):
   - Follow `PRODUCTION_DEPLOYMENT_GUIDE.md` Phase B
   - Verify: `curl https://api.riskmate.dev/health`

2. **Deploy Web** (Vercel):
   - Follow `PRODUCTION_DEPLOYMENT_GUIDE.md` Phase C
   - Verify: `curl -I https://riskmate.dev`

3. **Deploy iOS** (App Store):
   - Follow `PRODUCTION_DEPLOYMENT_GUIDE.md` Phase D
   - TestFlight → App Store

---

## 📚 Documentation

- **Full Guide**: `PRODUCTION_DEPLOYMENT_GUIDE.md` (detailed steps)
- **Checklist**: `PRODUCTION_DEPLOYMENT_CHECKLIST.md` (quick reference)
- **Overview**: `RISKMATE_COMPLETE_PROJECT_OVERVIEW.md` (project structure)

---

**Ready to ship.** 🚀
