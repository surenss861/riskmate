# Disk Space Fix Guide

## Problem
Your disk is 100% full, preventing Xcode from building.

## Quick Fixes (Do These Now)

### 1. Clean Xcode DerivedData (Frees ~3GB+)
**In Xcode:**
1. Go to **Xcode → Settings → Locations**
2. Click the arrow next to **Derived Data** path
3. Delete the `Riskmate-*` folder
4. Or delete all DerivedData folders

**Or via Terminal:**
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

### 2. Clean Xcode Archives (Frees ~1-5GB)
**In Xcode:**
1. Go to **Window → Organizer**
2. Select **Archives** tab
3. Select old archives → **Delete**

**Or via Terminal:**
```bash
rm -rf ~/Library/Developer/Xcode/Archives/*
```

### 3. Clean Build Products
**In Xcode:**
1. **Product → Clean Build Folder** (⇧⌘K)

### 4. Empty Trash
- Empty your Trash (can free significant space)

### 5. Check Large Files
```bash
# Find large files in your home directory
du -h ~ | sort -rh | head -20
```

## After Cleaning

1. **Restart Xcode**
2. **Try building again**

## Prevention

- Regularly clean DerivedData (monthly)
- Use Xcode's "Organizer" to delete old archives
- Monitor disk space: `df -h /`
