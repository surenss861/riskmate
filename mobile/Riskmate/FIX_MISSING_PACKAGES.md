# Fix Missing Package Products

## The Problem

Xcode is reporting "Missing package product" errors for all your Swift Package Manager dependencies. This happens when packages aren't resolved or linked properly.

## Solution: Resolve Packages in Xcode

### Step 1: Resolve Packages

1. **Open Xcode**
2. **File → Packages → Resolve Package Versions**
   - Wait for this to complete (1-2 minutes)
   - You should see progress in the status bar
3. **If that doesn't work:**
   - **File → Packages → Reset Package Caches**
   - Then **File → Packages → Resolve Package Versions** again

### Step 2: Verify Package Linking

1. **Select "Riskmate" target**
2. **General tab**
3. **Scroll to "Frameworks, Libraries, and Embedded Content"**
4. **Verify all packages are listed:**
   - Auth
   - Functions
   - PostgREST
   - Realtime
   - Storage
   - Supabase
   - Kingfisher
   - Lottie
   - Lottie-Dynamic
   - SwiftDate
   - RiveRuntime

5. **If any are missing:**
   - Click "+" button
   - Add the missing packages

### Step 3: Clean & Rebuild

1. **Product → Clean Build Folder** (Shift+Cmd+K)
2. **Product → Build** (Cmd+B)

## Alternative: Remove and Re-add Packages

If resolving doesn't work:

1. **Project → Package Dependencies**
2. **Remove all packages** (click "-" on each)
3. **Close Xcode**
4. **Delete package caches:**
   ```bash
   cd "/Users/surensureshkumar/coding projects/riskmate/mobile/Riskmate"
   rm -rf .swiftpm
   rm -rf Riskmate.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
   ```
5. **Reopen Xcode**
6. **Re-add packages one by one:**
   - File → Add Package Dependencies...
   - Add each package URL:
     - Supabase: `https://github.com/supabase/supabase-swift`
     - Kingfisher: `https://github.com/onevcat/Kingfisher`
     - Lottie: `https://github.com/airbnb/lottie-ios`
     - SwiftDate: `https://github.com/malcommac/SwiftDate`
     - RiveRuntime: `https://github.com/rive-app/rive-ios`

## Quick Fix (Try This First)

The fastest solution is usually:

1. **File → Packages → Reset Package Caches**
2. **File → Packages → Resolve Package Versions**
3. **Wait for completion**
4. **Clean Build Folder** (Shift+Cmd+K)
5. **Build** (Cmd+B)

This should resolve 90% of "Missing package product" errors.
