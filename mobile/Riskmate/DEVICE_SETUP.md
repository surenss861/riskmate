# Device Setup Guide

## Quick Fix: Use iOS Simulator (Recommended for Development)

The iOS Simulator doesn't require device registration or provisioning profiles.

### Steps:
1. **Open Xcode**
2. **Select a Simulator** from the device dropdown (top toolbar)
   - Choose any iPhone (e.g., "iPhone 15 Pro")
3. **Build and Run** (⌘R or Product → Run)

That's it! The app will run in the simulator without any device registration.

---

## Option 2: Connect Physical Device (For Testing on Real Device)

If you want to test on your actual iPhone/iPad:

### Step 1: Connect Your Device
1. Connect your iPhone/iPad to your Mac via USB cable
2. Unlock your device
3. If prompted, tap "Trust This Computer" on your device

### Step 2: Register Device in Xcode
1. Open Xcode
2. Go to **Window → Devices and Simulators** (⇧⌘2)
3. Your device should appear in the left sidebar
4. If it shows "Unpaired", click "Use for Development"
5. Xcode will automatically register the device

### Step 3: Select Device in Xcode
1. In the device dropdown (top toolbar), select your connected device
2. Xcode will automatically create a provisioning profile
3. Build and Run (⌘R)

---

## Option 3: Manual Device Registration (If Automatic Fails)

If Xcode doesn't automatically register your device:

### Step 1: Get Device UDID
**Method A - From Xcode:**
1. Connect device to Mac
2. Open Xcode → Window → Devices and Simulators
3. Select your device
4. Copy the "Identifier" (this is the UDID)

**Method B - From Device:**
1. On your iPhone/iPad: Settings → General → About
2. Scroll to find "Identifier" or "UDID"
3. Long press to copy

### Step 2: Register on Apple Developer Portal
1. Go to https://developer.apple.com/account/resources/devices/list
2. Click the **+** button
3. Enter a name for your device
4. Paste the UDID
5. Click **Continue** → **Register**

### Step 3: Refresh in Xcode
1. In Xcode, go to **Xcode → Settings → Accounts**
2. Select your Apple ID
3. Click **Download Manual Profiles**
4. Clean build folder: **Product → Clean Build Folder** (⇧⌘K)
5. Build again (⌘B)

---

## Troubleshooting

### "No devices available"
- Make sure your device is unlocked
- Check that you've trusted the computer
- Try disconnecting and reconnecting the USB cable

### "Provisioning profile not found"
- Clean build folder: **Product → Clean Build Folder** (⇧⌘K)
- In Xcode Settings → Accounts, select your Apple ID → Download Manual Profiles
- Make sure "Automatically manage signing" is enabled in target settings

### "Device not registered"
- Use the iOS Simulator instead (easiest for development)
- Or follow Option 3 above to manually register

---

## Recommendation

**For development:** Use the iOS Simulator - it's faster and doesn't require device registration.

**For testing:** Connect a physical device when you need to test:
- Camera functionality
- Push notifications (when implemented)
- Performance on real hardware
- App Store submission testing
