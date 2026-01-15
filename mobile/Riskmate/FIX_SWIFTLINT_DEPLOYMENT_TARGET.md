# Fix SwiftLint Package Deployment Target Issue

## The Problem

Your app target is set to iOS 26.2 ✅, but **SwiftLint's internal package targets** are still resolving to iOS 12.0. The error says "this target supports 12.0" - this refers to SwiftLint's package targets, not your app.

## Solution: Force Package Deployment Target

### Option 1: Update Package Resolution (Recommended)

1. **Close Xcode**

2. **Delete Package Caches:**
   ```bash
   cd "/Users/surensureshkumar/coding projects/riskmate/mobile/Riskmate"
   rm -rf .swiftpm
   rm -rf Riskmate.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
   ```

3. **Delete Derived Data:**
   - Xcode → Settings → Locations
   - Click arrow next to Derived Data
   - Delete `Riskmate-*` folder

4. **Reopen Xcode**

5. **Resolve Packages:**
   - File → Packages → Reset Package Caches
   - File → Packages → Resolve Package Versions
   - Wait for resolution to complete

6. **Clean & Rebuild:**
   - Shift+Cmd+K (Clean)
   - Cmd+B (Build)

### Option 2: Add Build Setting Override

If Option 1 doesn't work, force the deployment target for packages:

1. **Select "Riskmate" target**
2. **Build Settings tab**
3. **Search: `IPHONEOS_DEPLOYMENT_TARGET`**
4. **Make sure it shows `26.2`** (or `16.0` if you prefer)
5. **Check "All" and "Combined"** to see all configurations
6. **Verify it's set for Debug, Release, and any other configs**

### Option 3: Check Package Product Settings

Sometimes packages have their own deployment target settings:

1. **Select "Riskmate" target**
2. **General tab** → **Frameworks, Libraries, and Embedded Content**
3. **Find "SwiftLintFramework"** in the list
4. **Check if there's a deployment target setting** (usually not visible here)

### Option 4: Update SwiftLint Package Version

The SwiftLint package version might have a bug. Try updating:

1. **Project** → **Package Dependencies**
2. **Find "SwiftLint"**
3. **Click the version dropdown** → **Update to Latest**
4. **Resolve Package Versions**
5. **Clean & Rebuild**

---

## Why This Happens

Swift Package Manager can cache old package resolutions. Even though your app target is iOS 26.2, the SwiftLint package's internal targets might be using a cached deployment target of 12.0.

---

## Nuclear Option: Remove and Re-add SwiftLint

If nothing works:

1. **Project** → **Package Dependencies**
2. **Remove SwiftLint** (click "-")
3. **Clean build folder**
4. **Add SwiftLint again:**
   - Click "+"
   - URL: `https://github.com/realm/SwiftLint`
   - Version: Latest
   - Add to "Riskmate" target
5. **Resolve Package Versions**
6. **Clean & Rebuild**

---

## Verify Fix

After trying the solutions:

1. **Build** (Cmd+B)
2. **Should see no "requires minimum platform version 13.0" errors**
3. **SwiftLint should build successfully**

---

## Quick Test

Try Option 1 first (delete caches + resolve). That fixes 90% of package deployment target issues.
