# Config.plist Setup Guide

## ⚠️ CRITICAL: Replace Placeholder Values

Your `Config.plist` currently has placeholders that **must be replaced** or the app will crash on launch.

## Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your RiskMate project
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL** → This is your `SUPABASE_URL`
     - Format: `https://xxxxx.supabase.co`
   - **anon public key** → This is your `SUPABASE_ANON_KEY`
     - Long JWT token starting with `eyJ...`
     - ⚠️ **NOT** the service_role key (that's secret!)

## Step 2: Update Config.plist

1. Open `mobile/Riskmate/Riskmate/Config.plist` in Xcode
2. Replace the placeholder values:

```xml
<key>BACKEND_URL</key>
<string>https://api.riskmate.dev</string>  ✅ Already correct

<key>SUPABASE_URL</key>
<string>https://YOUR-PROJECT-REF.supabase.co</string>  ⚠️ REPLACE THIS

<key>SUPABASE_ANON_KEY</key>
<string>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</string>  ⚠️ REPLACE THIS
```

**Example:**
```xml
<key>SUPABASE_URL</key>
<string>https://abcdefghijklmnop.supabase.co</string>

<key>SUPABASE_ANON_KEY</key>
<string>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.abcdefghijklmnopqrstuvwxyz1234567890</string>
```

## Step 3: Verify Config.plist is in Bundle

1. In Xcode, select `Config.plist` in Project Navigator
2. Open **File Inspector** (right panel, first tab)
3. Under **"Target Membership"**, ensure **"Riskmate"** is checked ✅
4. Click project → **"Riskmate" target** → **Build Phases** tab
5. Expand **"Copy Bundle Resources"**
6. Verify `Config.plist` is listed
7. If missing: Click **"+"** → Select `Config.plist` → **Add**

## Step 4: Verify Values on Launch

When you run the app, check the Xcode console. You should see:

```
[Config] ✅ Backend URL: https://api.riskmate.dev
[Config] ✅ Supabase URL: https://xxxxx.supabase.co...
[Config] ✅ Supabase Anon Key: eyJhbGciOiJIUzI1NiIs... (length: 200+)
```

**If you see:**
- `Config.plist not found` → File not in bundle (Step 3)
- `Required config values missing` → Keys are wrong in plist
- `SUPABASE_URL is still a placeholder` → You didn't replace the value
- `SUPABASE_ANON_KEY is still a placeholder` → You didn't replace the value

## Step 5: Test the Flow

1. **Run app** (Cmd+R)
2. **Login** with email/password
3. **Account tab** → Should load organization name
4. **Edit org name** → Save → Should update

## Troubleshooting

### App crashes on launch with "Config.plist not found"
- **Fix**: Add `Config.plist` to "Copy Bundle Resources" (Step 3)

### App crashes with "SUPABASE_URL is still a placeholder"
- **Fix**: Replace `YOUR_SUPABASE_URL` with actual URL from Supabase dashboard

### Login fails with 401
- Check console for `[APIClient]` logs
- Verify Bearer token is being sent
- Verify Supabase credentials are correct

### API calls fail with 404
- Verify `BACKEND_URL` is correct (no trailing slash)
- Check endpoint path starts with `/` (e.g., `/api/account/organization`)
- Test backend directly: `curl https://api.riskmate.dev/health`
