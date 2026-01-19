# Swift Package Manager Resolution Fix

## Problem
Xcode can't find package products (PostgREST, Functions, Lottie, etc.) after cleaning DerivedData.

## Quick Fix (Do This in Xcode)

### Option 1: Resolve Packages (Recommended)
1. **Open Xcode**
2. **File → Packages → Resolve Package Versions**
3. Wait for packages to download
4. **Product → Clean Build Folder** (⇧⌘K)
5. **Build** (⌘B)

### Option 2: Update Packages
1. **Open Xcode**
2. **File → Packages → Update to Latest Package Versions**
3. Wait for packages to update
4. **Product → Clean Build Folder** (⇧⌘K)
5. **Build** (⌘B)

### Option 3: Reset Package Caches
1. **File → Packages → Reset Package Caches**
2. **File → Packages → Resolve Package Versions**
3. Wait for packages to re-download
4. **Build** (⌘B)

## What Happened
When we cleaned DerivedData to free disk space, Xcode lost track of the resolved package versions. The packages are still configured in your project, but Xcode needs to resolve them again.

## Expected Packages
Your project uses:
- **supabase-swift** (provides: Auth, PostgREST, Functions, Storage, Realtime, Supabase)
- **lottie-ios** (provides: Lottie)
- **Kingfisher** (provides: Kingfisher)
- **SwiftDate** (provides: SwiftDate)
- **rive-ios** (provides: RiveRuntime)

## After Resolution
Once packages are resolved, you should see them in:
- **Project Navigator** → **Package Dependencies**
- They'll appear under your project

## If It Still Fails
1. Close Xcode
2. Delete `~/Library/Developer/Xcode/DerivedData/Riskmate-*` again
3. Open Xcode
4. File → Packages → Resolve Package Versions
5. Build
