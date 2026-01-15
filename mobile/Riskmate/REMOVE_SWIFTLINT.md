# Remove SwiftLint to Fix Build Error

The SwiftLint macro error is blocking your build. Here's how to remove it:

## Step-by-Step

### 1. Open Package Dependencies
- In Xcode, click on your **project** (top of Project Navigator)
- Select **"Riskmate"** target
- Click **"Package Dependencies"** tab

### 2. Remove SwiftLint
- Find **"SwiftLint"** in the package list
- Select it
- Click the **"-"** button (bottom left)
- Confirm removal

### 3. Clean Build
- **Product** → **Clean Build Folder** (Shift+Cmd+K)
- **Product** → **Build** (Cmd+B)

### 4. Verify
- Build should succeed without SwiftLint errors
- You can add SwiftLint back later when you're ready

---

## Why Remove It?

SwiftLint requires:
- Xcode 15+ for macro support
- Proper macro enablement in build settings
- Additional configuration

For now, **it's not essential** - you can add it back later when:
- The app is stable
- You want code quality enforcement
- You have time to configure it properly

---

## Alternative: Keep SwiftLint (If You Want)

If you want to keep SwiftLint, you need to:

1. **Enable Macros**:
   - Target → Build Settings
   - Search: `ENABLE_MACROS`
   - Set to **Yes** ✅

2. **Requires Xcode 15+**:
   - Check your Xcode version
   - Update if needed

3. **Clean & Rebuild**

**Recommendation**: Remove it for now, add it back later.
