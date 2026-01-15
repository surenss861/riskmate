# Fix iOS Deployment Target - Complete Guide

## Problem
The project was targeting iOS 26.2, which doesn't exist. This causes build failures because the deployment target cannot be higher than the installed iOS SDK.

## Solution
Set the deployment target to **iOS 17.0** (recommended for RiskMate) or iOS 16.0 (for broader support).

## ✅ Already Fixed in project.pbxproj
All instances of `IPHONEOS_DEPLOYMENT_TARGET = 26.2` have been changed to `IPHONEOS_DEPLOYMENT_TARGET = 17.0`.

## Manual Steps (if needed)

### Step 1: Verify in Xcode
1. Open the project in Xcode
2. Click the **blue project icon** (Riskmate) in the navigator
3. Select **Targets → Riskmate**
4. Go to **General** tab
5. Under **Minimum Deployments**, verify **iOS** is set to **17.0**

### Step 2: Check All Targets
Repeat for:
- **RiskmateTests** → Set to iOS 17.0
- **RiskmateUITests** → Set to iOS 17.0

### Step 3: Verify Build Settings
1. Still in each target, go to **Build Settings**
2. Search for: `IPHONEOS_DEPLOYMENT_TARGET`
3. Verify it shows **17.0** (not 26.2)
4. Check both **Debug** and **Release** configurations

### Step 4: Clean Build
1. **Product → Clean Build Folder** (Shift + Cmd + K)
2. Delete DerivedData:
   - **Xcode → Settings → Locations → Derived Data**
   - Click the arrow next to the path
   - Delete the `Riskmate-*` folder

### Step 5: Reset Packages
1. **File → Packages → Reset Package Caches**
2. **File → Packages → Resolve Package Versions**

### Step 6: Verify Simulator Runtime
- Make sure you have an iOS 17.x or 18.x simulator runtime installed
- Deployment target (17.0) must be ≤ installed runtime

## Why iOS 17.0?
- **Best SwiftUI experience** - Modern APIs and behaviors
- **Better NavigationSplitView** - Improved iPad navigation
- **Predictable Material rendering** - Consistent glass effects
- **Premium enterprise app** - Normal for business apps
- **Swift Charts support** - Full feature set available

## Alternative: iOS 16.0
If you need broader device support:
- Still supports Swift Charts
- More compatibility
- May need more workarounds for navigation/animation quirks

## Verification
After fixing, build the project:
- ✅ Should compile without deployment target errors
- ✅ Should run on iOS 17+ simulators/devices
- ✅ All targets should show 17.0 in Build Settings
