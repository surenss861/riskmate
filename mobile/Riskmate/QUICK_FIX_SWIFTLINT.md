# Quick Fix: Disable SwiftLint (Temporary)

If SwiftLint macros are blocking your build, here's how to disable it:

## Option 1: Remove SwiftLint Package (Easiest)

1. **Xcode** → Project → **Package Dependencies**
2. Find **SwiftLint** in the list
3. Select it → Click **"-"** (remove)
4. Clean build folder (Shift+Cmd+K)
5. Rebuild (Cmd+B)

**Add it back later** when you're ready to use linting.

---

## Option 2: Disable SwiftLint Build Phase

1. **Select Target** → **Build Phases**
2. Expand **"Run Script"** phases
3. Find any SwiftLint script (usually named "Run SwiftLint")
4. Uncheck the checkbox next to it (disables without removing)
5. Clean & rebuild

---

## Option 3: Enable Macros (If You Want to Keep SwiftLint)

1. **Select Target** → **Build Settings**
2. Search for: `ENABLE_MACROS`
3. Set to **Yes** ✅
4. Clean & rebuild

**Note**: Requires Xcode 15+ for macro support.

---

## Recommendation

For now, **remove SwiftLint** (Option 1). You can add it back later when:
- The app is stable
- You want code quality enforcement
- You have time to configure linting rules

SwiftLint is a **nice-to-have**, not required for the app to work.
