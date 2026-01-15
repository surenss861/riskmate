# Removed SwiftLint from App Target

## What I Did

I removed SwiftLint from being linked as a library dependency to your app target. SwiftLint should **never** be embedded in your app - it's a development tool that runs at build time, not a runtime library.

## Why This Fixes the Error

The error `"this target supports 12.0"` was happening because:
1. SwiftLint was linked to your app target as a library
2. When Xcode builds SwiftLint for your app, it was using iOS 12.0 as the deployment target
3. SwiftLint's dependencies (SwiftSyntax, etc.) require iOS 13.0+

By removing SwiftLint from the app target, it won't try to build SwiftLint for iOS 12.0 anymore.

## If You Want to Use SwiftLint (Optional)

If you want linting during development, you have two options:

### Option 1: Use SwiftLint as a Build Tool Plugin (Recommended)

1. **In Xcode:**
   - Project → Target "Riskmate" → Build Phases
   - Click "+" → "Run Build Tool Plug-ins"
   - Add "SwiftLintBuildToolPlugin"
   - This runs SwiftLint at build time without linking it to your app

2. **Or use a Run Script:**
   - Build Phases → "+" → "New Run Script Phase"
   - Add: `if which swiftlint >/dev/null; then swiftlint; fi`
   - Move it before "Compile Sources"

### Option 2: Install SwiftLint via Homebrew (Simplest)

```bash
brew install swiftlint
```

Then add a Run Script phase (same as above). This way SwiftLint is never part of your Xcode project.

## Current Status

✅ SwiftLint removed from app target  
✅ Build should now succeed  
✅ No iOS 12.0 deployment target conflicts  

Try building now - the errors should be gone!
