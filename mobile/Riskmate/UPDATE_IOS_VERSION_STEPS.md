# Update iOS Deployment Target - Exact Steps

## The Problem

Your project is set to **iOS 12.0**, but SwiftLint requires **iOS 13.0+**.

## Solution: Update to iOS 13.0 (or 16.0 for Swift Charts)

### Step 1: Update Target Deployment Target

1. **Open Xcode**
2. **Click on "Riskmate"** (the blue project icon at the top of the Project Navigator)
3. **In the main editor area, you'll see "PROJECT" and "TARGETS" sections**
4. **Under "TARGETS", click on "Riskmate"** (the app target, not the project)
5. **Click the "General" tab** (should be selected by default)
6. **Scroll down to find "Minimum Deployments" section**
7. **You'll see "iOS" with a dropdown showing `12.0`**
8. **Click the dropdown and change it to `13.0`** (or `16.0` if you want Swift Charts)

**Visual Guide:**
```
Xcode Window
├── Project Navigator (left)
│   └── Riskmate (blue icon) ← Click this
│
└── Main Editor (center)
    ├── PROJECT
    │   └── Riskmate
    │
    └── TARGETS
        └── Riskmate ← Click this
            └── General tab
                └── Minimum Deployments
                    └── iOS: [12.0 ▼] ← Change to 13.0 or 16.0
```

### Step 2: Update Project-Wide Deployment Target (Recommended)

1. **Still in the same window, click on "Riskmate" under "PROJECT"** (not TARGETS)
2. **Click the "Info" tab**
3. **Find "iOS Deployment Target"**
4. **Change it to `13.0`** (or `16.0`)

### Step 3: Clean & Rebuild

1. **Product** → **Clean Build Folder** (Shift+Cmd+K)
2. **Product** → **Build** (Cmd+B)

---

## Alternative: Use Build Settings

If you can't find it in General tab:

1. **Select "Riskmate" target**
2. **Click "Build Settings" tab**
3. **Search for: `iOS Deployment Target`**
4. **Double-click the value** → Change to `13.0` (or `16.0`)
5. **Make sure it's set for both "Debug" and "Release"**

---

## Verify It Changed

After updating:

1. **Build Settings** → Search `iOS Deployment Target`
2. **Should show `13.0`** (or `16.0`)
3. **Build should succeed**

---

## Why iOS 16.0 is Recommended

Since you're using **Swift Charts** in your Dashboard:
- Swift Charts requires **iOS 16.0+**
- Setting to 16.0 makes everything work (SwiftLint, Charts, etc.)
- iOS 16 is from 2022 (still reasonable for modern apps)

**Recommendation:** Set to **iOS 16.0** to support all your features.

---

## If You Still See Errors

1. **Close Xcode completely**
2. **Delete Derived Data:**
   - Xcode → Settings → Locations
   - Click arrow next to Derived Data
   - Delete `Riskmate-*` folder
3. **Reopen Xcode**
4. **Clean Build Folder** (Shift+Cmd+K)
5. **Build** (Cmd+B)

---

## Quick Checklist

- [ ] Updated "Riskmate" target → General → Minimum Deployments → iOS to 13.0+ (or 16.0)
- [ ] Updated "Riskmate" PROJECT → Info → iOS Deployment Target to 13.0+ (or 16.0)
- [ ] Cleaned build folder (Shift+Cmd+K)
- [ ] Rebuilt (Cmd+B)
- [ ] Build succeeds without iOS version errors

---

**Once you update the deployment target, all SwiftLint errors will disappear!**
