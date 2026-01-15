# Backend Connection Setup

## ✅ Current Status

Your mobile app is **already configured** to connect to the backend!

### Configuration

**Config.plist:**
- `BACKEND_URL`: `https://api.riskmate.dev` ✅
- `SUPABASE_URL`: Set ✅
- `SUPABASE_ANON_KEY`: Set ✅

**APIClient.swift:**
- Uses `AppConfig.shared.backendURL` for all API requests ✅
- Adds `Authorization: Bearer {token}` header automatically ✅
- Handles JSON encoding/decoding ✅

## How It Works

1. **Authentication Flow:**
   - User signs in via Supabase (handled by `AuthService`)
   - Supabase returns JWT token
   - `APIClient` automatically adds token to all backend requests

2. **API Requests:**
   - All requests go to: `https://api.riskmate.dev/api/...`
   - Example: `GET https://api.riskmate.dev/api/account/organization`
   - Headers include: `Authorization: Bearer {supabase_jwt_token}`

3. **Backend Endpoints:**
   - The Railway backend at `api.riskmate.dev` handles:
     - `/api/account/organization` (GET, PATCH)
     - `/api/audit/export/pack` (POST)
     - `/api/jobs` (GET, POST, etc.)
     - All other backend routes

## Testing the Connection

### 1. Verify Backend is Running

```bash
curl https://api.riskmate.dev/health
```

Should return: `{"status":"ok",...}`

### 2. Test from Mobile App

1. **Run the app in simulator**
2. **Sign in** with valid credentials
3. **Check Xcode console** for:
   - `[Config] ✅ Backend URL: https://api.riskmate.dev`
   - `[APIClient] Request: GET https://api.riskmate.dev/api/account/organization`
   - `[APIClient] Response: 200 OK`

### 3. Test API Endpoints

The app will automatically call:
- `GET /api/account/organization` when AccountView loads
- `PATCH /api/account/organization` when user updates org name
- Other endpoints as you implement features

## Troubleshooting

### Backend Not Reachable

**Error:** `BACKEND_CONNECTION_ERROR` or network timeout

**Fix:**
1. Verify Railway backend is deployed and running
2. Check `https://api.riskmate.dev/health` in browser
3. Verify DNS is correct (CNAME for `api.riskmate.dev`)

### Authentication Errors

**Error:** `401 Unauthorized` or `AUTH_INVALID_TOKEN`

**Fix:**
1. Verify Supabase credentials in `Config.plist`
2. Check that user is signed in (session exists)
3. Verify JWT token is being sent in `Authorization` header

### CORS Errors

**Note:** Mobile apps don't have CORS restrictions (that's browser-only). If you see CORS errors, they're from the web app, not mobile.

## Next Steps

1. **Build and run the app** (Cmd+R)
2. **Sign in** with test credentials
3. **Navigate to Account tab** - should load organization data from backend
4. **Check Xcode console** for API request/response logs

The backend connection is ready! 🚀
