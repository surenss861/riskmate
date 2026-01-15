# Resolve All Package Errors - Step by Step

## Current Problem

Xcode shows "Missing package product" for all packages. They're linked but not resolved.

## Quick Fix (Do This Now)

### Step 1: Reset Package Caches
1. In Xcode: **File** → **Packages** → **Reset Package Caches**
2. Wait for it to complete (check progress in top bar)

### Step 2: Resolve Package Versions
1. **File** → **Packages** → **Resolve Package Versions**
2. **Wait** - This will take 1-2 minutes. Watch the progress indicator.

### Step 3: Remove SwiftLint (It's Causing Macro Errors)
1. Click on **"Riskmate"** project (top of Navigator)
2. Select **"Riskmate"** target
3. Go to **"Package Dependencies"** tab
4. Find **"SwiftLint"** → Select it → Click **"-"**
5. Confirm removal

### Step 4: Clean & Rebuild
1. **Product** → **Clean Build Folder** (Shift+Cmd+K)
2. **Product** → **Build** (Cmd+B)

---

## If Step 2 Doesn't Work (Nuclear Option)

### Delete Everything and Start Fresh:

1. **Close Xcode completely**

2. **Delete Package Caches:**
   ```bash
   cd "/Users/surensureshkumar/coding projects/riskmate/mobile/Riskmate"
   rm -rf .swiftpm
   rm -rf Riskmate.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
   ```

3. **Delete Derived Data:**
   - Open **System Settings** → **General** → **Storage**
   - Or: Xcode → Settings → Locations → Click arrow next to Derived Data
   - Delete `Riskmate-*` folder

4. **Reopen Xcode**

5. **Resolve Packages:**
   - **File** → **Packages** → **Resolve Package Versions**
   - Wait for all packages to download

6. **Verify Packages Are Linked:**
   - Project → Target → **General** tab
   - Scroll to **"Frameworks, Libraries, and Embedded Content"**
   - All packages should show without "Missing" errors

7. **Clean & Build:**
   - Shift+Cmd+K (Clean)
   - Cmd+B (Build)

---

## Expected Packages (After Resolution)

You should have these packages resolved:

### Required:
- ✅ **Supabase** (and modules: Auth, Storage, Functions, PostgREST, Realtime)
- ✅ **Kingfisher**
- ✅ **Lottie** (and Lottie-Dynamic)
- ✅ **SwiftDate**
- ✅ **RiveRuntime**

### Remove:
- ❌ **SwiftLint** (causing macro errors - remove it)

---

## Verify It Worked

After resolving:
- ✅ No "Missing package product" errors
- ✅ All packages show in Frameworks list
- ✅ Build succeeds
- ✅ Only SwiftLint error remains (until you remove it)

---

## Package URLs (If You Need to Re-Add)

If packages are completely missing:

1. **File** → **Add Package Dependencies...**
2. Add these one by one:

- **Supabase**: `https://github.com/supabase/supabase-swift`
- **Kingfisher**: `https://github.com/onevcat/Kingfisher`
- **Lottie**: `https://github.com/airbnb/lottie-ios`
- **SwiftDate**: `https://github.com/malcommac/SwiftDate`
- **RiveRuntime**: `https://github.com/rive-app/rive-ios`

3. For each: Select version → Add to "Riskmate" target

---

## Most Likely Fix

**Just do Step 1 and Step 2** - Reset caches and resolve versions. That fixes 90% of these errors.

The packages are already in your project, they just need to be downloaded/resolved.
