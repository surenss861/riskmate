# Setup SwiftLint - Complete Guide

## Step 1: Update iOS Deployment Target

SwiftLint requires **iOS 13.0+**. Update your deployment target:

1. **Open Xcode**
2. **Click "Riskmate" project** (top of Navigator)
3. **Select "Riskmate" target**
4. **Go to "General" tab**
5. **Find "Minimum Deployments"**
6. **Change "iOS" to `13.0`** (or `16.0` if using Swift Charts)

**Also update project-wide:**
1. **Click "Riskmate" PROJECT** (not target)
2. **Go to "Info" tab**
3. **Set "iOS Deployment Target" to `13.0`** (or `16.0`)

## Step 2: Enable Macros (Required for SwiftLint)

SwiftLint uses macros that need to be enabled:

1. **Select "Riskmate" target**
2. **Go to "Build Settings" tab**
3. **Search for: `ENABLE_MACROS`**
4. **Set "Enable Macros" to `Yes`** ✅

**Alternative path:**
- **Build Settings** → **Swift Compiler - Language** → **Enable Macros** → `Yes`

## Step 3: Verify SwiftLint Package

1. **Project** → **Package Dependencies** tab
2. **Verify "SwiftLint" is listed**
3. **If missing, add it:**
   - Click **"+"**
   - URL: `https://github.com/realm/SwiftLint`
   - Version: Latest
   - Add to "Riskmate" target

## Step 4: Add SwiftLint Build Phase (Optional)

To run SwiftLint automatically on build:

1. **Select "Riskmate" target**
2. **Go to "Build Phases" tab**
3. **Click "+"** → **"New Run Script Phase"**
4. **Drag it above "Compile Sources"**
5. **Add this script:**

```bash
if which swiftlint > /dev/null; then
  swiftlint
else
  echo "warning: SwiftLint not installed, download from https://github.com/realm/SwiftLint"
fi
```

6. **Uncheck "Show environment variables in build log"** (optional, cleaner logs)

## Step 5: Verify Configuration File

The `.swiftlint.yml` file is already created in the project root. It includes:
- Basic rule configuration
- Exclusions for tests
- Reasonable limits

**Verify it's in the right place:**
- Should be at: `mobile/Riskmate/.swiftlint.yml`
- Xcode should pick it up automatically

## Step 6: Clean & Rebuild

1. **Product** → **Clean Build Folder** (Shift+Cmd+K)
2. **Product** → **Build** (Cmd+B)

## Step 7: Verify It Works

After building, you should see:
- ✅ No SwiftLint version errors
- ✅ No macro errors
- ✅ Build succeeds

**To test linting:**
- Run SwiftLint manually: `swiftlint` (in terminal, from project root)
- Or let the build phase run it automatically

## Troubleshooting

### "Macro must be enabled" Error

**Fix:** Enable macros (Step 2 above)

### "iOS 13.0 required" Error

**Fix:** Update deployment target (Step 1 above)

### SwiftLint Not Found

**Option A:** Install via Homebrew:
```bash
brew install swiftlint
```

**Option B:** Use SPM package (already added)

### Configuration Not Found

Make sure `.swiftlint.yml` is in:
- `mobile/Riskmate/.swiftlint.yml` (project root)

### Too Many Warnings

Edit `.swiftlint.yml` to:
- Disable more rules
- Increase limits (line_length, etc.)

## Recommended Settings

For a modern iOS app:
- **iOS Deployment Target: 16.0+** (for Swift Charts)
- **Enable Macros: Yes**
- **SwiftLint: Latest version**

This gives you:
- ✅ SwiftLint working
- ✅ Swift Charts working
- ✅ All modern packages working

---

## Next Steps

Once SwiftLint is working:
1. Fix any existing violations
2. Customize `.swiftlint.yml` for your team
3. Add SwiftLint to CI/CD pipeline
4. Consider adding pre-commit hooks
