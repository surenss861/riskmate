# Quick Fix: "Unable to find module dependency: 'Supabase'"

## The Problem
Xcode can't find the Supabase Swift package because it's not added to the project yet.

## The Solution (Do This Now)

### Step 1: Open Package Dependencies
1. In Xcode, click on the **project name** in Project Navigator (top item: "Riskmate")
2. Select the **Riskmate** project (blue icon)
3. Select the **Riskmate** target (under TARGETS)
4. Click the **Package Dependencies** tab

### Step 2: Add Supabase Package
1. Click the **+** button (bottom left of Package Dependencies section)
2. In the search box, paste: `https://github.com/supabase/supabase-swift`
3. Press Enter or click the search result
4. Click **Add Package**
5. Select version: **Up to Next Major Version** → `2.0.0`
6. Click **Add Package** again
7. **CRITICAL**: In the "Add to Target" section, check the box next to **Riskmate** ✅
8. Click **Add Package**

### Step 3: Verify It Worked
- In Project Navigator, scroll down to **Package Dependencies**
- You should see **supabase-swift** listed
- Expand it to see the modules (Auth, Realtime, etc.)

### Step 4: Clean & Rebuild
1. **Product → Clean Build Folder** (Cmd+Shift+K)
2. **Product → Build** (Cmd+B)

## If It Still Doesn't Work

### Option A: Remove and Re-add
1. In Package Dependencies tab, select `supabase-swift`
2. Click **-** button to remove it
3. Follow Step 2 above to add it again
4. Make absolutely sure "Riskmate" target is checked ✅

### Option B: Check Target Membership
1. Select any Swift file (e.g., `AuthService.swift`)
2. Open File Inspector (right panel)
3. Under "Target Membership", ensure **Riskmate** is checked ✅

### Option C: Manual Package Resolution
1. **File → Packages → Reset Package Caches**
2. **File → Packages → Resolve Package Versions**
3. Clean build folder (Cmd+Shift+K)
4. Rebuild (Cmd+B)

## Still Not Working?

The package URL might have changed. Try these alternatives:

1. `https://github.com/supabase/supabase-swift.git`
2. Or search for "supabase-swift" in Xcode's package search

## Verification

After adding, your `AuthService.swift` should compile without errors. The import statement `import Supabase` is correct - the issue is just that the package isn't added yet.
