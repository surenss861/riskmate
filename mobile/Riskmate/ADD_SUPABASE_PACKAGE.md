# How to Add Supabase Package in Xcode (Step-by-Step)

## The Error
```
Unable to find module dependency: 'Supabase'
```

This means the Supabase Swift package is not added to your Xcode project.

## Solution: Add Package Dependency

### Method 1: Via File Menu (Recommended)

1. **In Xcode menu bar**, click: **File → Add Package Dependencies...**
   - ⚠️ **NOT** "Add Package Collection"
   - ⚠️ **NOT** "Add Local Package"
   - ✅ **MUST BE** "Add Package Dependencies..."

2. **In the search box** at the top, paste:
   ```
   https://github.com/supabase/supabase-swift
   ```

3. **Press Enter** or wait for search results

4. You should see **"supabase-swift"** in the results list

5. **Click "Add Package"** button (bottom right)

6. **Select version rule:**
   - Choose: **"Up to Next Major Version"**
   - Enter: `2.0.0`
   - Click **"Add Package"** again

7. **CRITICAL STEP - Add to Target:**
   - In the "Add to Target" section, you'll see a checkbox
   - ✅ **CHECK** the box next to **"Riskmate"**
   - This is the most common mistake - if you skip this, the package won't be linked!

8. **Click "Add Package"** to finish

### Method 2: Via Project Settings

1. **Click the project name** "Riskmate" (blue icon) in Project Navigator (left sidebar)

2. **Select the "Riskmate" project** (not the target)

3. **Click "Package Dependencies" tab** (at the top)

4. **Click the "+" button** (bottom left of Package Dependencies section)

5. **Paste URL:** `https://github.com/supabase/supabase-swift`

6. **Click "Add Package"**

7. **Select version:** "Up to Next Major Version" → `2.0.0`

8. **Click "Add Package" again**

9. **CHECK "Riskmate" target** ✅

10. **Click "Add Package"** to finish

## Verify It Worked

After adding, you should see:

1. **In Project Navigator** (left sidebar):
   - Scroll down to **"Package Dependencies"** section
   - Expand it
   - You should see **"supabase-swift"** listed
   - Expand that to see modules like "Supabase", "Auth", etc.

2. **In Project Settings:**
   - Click project → Package Dependencies tab
   - You should see "supabase-swift" with version info

## If It Still Doesn't Work

### Check 1: Target Membership
1. Select any Swift file (e.g., `AuthService.swift`)
2. Open **File Inspector** (right panel, first tab)
3. Under **"Target Membership"**, ensure **"Riskmate"** is checked ✅

### Check 2: Clean Build
1. **Product → Clean Build Folder** (Cmd+Shift+K)
2. **Product → Build** (Cmd+B)

### Check 3: Package Resolution
1. **File → Packages → Reset Package Caches**
2. **File → Packages → Resolve Package Versions**
3. Wait for resolution to complete
4. Clean and rebuild

### Check 4: Verify Package URL
The correct URL is:
```
https://github.com/supabase/supabase-swift
```

**NOT:**
- `https://github.com/supabase/supabase-swift.git` (might work, but try without .git first)
- `https://github.com/supabase/supabase-swift/` (trailing slash)

## Still Having Issues?

If you've followed all steps and it still doesn't work:

1. **Close Xcode completely**
2. **Reopen the project**
3. **Try adding the package again**

If that fails, the issue might be:
- Network/firewall blocking GitHub
- Xcode version compatibility
- Corrupted package cache

Try: **File → Packages → Reset Package Caches** then add again.
