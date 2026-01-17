# AnyCodable Package Cleanup

## Issue
The project has both:
- **Flight-School/AnyCodable** package dependency (linked but not imported)
- **RMAnyCodable** local implementation (used everywhere in code)

This can cause symbol conflicts and duplicate linking.

## Solution
Remove the AnyCodable package dependency from Xcode.

## Steps (Manual - Xcode UI)

1. Open Xcode project: `mobile/Riskmate/Riskmate.xcodeproj`
2. Select the project in the navigator
3. Go to **File → Packages → Remove Package...**
4. Select **AnyCodable** (Flight-School)
5. Click **Remove Package**
6. Clean build folder: **Product → Clean Build Folder** (⇧⌘K)
7. Rebuild

## Verification
After removal, verify:
- Project builds without errors
- No "duplicate symbol" warnings
- All code uses `RMAnyCodable` (not `AnyCodable`)

## Current Status
✅ Code already uses `RMAnyCodable` everywhere
✅ No imports of `AnyCodable` package found
⚠️ Package dependency still linked (needs manual removal in Xcode)
