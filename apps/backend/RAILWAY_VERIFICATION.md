# Railway Deployment Verification

## Build Verification Checklist

After deploying to Railway, verify these steps:

### 1. Build Logs
- [ ] TypeScript compilation (`tsc`) completes with **zero errors**
- [ ] No "Ignored build scripts: esbuild" warnings (if you see this, the `pnpm.onlyBuiltDependencies` config should fix it)
- [ ] Container boots successfully
- [ ] Health check endpoint responds: `GET /health`

### 2. Critical Endpoint Smoke Tests

Run these against your Railway backend URL:

```bash
# Set your Railway backend URL
export BACKEND_URL="https://your-railway-app.up.railway.app"

# 1. Health Check
curl "$BACKEND_URL/health"

# 2. Evidence Upload (requires auth token)
# Get a JWT token from your app first
export JWT_TOKEN="your-jwt-token"
export JOB_ID="your-job-id"

curl -X POST "$BACKEND_URL/api/jobs/$JOB_ID/evidence/upload" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Idempotency-Key: ev_$(uuidgen)" \
  -F "file=@./test.jpg" \
  -F "tag=PPE" \
  -F "phase=before"

# 3. Export Request
curl -X POST "$BACKEND_URL/api/jobs/$JOB_ID/export/proof-pack" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Idempotency-Key: ex_$(uuidgen)"

# 4. Poll Export Status (use export_id from previous response)
export EXPORT_ID="export-id-from-previous-response"
curl "$BACKEND_URL/api/exports/$EXPORT_ID" \
  -H "Authorization: Bearer $JWT_TOKEN"

# 5. Download Export (when state is 'ready')
curl -L "$BACKEND_URL/api/exports/$EXPORT_ID/download" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  --output proof-pack.zip

# 6. Verify Ledger Event
export EVENT_ID="ledger-event-id"
curl "$BACKEND_URL/api/ledger/events/$EVENT_ID/verify" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 3. Automated Golden Path Test

Run the golden path test script against Railway:

```bash
cd apps/backend
BACKEND_URL="https://your-railway-app.up.railway.app" \
JWT_TOKEN="your-jwt-token" \
pnpm test:golden-path
```

### 4. Worker Verification

Check that background workers are running:
- [ ] Export worker processes queued exports
- [ ] Retention worker cleans up expired exports
- [ ] Ledger root worker computes daily roots

Check logs for:
```
[ExportWorker] Starting...
[RetentionWorker] Starting...
[LedgerRootWorker] Starting...
```

### 5. Common Issues

**Issue: "Ignored build scripts: esbuild"**
- **Fix**: Added `pnpm.onlyBuiltDependencies: ["esbuild"]` to root `package.json`
- **Verify**: Redeploy and check logs for absence of warning

**Issue: TypeScript compilation errors**
- **Fix**: All TS errors should be resolved (busboy types, implicit any, wrong arg counts)
- **Verify**: Check Railway build logs for `tsc` output

**Issue: Container fails to start**
- **Check**: Verify `PORT` environment variable is set in Railway
- **Check**: Verify all required env vars are set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.)
- **Check**: Verify `/health` endpoint responds

**Issue: Workers not starting**
- **Check**: Verify workers are imported and started in `apps/backend/src/index.ts`
- **Check**: Check logs for worker initialization messages

## Next Steps After Verification

Once Railway is green:
1. ✅ RLS/RBAC audit (verify exec read-only, cross-org boundaries)
2. ✅ iOS Sync Center (queues + retry/pause + states)
3. ✅ Executive Brief export wiring (iOS + backend)
