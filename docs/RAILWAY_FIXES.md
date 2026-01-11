# Railway Deployment Fixes

## Current Issues & Solutions

### Issue 1: Cache Mount Error
**Error**: `Cache mount ID is not prefixed with cache key`

**Fix**: Switch to Dockerfile builder
- Railway → Backend Service → Settings → Build
- Set Builder: `Dockerfile`
- Set Dockerfile Path: `apps/backend/Dockerfile`
- Redeploy

This bypasses Railway's build cache completely.

---

### Issue 2: Backend Not Listening on Correct Interface
**Problem**: Backend must bind to `0.0.0.0` to accept external connections from Railway

**Fix Applied**: Updated `apps/backend/src/index.ts`:
```typescript
app.listen(PORT, '0.0.0.0', () => {
  // ...
});
```

**Why**: Railway needs the server to listen on all interfaces (`0.0.0.0`), not just localhost (`127.0.0.1`).

---

### Issue 3: DNS CNAME Mismatch
**Error**: `NET::ERR_CERT_COMMON_NAME_INVALID` (SSL certificate error)

**Problem**: DNS CNAME points to wrong Railway domain

**Fix**: In Squarespace DNS:
- Type: `CNAME`
- Host/Name: `api`
- Value/Target: `m9crb2tf.up.railway.app` ✅ (from Railway's expected value, NOT the old `946n24cm`)

**Important**: Wait until Railway shows domain as "Verified" and "SSL Ready" before testing.

---

## Railway Configuration Checklist

### Backend Service Settings

**Builder**: `Dockerfile`
- Dockerfile Path: `apps/backend/Dockerfile`
- Root Directory: Leave empty (defaults to repo root)

**Environment Variables** (Railway → Service → Variables):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `ALLOWED_ORIGINS` = `https://riskmate.dev,https://riskmate.vercel.app`
- `STRIPE_SECRET_KEY` - Stripe API secret (if used on startup)
- `PORT` - **Don't set this** (Railway injects it automatically)

### Port Binding

The backend code reads `process.env.PORT || 5173`:
- Railway automatically sets `PORT` environment variable
- Backend binds to `0.0.0.0` (all interfaces) - ✅ Fixed
- Default fallback `5173` is only used in local dev

---

## Deployment Steps (In Order)

1. **Fix Railway Deployment**:
   - Switch to Dockerfile builder
   - Redeploy
   - Wait for service to show "Running"

2. **Get Railway Domain**:
   - Railway → Service → Settings → Networking
   - Generate Domain (or use auto-generated)
   - Example: `https://riskmate-production.up.railway.app`

3. **Test Backend Health**:
   ```bash
   curl https://riskmate-production.up.railway.app/health
   ```
   Should return: `{ "status": "ok", "timestamp": "..." }`

4. **Fix DNS CNAME** (Squarespace):
   - Type: `CNAME`
   - Host: `api`
   - Target: `m9crb2tf.up.railway.app` (Railway's expected value)

5. **Wait for SSL Verification**:
   - Railway → Service → Settings → Public Networking
   - Wait until `api.riskmate.dev` shows "Verified" and "SSL Ready"
   - Do NOT test the domain until Railway confirms verification

6. **Update Vercel Environment Variables**:
   - `BACKEND_URL` = `https://api.riskmate.dev` (after DNS/SSL verified)
   - Or temporarily use: `https://riskmate-production.up.railway.app` (Railway domain)
   - Remove/fix `NEXT_PUBLIC_BACKEND_URL` (no localhost)

7. **Redeploy Vercel**:
   - Deployments → Latest Production → Redeploy
   - (Env vars only apply to new deployments)

8. **Test Proof Pack Export**:
   - Go to `/operations/audit`
   - Try generating a proof pack
   - Should work, or show a real backend error with traceable Error ID

---

## Quick Workaround (If DNS is Slow)

If you want to test immediately without waiting for custom domain:

1. Use Railway-generated domain in Vercel:
   ```
   BACKEND_URL = https://riskmate-production.up.railway.app
   ```

2. Test proof pack export

3. Once `api.riskmate.dev` is verified:
   - Update `BACKEND_URL` to `https://api.riskmate.dev`
   - Redeploy Vercel

---

## Troubleshooting

### Backend Still Not Working

**Check Railway Logs**:
- Railway → Service → Logs
- Look for errors on startup
- Verify PORT is being read correctly

**Verify Port Binding**:
- Logs should show: `🚀 RiskMate Backend API running on port <PORT>`
- PORT should match Railway's injected value (not 5173)

**Test Health Endpoint**:
```bash
curl https://riskmate-production.up.railway.app/health
```
If this fails, the backend isn't running properly.

### SSL Certificate Errors

**Symptoms**: `NET::ERR_CERT_COMMON_NAME_INVALID`

**Causes**:
- DNS CNAME points to wrong Railway domain
- Domain not verified in Railway yet
- Testing domain before Railway issues SSL cert

**Fix**: 
- Verify CNAME matches Railway's expected value exactly
- Wait for Railway to show "Verified" + "SSL Ready"
- Only test domain after Railway confirms verification

### Connection Refused

**Check**:
- Service shows "Running" in Railway
- Port binding is `0.0.0.0` (not `127.0.0.1`)
- No firewall/network restrictions

---

## Summary

The backend is now configured to:
- ✅ Bind to `0.0.0.0` (accepts external connections)
- ✅ Read `process.env.PORT` (works with Railway's port injection)
- ✅ Use Dockerfile builder (bypasses cache issues)

Next steps:
1. Switch Railway to Dockerfile builder
2. Fix DNS CNAME to match Railway's expected value
3. Wait for SSL verification
4. Update Vercel `BACKEND_URL`
5. Redeploy Vercel
6. Test proof pack export

