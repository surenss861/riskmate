# Railway Dockerfile Path Fix

## Problem

Railway is still using the default `Dockerfile` (which compiles TypeScript) instead of `Dockerfile.tsx` (which uses tsx directly).

**Symptoms:**
- Build logs show: "Using Detected Dockerfile"
- Build runs: `RUN pnpm -C apps/backend build` (TypeScript compilation)
- TypeScript compilation fails or takes too long

## Solution

**Force Railway to use `Dockerfile.tsx`:**

1. Railway → Backend Service → Settings → Build
2. Set **Builder**: `Dockerfile` (not "Auto-detect")
3. Set **Dockerfile Path**: `apps/backend/Dockerfile.tsx`
4. Click **Save**
5. **Redeploy** the service

**Verification:**
- Build logs should show: "Using Dockerfile at apps/backend/Dockerfile.tsx"
- Build should NOT run `pnpm -C apps/backend build`
- Build should run `pnpm -C apps/backend start:railway` (tsx directly)

## If Dockerfile Path Field Doesn't Exist

If you don't see a "Dockerfile Path" field:

1. Railway is still in "Auto-detect" mode
2. Switch **Builder** from "Auto-detect" to `Dockerfile` manually
3. The "Dockerfile Path" field should appear
4. Set it to: `apps/backend/Dockerfile.tsx`

## Dependencies Status

All required dependencies are already in `apps/backend/package.json`:
- ✅ `dotenv` (17.2.3)
- ✅ `express` (4.22.1)
- ✅ `cors` (2.8.5)
- ✅ `uuid` (13.0.0)
- ✅ `nodemailer` (7.0.12)
- ✅ `resend` (6.7.0)
- ✅ All `@types/*` packages

**No need to reinstall dependencies** - they're already there.

## Next Steps

1. **Fix Railway Dockerfile path** (see above)
2. **Redeploy** Railway service
3. **Verify** backend is running:
   ```bash
   curl https://riskmate-production.up.railway.app/health
   ```
4. **Update Vercel** `BACKEND_URL` to Railway domain
5. **Redeploy Vercel**
6. **Test proof pack export**

