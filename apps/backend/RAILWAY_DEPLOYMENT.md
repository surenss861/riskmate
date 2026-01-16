# Railway Deployment Configuration

## Required Settings

### Root Directory
Set the **Root Directory** in Railway service settings to:
```
apps/backend
```

This ensures Railway builds from the correct monorepo subdirectory.

### Build Command
```
pnpm install && pnpm build
```

Or if using npm:
```
npm install && npm run build
```

### Start Command
For production (compiled):
```
pnpm start
```

Or if Railway doesn't support pnpm workspace:
```
node dist/apps/backend/src/index.js
```

For development (TypeScript direct):
```
pnpm start:railway
```

Or:
```
tsx src/index.ts
```

## Environment Variables

### Required
- `PORT` - Automatically set by Railway (do not override)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Recommended (for correct environment detection)
- `NODE_ENV` - Set to `production` in Railway (or Railway will auto-set `RAILWAY_ENVIRONMENT=production`)
- `RAILWAY_ENVIRONMENT` - Automatically set by Railway to `production` in production (used by health endpoint)

### Optional
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `RAILWAY_GIT_COMMIT_SHA` - Automatically set by Railway (for health checks)
- `RAILWAY_DEPLOYMENT_ID` - Automatically set by Railway (for health checks)
- `DEV_AUTH_SECRET` - (Optional) Secret for dev testing endpoints (`/v1/dev/*`). Only set if you need dev utilities.

## Health Check Endpoints

### Basic Health
```
GET /health
```
Returns: `{ status: "ok", timestamp: "..." }`

### Versioned Health (with build metadata)
```
GET /v1/health
```
Returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "commit": "abc123...",
  "service": "riskmate-api",
  "version": "0.1.0",
  "environment": "production",
  "deployment": "deploy_xyz",
  "db": "ok"
}
```

### Version Info
```
GET /__version
```
Returns deployment metadata including commit SHA and deployment ID.

## Verification

After deployment, verify the service is running:

```bash
# Check basic health
curl https://api.riskmate.dev/health

# Check versioned health (includes commit)
curl https://api.riskmate.dev/v1/health

# Verify routes are mounted (should return 401/403, NOT 404)
curl -H "Authorization: Bearer invalid" https://api.riskmate.dev/v1/jobs
curl -H "Authorization: Bearer invalid" https://api.riskmate.dev/v1/account/organization
```

**Key Rule:**
- ✅ `401` or `403` = Route exists, auth is working
- ❌ `404` = Route not mounted / wrong base path / wrong deploy

## Testing Authenticated Endpoints

### Get a Real Supabase Access Token

To test authenticated endpoints, you need a real Supabase session token:

**From Web App:**
1. Log into your web app
2. Open DevTools → Application → Local Storage
3. Find `sb-<project-id>-auth-token` key
4. Copy the `access_token` value from the JSON

**From iOS App:**
1. Log into the iOS app
2. Check APIClient logs for the token (or use session storage)

### Test with Real Token

```bash
# Test /v1/me endpoint (returns current user)
curl -H "Authorization: Bearer <access_token>" \
  https://api.riskmate.dev/v1/me

# Test /v1/account/organization
curl -H "Authorization: Bearer <access_token>" \
  https://api.riskmate.dev/v1/account/organization
```

### Dev Testing Endpoint (Optional)

If `DEV_AUTH_SECRET` is set, you can use `/v1/dev/whoami` to verify user data without auth:

```bash
# Verify user exists (bypasses auth, requires DEV_AUTH_SECRET header)
curl -H "X-Dev-Secret: <DEV_AUTH_SECRET>" \
  "https://api.riskmate.dev/v1/dev/whoami?user_id=<uuid>&org_id=<uuid>"
```

**Note:** This endpoint only verifies user data exists. To test full auth flow, use a real Supabase token.

## Troubleshooting

### Routes return 404
1. Check Root Directory is set to `apps/backend`
2. Verify build command completes successfully
3. Check start command is correct
4. Verify `/v1` router is mounted (check logs for "Listening on...")

### Health check fails
1. Check PORT environment variable is set
2. Verify service is running (check Railway logs)
3. Check `/health` endpoint (should work even if `/v1/health` fails)

### Wrong commit in health response
1. Verify `RAILWAY_GIT_COMMIT_SHA` is set (auto-set by Railway)
2. Check deployment is from correct branch
3. Verify code was actually deployed (check Railway deployment logs)

## Monorepo Notes

This is a monorepo with the backend in `apps/backend/`. Railway must:
1. Set Root Directory to `apps/backend`
2. Run build/start commands from that directory
3. Have access to root `package.json` for workspace dependencies (if using pnpm workspaces)

If using pnpm workspaces, Railway should run commands from the repo root, but set the working directory to `apps/backend` for the service.
