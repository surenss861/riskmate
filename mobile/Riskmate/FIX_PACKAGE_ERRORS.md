# Fix Missing Package Products Errors

## Problem

Xcode is showing "Missing package product" errors for packages that either:
1. Were removed but still referenced in the project
2. Need to be re-resolved
3. Are optional and not actually needed

## Solution: Clean Up Package References

### Step 1: Remove Unused Packages

These packages are **optional** and can be removed:

- ❌ **Lottie** - Not used (we have ProgressView placeholder)
- ❌ **Lottie-Dynamic** - Not used
- ❌ **SwiftLint** - Not essential (causing macro errors)
- ❌ **SwiftLintFramework** - Not essential
- ❌ **swiftlint** - Not essential
- ❌ **RiveRuntime** - Not used
- ❌ **SwiftDate** - Not used (using Foundation's RelativeDateTimeFormatter)

**Keep these (essential):**
- ✅ **Supabase** - Required for auth
- ✅ **Auth, Storage, Functions, PostgREST, Realtime** - Supabase modules
- ✅ **Kingfisher** - Used for image loading (if you're using it)

### Step 2: Remove Packages in Xcode

1. **Open Xcode**
2. **Click on "Riskmate" project** (top of Project Navigator)
3. **Select "Riskmate" target**
4. **Go to "Package Dependencies" tab**
5. **For each unused package, select it and click "-"**:
   - Lottie
   - SwiftLint
   - RiveRuntime
   - SwiftDate

### Step 3: Reset Package Resolution

1. **File** → **Packages** → **Reset Package Caches**
2. **File** → **Packages** → **Resolve Package Versions**
3. Wait for resolution to complete

### Step 4: Clean Build

1. **Product** → **Clean Build Folder** (Shift+Cmd+K)
2. **Product** → **Build** (Cmd+B)

---

## Alternative: Nuclear Option (If Above Doesn't Work)

If packages are still showing as missing:

1. **Close Xcode**

2. **Delete package caches:**
   ```bash
   cd "/Users/surensureshkumar/coding projects/riskmate/mobile/Riskmate"
   rm -rf .swiftpm
   rm -rf Riskmate.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
   ```

3. **Delete Derived Data:**
   - Xcode → Settings → Locations
   - Click arrow next to "Derived Data"
   - Delete `Riskmate-*` folder

4. **Reopen Xcode**

5. **Resolve packages:**
   - File → Packages → Resolve Package Versions

6. **Clean & Rebuild**

---

## Verify What's Actually Used

### Currently Used in Code:
- ✅ **Supabase** - `AuthService.swift`, `SessionManager.swift`
- ✅ **Supabase modules** - Auth, Storage, Functions, PostgREST, Realtime
- ❓ **Kingfisher** - Not yet used (but recommended for images)

### Not Used:
- ❌ Lottie - Using ProgressView placeholder
- ❌ SwiftLint - Not configured
- ❌ RiveRuntime - Not used
- ❌ SwiftDate - Using Foundation's RelativeDateTimeFormatter

---

## Recommended: Minimal Package Set

For now, you only need:

1. **Supabase** (and its modules)
2. **Kingfisher** (optional, but recommended for images)

Everything else can be removed.

---

## After Cleanup

Once packages are resolved:

- ✅ Build should succeed
- ✅ No missing package errors
- ✅ App will work (Lottie shows ProgressView, which is fine)
- ✅ You can add packages back later when needed

---

## If Kingfisher is Missing

If you want to use Kingfisher for images:

1. **File** → **Add Package Dependencies...**
2. **URL**: `https://github.com/onevcat/Kingfisher`
3. **Version**: Up to Next Major (6.0.0)
4. **Add to**: Riskmate target
5. **Resolve** and **Build**

But it's optional - you can add it later when you need image loading.
