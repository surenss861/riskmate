# RiskMate iOS Setup Guide

## Step 1: Create Xcode Project

1. Open Xcode
2. File → New → Project
3. Choose **iOS** → **App**
4. Configure:
   - Product Name: `Riskmate`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Minimum iOS: **17.0** (or 16.0 if needed)
5. Save to: `mobile/Riskmate/`

## Step 2: Add Supabase Package

1. In Xcode: File → Add Package Dependencies
2. Enter URL: `https://github.com/supabase/supabase-swift`
3. Version: Latest (or `2.0.0+`)
4. Add to target: `Riskmate`

## Step 3: Add Files to Project

Copy all files from this directory into your Xcode project:

**Models:**
- `Models/Organization.swift`
- `Models/User.swift`

**Services:**
- `Services/SessionManager.swift`
- `Services/AuthService.swift`
- `Services/APIClient.swift`
- `Config.swift`

**Views:**
- `Views/Auth/LoginView.swift`
- `Views/Main/ContentView.swift`
- `Views/Main/AccountView.swift`
- `Views/Main/OperationsView.swift`
- `Views/Main/AuditView.swift`

**App Entry:**
- `RiskmateApp.swift` (replace the default)

**Resources:**
- `Config.plist` (add to project, ensure it's in Copy Bundle Resources)

## Step 4: Configure Config.plist

1. Open `Config.plist` in Xcode
2. Update values:
   - `BACKEND_URL`: `https://api.riskmate.dev` (or your Railway URL)
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon/public key

## Step 5: Build & Run

1. Select a simulator (iPhone 15 Pro recommended)
2. Cmd+R to build and run
3. You should see the login screen

## Testing the Flow

1. **Login**: Use a test account with email/password
2. **View Account**: Should show organization name
3. **Edit Org Name**: Tap Edit → Change name → Save
4. **Verify**: Check backend audit logs to confirm update was logged

## Next Steps

- Add audit log feed to `AuditView`
- Add operations dashboard to `OperationsView`
- Add proof pack export functionality
- Add offline support (if needed)

## Troubleshooting

**"Config.plist not found"**
- Ensure `Config.plist` is added to the target
- Check "Copy Bundle Resources" in Build Phases

**"Supabase package not found"**
- Re-add package dependency
- Clean build folder (Cmd+Shift+K)

**"API request fails"**
- Check `BACKEND_URL` in Config.plist
- Verify backend is accessible
- Check auth token is being sent (check Network tab in Xcode)
