# Quick Fix: "Unable to find module dependency: 'Supabase'"

## The Problem
Xcode can't find the Supabase Swift package because it's not added to the project yet.

## The Solution (Do This Now)

### ⚠️ IMPORTANT: Use "Add Package Dependencies", NOT "Add Package Collection"

You're seeing an error because you clicked "Add Package Collection" - that's the wrong option!

### Step 1: Close the Current Dialog
1. Click **Cancel** on the error dialog
2. Click **Cancel** on the "Add Package Collection" dialog

### Step 2: Open the Correct Menu
1. In Xcode menu bar: **File → Add Package Dependencies...**
   - **NOT** "Add Package Collection"
   - **NOT** "Add Local Package"
   - **MUST BE** "Add Package Dependencies..."

### Step 3: Add Supabase Package
1. In the search box at the top, paste: `https://github.com/supabase/supabase-swift`
2. Press Enter or wait for search results
3. You should see "supabase-swift" in the results
4. Click **Add Package** button
5. Select version: **Up to Next Major Version** → `2.0.0`
6. Click **Add Package** again
7. **CRITICAL**: In the "Add to Target" section, check the box next to **Riskmate** ✅
8. Click **Add Package** to finish

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
