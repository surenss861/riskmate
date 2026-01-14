# iOS App Troubleshooting

## "Unable to find module dependency: 'Supabase'"

**Cause:** Supabase Swift package is not added to the Xcode project.

**Fix:**
1. In Xcode: **File → Add Package Dependencies...**
2. Enter: `https://github.com/supabase/supabase-swift`
3. Click **Add Package**
4. Select version (latest or `2.0.0+`)
5. **Make sure "Riskmate" target is checked** ✅
6. Click **Add Package**

**Verify:**
- Project Navigator → "Package Dependencies" → should see "supabase-swift"
- If missing, repeat steps above

**After adding:**
- Clean build: **Product → Clean Build Folder** (Cmd+Shift+K)
- Rebuild: **Product → Build** (Cmd+B)

## "Multiple commands produce ContentView.stringsdata"

**Cause:** Duplicate file references in Xcode project.

**Fix:**
1. In Project Navigator, find any files with red icons (missing)
2. Right-click → **Delete** → **Remove Reference** (not Move to Trash)
3. Clean build folder: Cmd+Shift+K
4. Rebuild: Cmd+B

## "Config.plist not found"

**Cause:** Config.plist not added to target or not in Copy Bundle Resources.

**Fix:**
1. Select `Config.plist` in Project Navigator
2. Open File Inspector (right panel)
3. Under "Target Membership", check **Riskmate** ✅
4. Under Build Phases → Copy Bundle Resources, ensure `Config.plist` is listed
5. If missing, drag `Config.plist` into Copy Bundle Resources

## "Invalid API URL" or API requests fail

**Check:**
1. Open `Config.plist` in Xcode
2. Verify `BACKEND_URL` is set (not placeholder)
3. Format: `https://api.riskmate.dev` (no trailing slash)
4. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set

## Build succeeds but app crashes on launch

**Check logs:**
- Open Xcode Console (View → Debug Area → Activate Console)
- Look for error messages about:
  - Missing config values
  - Supabase client initialization
  - Network errors

**Common fixes:**
- Verify `Config.plist` values are correct
- Check backend is accessible: `curl https://api.riskmate.dev/health`
- Verify Supabase credentials are correct
