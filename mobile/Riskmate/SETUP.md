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

## Step 2: Add Supabase Package (REQUIRED - Fixes "Unable to find module dependency: 'Supabase'")

1. In Xcode: **File → Add Package Dependencies...**
2. In the search box, enter: `https://github.com/supabase/supabase-swift`
3. Click **Add Package**
4. Select version: **Up to Next Major Version** with `2.0.0` (or latest)
5. Click **Add Package** again
6. **IMPORTANT**: Make sure "Riskmate" target is checked
7. Click **Add Package** to finish

**Verify it worked:**
- In Project Navigator, you should see "Package Dependencies" section
- Expand it to see "supabase-swift"
- If you don't see it, repeat the steps above

**If you still get the error:**
- Clean build folder: **Product → Clean Build Folder** (Cmd+Shift+K)
- Close and reopen Xcode
- Try building again

## Step 3: Add Files to Project

All files are already in `mobile/Riskmate/Riskmate/`. In Xcode:

1. Right-click on `Riskmate` folder in Project Navigator
2. Select "Add Files to Riskmate..."
3. Navigate to `mobile/Riskmate/Riskmate/`
4. Select these folders/files:
   - `Models/` folder
   - `Services/` folder
   - `Views/` folder
   - `Config.swift`
   - `Config.plist`
   - `RiskmateApp.swift` (replace the default one)

**Important:** Make sure "Copy items if needed" is **unchecked** (files are already in the right place) and "Add to targets: Riskmate" is **checked**.

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
