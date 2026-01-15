# Fix Build Errors: SwiftLint Macros & Lottie Import

## Issue 1: SwiftLint Macro Not Enabled

**Error:**
```
Macro "SwiftLintCoreMacros" from package "SwiftLint" must be enabled before it can be used
```

### Solution: Enable Macros in Build Settings

1. **Open Xcode Project**
   - Open `mobile/Riskmate/Riskmate.xcodeproj`

2. **Select Target**
   - Click on **"Riskmate"** project in Project Navigator
   - Select **"Riskmate"** target (under TARGETS)

3. **Enable Macros**
   - Go to **Build Settings** tab
   - Search for: `ENABLE_MACROS` or `Swift Macros`
   - Set **"Enable Macros"** to **Yes** ✅

   OR

   - Go to **Build Settings** → **Swift Compiler - Language**
   - Find **"Enable Macros"** → Set to **Yes** ✅

4. **Alternative: Remove SwiftLint (if not needed yet)**
   If you don't need SwiftLint right now:
   - Project → Package Dependencies
   - Find SwiftLint → Remove
   - Clean build folder (Shift+Cmd+K)
   - Rebuild

---

## Issue 2: Lottie Module Not Found

**Error:**
```
Unable to find module dependency: 'Lottie'
```

### Solution A: Verify Package is Linked

1. **Check Package Dependencies**
   - Project → Package Dependencies
   - Verify **Lottie** appears in the list
   - If missing, add it (see ADD_LOTTIE_PACKAGE.md)

2. **Check Target Linking**
   - Select **"Riskmate"** target
   - Go to **General** tab → **Frameworks, Libraries, and Embedded Content**
   - Verify **Lottie** and **Lottie-Dynamic** are listed ✅
   - If missing, click **"+"** and add them

3. **Clean & Rebuild**
   - **Product** → **Clean Build Folder** (Shift+Cmd+K)
   - **Product** → **Build** (Cmd+B)

### Solution B: Use Conditional Import (Already Done)

The code already uses `#if canImport(Lottie)`, but Xcode's parser might still complain.

**Quick Fix:**
1. Comment out the import temporarily:
   ```swift
   // import Lottie  // Uncomment when package is properly linked
   ```

2. Or remove SwiftLint from the build phase if it's causing issues

---

## Quick Fix: Remove SwiftLint Build Phase (Temporary)

If SwiftLint is blocking your build:

1. **Select Target** → **Build Phases**
2. Find **"Run SwiftLint"** or similar script phase
3. Click **"-"** to remove it (or disable it)
4. Clean & rebuild

You can add it back later when you're ready to use linting.

---

## Verify Everything Works

After fixes:

1. **Clean Build Folder**: Shift+Cmd+K
2. **Build**: Cmd+B
3. **Run**: Cmd+R

Should compile without errors.

---

## If Still Failing

1. **Delete Derived Data**:
   - Xcode → Settings → Locations
   - Click arrow next to Derived Data path
   - Delete `Riskmate-*` folder
   - Rebuild

2. **Reset Package Caches**:
   - File → Packages → Reset Package Caches
   - File → Packages → Resolve Package Versions

3. **Check Xcode Version**:
   - Macros require Xcode 15+
   - Update Xcode if needed
