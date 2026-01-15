# Fix iOS Version Error - SwiftLint Requires iOS 13.0+

## Problem

SwiftLint and its dependencies require **iOS 13.0 minimum**, but your project is set to **iOS 12.0**.

Error messages:
```
The package product 'SwiftIDEUtils' requires minimum platform version 13.0 for the iOS platform, but this target supports 12.0
```

## Solution: Update Deployment Target

### Step 1: Update iOS Deployment Target

1. **Open Xcode**
2. **Click on "Riskmate" project** (top of Project Navigator)
3. **Select "Riskmate" target**
4. **Go to "General" tab**
5. **Find "Minimum Deployments"** section
6. **Change "iOS" from `12.0` to `13.0`** (or higher)

### Step 2: Update Project-Wide Setting (Optional but Recommended)

1. **Still in project settings**, click on **"Riskmate"** (the PROJECT, not target)
2. **Go to "Info" tab**
3. **Find "iOS Deployment Target"**
4. **Change to `13.0`** (or higher)

### Step 3: Clean & Rebuild

1. **Product** → **Clean Build Folder** (Shift+Cmd+K)
2. **Product** → **Build** (Cmd+B)

---

## Alternative: Remove SwiftLint (If You Don't Need It)

If you don't want to update the deployment target, remove SwiftLint:

1. **Project** → **Package Dependencies** tab
2. **Find "SwiftLint"** → Select it → Click **"-"**
3. **Clean & Rebuild**

---

## Recommended: iOS 13.0+ (Or iOS 16.0+ for Swift Charts)

**Why iOS 13.0+?**
- SwiftLint requires it
- Most modern packages require iOS 13+
- iOS 13 is from 2019 (very old devices)
- You're using Swift Charts which requires iOS 16+

**Why iOS 16.0+?**
- Swift Charts requires iOS 16+
- Your Dashboard uses Swift Charts
- iOS 16 is from 2022 (still reasonable)

### To Set iOS 16.0:

1. **Target** → **General** → **Minimum Deployments** → **iOS 16.0**
2. **Project** → **Info** → **iOS Deployment Target** → **16.0**

---

## Check Current Deployment Target

In Xcode:
- **Target** → **General** tab → Look at "Minimum Deployments"
- Or **Build Settings** → Search "iOS Deployment Target"

---

## After Updating

Once you set iOS 13.0+ (or 16.0+):
- ✅ SwiftLint will build
- ✅ All packages will work
- ✅ Swift Charts will work (if iOS 16+)
- ✅ Modern iOS features available

---

## Note

If you need to support iOS 12.0 devices:
- Remove SwiftLint (not essential)
- Remove Swift Charts (use alternative charting)
- Most other packages should work on iOS 12

But realistically, iOS 13+ is the standard minimum for modern apps in 2024.
