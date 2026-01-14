# Xcode Setup Checklist

## ✅ Step 1: Add Files to Xcode Project

1. Open `mobile/Riskmate/Riskmate.xcodeproj` in Xcode
2. In Project Navigator, right-click the **Riskmate** group (blue folder icon)
3. Select **Add Files to "Riskmate"...**
4. Navigate to `mobile/Riskmate/Riskmate/`
5. Select these items:
   - `Models/` folder
   - `Services/` folder
   - `Views/` folder
   - `Config.swift`
   - `Config.plist`
6. In the dialog:
   - ✅ **Check**: "Add to targets: Riskmate"
   - ❌ **Uncheck**: "Copy items if needed" (files are already in place)
7. Click **Add**

## ✅ Step 2: Verify Config.plist is in Bundle

1. Click the **Riskmate** project (blue icon) in Project Navigator
2. Select **Riskmate** target (under TARGETS)
3. Click **Build Phases** tab
4. Expand **Copy Bundle Resources**
5. Verify `Config.plist` is listed
6. If missing: Click **+** → Select `Config.plist` → **Add**

## ✅ Step 3: Add Supabase Package

1. **File → Add Package Dependencies...** (NOT "Add Package Collection")
2. Enter URL: `https://github.com/supabase/supabase-swift`
3. Click **Add Package**
4. Select version: **Up to Next Major Version** → `2.0.0`
5. Click **Add Package** again
6. **CRITICAL**: Check "Riskmate" target ✅
7. Click **Add Package**

## ✅ Step 4: Configure Config.plist

1. Open `Config.plist` in Xcode
2. Set these values (case-sensitive):

```
BACKEND_URL = https://api.riskmate.dev
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:**
- `BACKEND_URL` should point directly to Railway (not Next.js proxy)
- No trailing slashes
- Use your actual Supabase project URL and anon key

## ✅ Step 5: Verify Target Membership

1. Select any Swift file (e.g., `AuthService.swift`)
2. Open **File Inspector** (right panel)
3. Under **Target Membership**, ensure **Riskmate** is checked ✅

## ✅ Step 6: Clean & Build

1. **Product → Clean Build Folder** (Cmd+Shift+K)
2. **Product → Build** (Cmd+B)
3. Should build without errors

## ✅ Step 7: Test the Flow

1. Run app (Cmd+R)
2. **Login**: Enter email/password
3. **Account Tab**: Should load organization name
4. **Edit Org Name**: Tap Edit → Change name → Save
5. **Verify**: Check backend audit logs for the update

## Troubleshooting

### "Config.plist not found"
- Verify it's in "Copy Bundle Resources" (Step 2)
- Check file exists at `mobile/Riskmate/Riskmate/Config.plist`

### "Unable to find module 'Supabase'"
- Verify package is added (Step 3)
- Check "Package Dependencies" in Project Navigator
- Clean build folder and rebuild

### "401 Unauthorized" on API calls
- Verify `SUPABASE_ANON_KEY` is correct in Config.plist
- Check token is being sent: Look for `Authorization: Bearer ...` in Xcode console logs
- Verify backend `ALLOWED_ORIGINS` allows requests without Origin (iOS apps don't send Origin)

### "404 Not Found" on API calls
- Verify `BACKEND_URL` is correct (no trailing slash)
- Check endpoint path: Should be `/api/account/organization` (starts with `/`)
- Test backend directly: `curl https://api.riskmate.dev/health`

### API calls fail silently
- Check Xcode console for `[APIClient]` debug logs
- Verify network permissions in Info.plist (if needed)
- Check backend logs for incoming requests
