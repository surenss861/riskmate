# Final Fix: "No such module 'Supabase'"

## The Problem
Package is added (you see the warning "already depends on supabase-swift"), but Xcode can't find the module.

## Root Cause
The package products aren't linked to your target. This is the #1 cause.

## The Fix (Do This Exactly)

### Step 1: Verify Package Products Are Linked

1. **Click project "Riskmate"** (blue icon) in Project Navigator
2. **Select "Riskmate" target** (under TARGETS, not PROJECTS)
3. **Click "General" tab**
4. Scroll to **"Frameworks, Libraries, and Embedded Content"** section
5. **Is "Supabase" listed here?**
   - ✅ **YES** → Skip to Step 2
   - ❌ **NO** → Continue below

### Step 2: Add Supabase to Frameworks

If "Supabase" is NOT in "Frameworks, Libraries, and Embedded Content":

1. Click the **"+" button** in that section
2. You should see a list of frameworks
3. Look for **"Supabase"** in the list
4. If you see it:
   - Select it
   - Click **"Add"**
   - Set to **"Do Not Embed"**
5. If you DON'T see "Supabase" in the list:
   - The package products aren't linked
   - Go to Step 3

### Step 3: Link Package Products to Target

1. **Click project "Riskmate"** (blue icon)
2. **Select "Riskmate" target**
3. **Click "Build Phases" tab**
4. Expand **"Link Binary With Libraries"**
5. Click **"+"**
6. In the dialog, click **"Add Other..."** → **"Add Package Product..."**
7. You should see "Supabase" listed
8. Select it and click **"Add"**

**OR** try this alternative:

1. **Click project "Riskmate"** (blue icon)
2. **Select "Riskmate" target**
3. **Click "Build Settings" tab**
4. Search for: **"swift package"**
5. Look for **"Swift Package Product Dependencies"**
6. If "Supabase" is NOT listed:
   - The package isn't linked to the target
   - Go to Step 4

### Step 4: Re-add Package with Target Selection

The package might be added but not linked. Let's fix it:

1. **Click project "Riskmate"** (blue icon)
2. **Click "Package Dependencies" tab**
3. Find **"supabase-swift"** in the list
4. **Select it** and look at the right panel
5. Under **"Add to Target"**, ensure **"Riskmate"** is checked ✅
6. If it's not checked:
   - This is the problem!
   - You need to remove and re-add the package

### Step 5: Remove and Re-add (If Needed)

1. In **Package Dependencies** tab, select **"supabase-swift"**
2. Press **Delete** or click **"-"** button
3. **File → Packages → Reset Package Caches**
4. **Quit Xcode** (Cmd+Q)
5. **Reopen Xcode**
6. **File → Add Package Dependencies...**
7. URL: `https://github.com/supabase/supabase-swift`
8. **Add Package**
9. Version: **"Up to Next Major Version"** → `2.0.0`
10. **Add Package** again
11. **CRITICAL**: In "Add to Target" section, **CHECK "Riskmate"** ✅
12. **Add Package**

### Step 6: Clean Everything

1. **Product → Clean Build Folder** (Cmd+Shift+K)
2. **Quit Xcode** (Cmd+Q)
3. **Terminal**: `rm -rf ~/Library/Developer/Xcode/DerivedData/Riskmate-*`
4. **Reopen Xcode**
5. **Product → Build** (Cmd+B)

## Alternative: Check Module Name

Sometimes the module name differs. Try changing the import:

In `AuthService.swift`, try:
```swift
// Instead of:
import Supabase

// Try:
import supabase_swift
// or
import SupabaseSwift
```

But `import Supabase` should be correct for version 2.40.0.

## What to Check Right Now

**Tell me these 3 things:**

1. **Project → Target → General → "Frameworks, Libraries, and Embedded Content"**
   - Is "Supabase" listed? (YES/NO)

2. **Project → Target → Build Settings → Search "swift package"**
   - Is "Supabase" in "Swift Package Product Dependencies"? (YES/NO)

3. **Project → Package Dependencies tab**
   - When you select "supabase-swift", does it show "Add to Target: Riskmate" checked? (YES/NO)

These answers will tell us exactly where the linking is broken.
