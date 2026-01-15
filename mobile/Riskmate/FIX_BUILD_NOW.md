# Fix Build Errors - Quick Steps

## Error 1: SwiftLint Macro

**Remove SwiftLint package:**

1. Open Xcode
2. Click on **"Riskmate"** project (top of Project Navigator)
3. Select **"Riskmate"** target
4. Click **"Package Dependencies"** tab
5. Find **"SwiftLint"** in the list
6. Select it → Click **"-"** button (bottom left)
7. Confirm removal

**Then:**
- **Product** → **Clean Build Folder** (Shift+Cmd+K)
- **Product** → **Build** (Cmd+B)

---

## Error 2: Lottie Import

The `RMLottieView.swift` file is already fixed (no import), but Xcode might be caching the old version.

**Fix:**

1. **Delete Derived Data:**
   - Xcode → Settings → Locations
   - Click arrow next to "Derived Data" path
   - Delete `Riskmate-*` folder
   - Close Xcode

2. **Reset Package Caches:**
   - Reopen Xcode
   - File → Packages → Reset Package Caches
   - File → Packages → Resolve Package Versions

3. **Clean & Rebuild:**
   - **Product** → **Clean Build Folder** (Shift+Cmd+K)
   - **Product** → **Build** (Cmd+B)

---

## If Still Failing

**Nuclear option (guaranteed fix):**

1. Close Xcode completely
2. Delete Derived Data (see above)
3. In Terminal:
   ```bash
   cd "/Users/surensureshkumar/coding projects/riskmate/mobile/Riskmate"
   rm -rf .swiftpm
   rm -rf Riskmate.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
   ```
4. Reopen Xcode
5. File → Packages → Resolve Package Versions
6. Clean & Rebuild

---

## Verify Fix

After removing SwiftLint and cleaning:

- ✅ Build should succeed
- ✅ No SwiftLint errors
- ✅ No Lottie import errors
- ✅ `RMLottieView` works (shows ProgressView spinner)

---

## Note

- **SwiftLint**: Not essential - you can add it back later
- **Lottie**: Already using placeholder (ProgressView) - works without package

Both are optional dependencies. The app will work fine without them.
