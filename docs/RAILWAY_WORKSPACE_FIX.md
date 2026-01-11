# Railway Workspace Fix

## Problem

Railway was failing with `Cannot find module 'express'` because:

1. **`pnpm-workspace.yaml` was missing `packages` field** - pnpm didn't know about workspace packages
2. **Railway was using `Dockerfile.tsx`** (tsx runtime) instead of `Dockerfile` (compiled JS)
3. **Dockerfile wasn't installing dev dependencies** needed for TypeScript build

## Fixes Applied

### 1. Fixed `pnpm-workspace.yaml`

**Before:**
```yaml
ignoredBuiltDependencies:
  - '@tsparticles/engine'
  # ... no packages field
```

**After:**
```yaml
packages:
  - "apps/*"  # ✅ Now pnpm knows about apps/backend

ignoredBuiltDependencies:
  - '@tsparticles/engine'
  # ...
```

### 2. Updated Dockerfile to Install Dev Dependencies

**Before:**
```dockerfile
RUN pnpm install --frozen-lockfile
```

**After:**
```dockerfile
RUN pnpm install --frozen-lockfile --prod=false
```

This ensures TypeScript is available for the build step.

### 3. Railway Configuration

**Use the compiled Dockerfile (not tsx):**

Railway → Backend Service → Settings → Build:
- **Builder**: `Dockerfile`
- **Dockerfile Path**: `apps/backend/Dockerfile` (NOT `Dockerfile.tsx`)
- **Root Directory**: Leave empty (repo root)

**Why:**
- `Dockerfile` compiles TypeScript → runs `node dist/index.js` (production-ready)
- `Dockerfile.tsx` runs `tsx src/index.ts` (development mode, requires tsx in deps)

## Verification

After redeploy, verify:

1. **Workspace is recognized:**
   ```bash
   pnpm --filter @riskmate/backend why express
   ```
   Should show express is installed.

2. **Backend builds:**
   ```bash
   pnpm --filter @riskmate/backend build
   ```
   Should compile TypeScript successfully.

3. **Backend starts:**
   ```bash
   pnpm --filter @riskmate/backend start
   ```
   Should run `node dist/index.js` (not tsx).

4. **Railway logs show:**
   - Docker build steps (not Nixpacks)
   - `node dist/index.js` in CMD (not `tsx src/index.ts`)
   - Server running message

## Next Steps

1. **Redeploy Railway** with cache cleared
2. **Verify** backend is running: `curl https://riskmate-production.up.railway.app/health`
3. **Update Vercel** `BACKEND_URL` to Railway domain
4. **Redeploy Vercel**
5. **Test proof pack export**

## Summary

The root cause was `pnpm-workspace.yaml` missing the `packages` field. Without it, pnpm doesn't install workspace package dependencies, so `express` (and other backend deps) were never installed in the container.

Now:
- ✅ Workspace is properly configured
- ✅ Dockerfile installs all deps (including dev deps for build)
- ✅ Railway should use compiled JS (not tsx)
- ✅ All dependencies will be available at runtime

