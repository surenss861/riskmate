# AnyCodable Package Cleanup

## Issue
The project has both:
- **Flight-School/AnyCodable** package dependency (linked in Xcode project)
- **RMAnyCodable** local implementation (used everywhere in code)

This can cause symbol conflicts and duplicate linking warnings.

## Solution
**Keep RMAnyCodable, remove the package dependency**

We're using `RMAnyCodable` everywhere in the codebase, so we should remove the unused package.

## Steps (Manual - Xcode UI)

1. Open Xcode project: `mobile/Riskmate/Riskmate.xcodeproj`
2. Select the project in the navigator (top-level "Riskmate" item)
3. Select the **Riskmate** target
4. Go to **Package Dependencies** tab
5. Find **AnyCodable** (Flight-School)
6. Click the **-** button to remove it
7. Clean build folder: **Product → Clean Build Folder** (⇧⌘K)
8. Rebuild

**Alternative method:**
- **File → Packages → Remove Package...**
- Select **AnyCodable** (Flight-School)
- Click **Remove Package**

## Verification
After removal, verify:
- ✅ Project builds without errors
- ✅ No "duplicate symbol" warnings
- ✅ All code uses `RMAnyCodable` (not `AnyCodable`)
- ✅ No imports of `AnyCodable` package found

## Current Status
✅ Code already uses `RMAnyCodable` everywhere (in `APIEnvelope.swift`)
✅ No imports of `AnyCodable` package found
✅ Package is not used anywhere in code
⚠️ Package dependency still linked in Xcode project (needs manual removal)

## Why Keep RMAnyCodable?
- Already implemented and working
- No external dependencies
- Full control over implementation
- Matches our exact use case
