# How to Add Lottie Package in Xcode

## Step-by-Step Instructions

### 1. Open Xcode Project
- Open `mobile/Riskmate/Riskmate.xcodeproj` in Xcode

### 2. Add Package Dependency
1. In Xcode, click on your **project** in the Project Navigator (top left)
2. Select the **"Riskmate"** target
3. Click the **"Package Dependencies"** tab
4. Click the **"+"** button (bottom left)

### 3. Enter Package URL
1. In the search field, paste:
   ```
   https://github.com/airbnb/lottie-ios
   ```
2. Click **"Add Package"**

### 4. Select Version
- Choose **"Up to Next Major Version"**
- Version: **4.0.0** (or latest)
- Click **"Add Package"**

### 5. Add to Target
- Make sure **"Riskmate"** target is checked ✅
- Click **"Add Package"**

### 6. Verify
- The package should appear in **Package Dependencies**
- Build the project (Cmd+B) - should compile without errors

---

## Alternative: If Package Dependencies Tab Doesn't Work

### Via File Menu
1. **File** → **Add Package Dependencies...**
2. Paste URL: `https://github.com/airbnb/lottie-ios`
3. Click **"Add Package"**
4. Select version and target as above

---

## Verify It Works

After adding, the import should work:
```swift
import Lottie  // Should compile without errors
```

If you still see errors:
1. Clean build folder: **Product** → **Clean Build Folder** (Shift+Cmd+K)
2. Restart Xcode
3. Build again (Cmd+B)

---

## Optional: Add Lottie Animation Files

1. Download Lottie JSON files (from LottieFiles.com or your designer)
2. Drag JSON files into Xcode project
3. Make sure **"Copy items if needed"** is checked
4. Add to **"Riskmate"** target

Common animations to add:
- `loading.json` - Loading spinner
- `success.json` - Success checkmark
- `empty.json` - Empty state animation

---

## Troubleshooting

### "Unable to find module 'Lottie'"
- ✅ Make sure package is added to **"Riskmate"** target (not just project)
- ✅ Clean build folder and rebuild
- ✅ Check Package Dependencies shows Lottie

### "No such module 'Lottie'"
- ✅ Verify package URL is correct: `https://github.com/airbnb/lottie-ios`
- ✅ Check Xcode version (needs Xcode 14+ for SPM)
- ✅ Try removing and re-adding the package

### Build Errors After Adding
- ✅ Make sure you're using the correct import: `import Lottie` (not `Lottie-iOS`)
- ✅ Check that your deployment target is iOS 13+ (Lottie requires iOS 13+)
