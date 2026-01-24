# TestFlight QA Script - RiskMate iOS

**Version:** 1.0  
**Date:** 2024  
**Purpose:** Ruthless testing checklist for production readiness

---

## 📱 Device Setup

### Required Devices
- [ ] iPhone SE (small screen, iOS 16+)
- [ ] iPhone 15 Pro Max (large screen, iOS 17+)
- [ ] iPad (if supported)

### iOS Versions
- [ ] iOS 16.x
- [ ] iOS 17.x
- [ ] iOS 18.x (if available)

### System Settings
- [ ] Low Power Mode ON
- [ ] Reduce Motion ON
- [ ] VoiceOver ON
- [ ] Dynamic Type: XXL

---

## 1️⃣ Fresh Install & Onboarding

### Test: First Launch
1. Delete app completely
2. Install fresh from TestFlight
3. Launch app

**Expected:**
- [ ] App launches without crash
- [ ] Onboarding shows (3 screens: Ledger, Capture, Roles)
- [ ] Can navigate forward/back
- [ ] "Get Started" completes onboarding
- [ ] App navigates to Operations screen

**Verify:**
- [ ] Check UserDefaults: `riskmate.onboarding.seen.device` = true
- [ ] Analytics event: `onboarding_completed` fires once

### Test: Kill & Relaunch
1. Complete onboarding
2. Force quit app (swipe up)
3. Relaunch app

**Expected:**
- [ ] Onboarding does NOT show again
- [ ] Goes directly to Operations screen
- [ ] No crash on launch

### Test: Log Out / Switch User
1. Log out
2. Log in with different user
3. Check onboarding state

**Expected:**
- [ ] Onboarding shows for new user (if per-user storage)
- [ ] Onboarding does NOT show for returning user
- [ ] Verify key includes userId: `riskmate.onboarding.seen.{userId}`

---

## 2️⃣ Network & Sync Torture Tests

### Test: Airplane Mode Mid-Upload
1. Start evidence upload (photo)
2. While uploading, toggle Airplane Mode ON
3. Wait 5 seconds
4. Toggle Airplane Mode OFF

**Expected:**
- [ ] Upload pauses gracefully
- [ ] Upload resumes when network returns
- [ ] No crash
- [ ] Upload completes successfully
- [ ] Toast shows "Evidence securely attached"

**Verify:**
- [ ] Check upload state in debug overlay (if enabled)
- [ ] Analytics: `evidence_upload_failed` (if fails) or `evidence_upload_succeeded`

### Test: Wi-Fi ↔ LTE Switch Mid-Refresh
1. Start on Wi-Fi
2. Pull to refresh Operations screen
3. While refreshing, disable Wi-Fi (force LTE)
4. Wait for refresh to complete

**Expected:**
- [ ] Refresh continues on LTE
- [ ] No stuck spinner
- [ ] Jobs load successfully
- [ ] "Anchoring..." state shows if refresh > 0.3s

**Verify:**
- [ ] Analytics: `refresh_triggered` + `refresh_duration_ms`

### Test: Kill App During "Queued for Upload"
1. Start evidence upload
2. While "Queued" or "Uploading", force quit app
3. Wait 30 seconds
4. Reopen app

**Expected:**
- [ ] Upload state recovers
- [ ] Upload continues in background (if possible)
- [ ] Or upload shows as "Queued" and retries
- [ ] No duplicate uploads

**Verify:**
- [ ] Check `BackgroundUploadManager` state
- [ ] Upload completes after app reopens

### Test: Offline Banner Truth
1. Disable network (Airplane Mode)
2. Try to upload evidence
3. Check if "Offline — uploads queued" appears

**Expected:**
- [ ] Banner ONLY shows if:
  - Backend is down (`backendDown = true`)
  - AND there are queued/uploading items
- [ ] Banner does NOT show if no uploads queued
- [ ] "Last sync: X seconds ago" is accurate

**Verify:**
- [ ] Banner logic: `statusManager.backendDown && hasQueuedUploads`

---

## 3️⃣ Background & Lifecycle

### Test: Background During Refresh
1. Start pull-to-refresh
2. While "Anchoring..." is showing, push app to background
3. Wait 10 seconds
4. Return to foreground

**Expected:**
- [ ] No stuck spinner
- [ ] Refresh completes or cancels gracefully
- [ ] UI is not broken
- [ ] Can interact with app normally

### Test: Background During Camera Sheet
1. Open evidence capture sheet
2. Push app to background
3. Wait 10 seconds
4. Return to foreground

**Expected:**
- [ ] Camera sheet is still open (or dismissed gracefully)
- [ ] No broken UI
- [ ] Can continue capturing evidence

### Test: 30+ Minute Background (Token Expiry)
1. Log in
2. Push app to background
3. Wait 35+ minutes (simulate token expiry)
4. Return to foreground

**Expected:**
- [ ] App checks token expiry on foreground
- [ ] If expired, logs out gracefully
- [ ] Shows login screen
- [ ] No crash
- [ ] Can log back in

**Verify:**
- [ ] Check logs: "Token expired while backgrounded, logging out..."
- [ ] SessionManager handles expiry correctly

### Test: Background Upload Continuation
1. Start large evidence upload (video)
2. Push app to background
3. Wait 2 minutes
4. Return to foreground

**Expected:**
- [ ] Upload continues in background
- [ ] Progress updates when app foregrounds
- [ ] Upload completes successfully
- [ ] Toast shows on completion

---

## 4️⃣ Observability Checks

### Test: Analytics Event Firing
For each action, verify event fires exactly once:

**Onboarding:**
- [ ] `onboarding_completed` - fires once when onboarding completes

**Evidence:**
- [ ] `evidence_capture_started` - fires when FAB tapped
- [ ] `evidence_capture_completed` - fires when upload succeeds

**Banners:**
- [ ] `critical_banner_shown` - fires when banner appears
- [ ] `critical_banner_clicked` - fires when "Add Proof Now" tapped

**Interactions:**
- [ ] `long_press_actions_used` - fires with correct action type
- [ ] `refresh_triggered` - fires on pull-to-refresh
- [ ] `refresh_duration_ms` - fires with duration

**Verify:**
- [ ] Check console logs (DEBUG mode)
- [ ] No duplicate events
- [ ] Events include correct metadata

### Test: Debug Overlay (Dev Only)
1. Go to Settings
2. Long-press on "Version" text
3. Check debug overlay appears

**Expected:**
- [ ] Overlay shows at top-left
- [ ] Shows: Auth state, User ID, Org ID, Online status, Last Sync, Pending/Failed Uploads
- [ ] Can dismiss with X button
- [ ] Persists across app restarts (until disabled)

**Verify:**
- [ ] All values are accurate
- [ ] Updates in real-time

---

## 5️⃣ Performance & Battery

### Test: Animations Stop When Offscreen
1. Navigate to Operations screen (FAB visible)
2. Navigate away (FAB disappears)
3. Check battery usage

**Expected:**
- [ ] FAB glow animation stops when offscreen
- [ ] Live sync pulse stops when offscreen
- [ ] Ticking timestamp stops when offscreen
- [ ] No battery drain from offscreen animations

**Verify:**
- [ ] Check `onDisappear` handlers
- [ ] Check `scenePhase` handlers

### Test: Timers Stop When Tab Not Visible
1. Open Ledger screen (TickingTimestamp visible)
2. Switch to different tab
3. Wait 30 seconds
4. Return to Ledger tab

**Expected:**
- [ ] Timer stops when tab not visible
- [ ] Timer restarts when tab becomes visible
- [ ] No battery drain from hidden timers

**Verify:**
- [ ] Check `onDisappear` + `scenePhase` handlers
- [ ] Timer invalidates correctly

### Test: Low Power Mode
1. Enable Low Power Mode
2. Use app normally (capture evidence, view ledger, etc.)

**Expected:**
- [ ] App functions normally
- [ ] Animations respect Reduce Motion (if enabled)
- [ ] No crashes
- [ ] Background uploads continue

---

## 6️⃣ Accessibility

### Test: VoiceOver
1. Enable VoiceOver
2. Navigate through app

**Expected:**
- [ ] All interactive elements have labels
- [ ] Eye icon: "Show password" / "Hide password"
- [ ] FAB: "Add Evidence" with hint
- [ ] Copy hash: "Copy hash" with hint
- [ ] Ledger checkmark: "Verified" with hint
- [ ] Long-press actions available via rotor
- [ ] Coach mark tooltip is readable

**Verify:**
- [ ] Can complete full workflow with VoiceOver
- [ ] No unlabeled buttons

### Test: Dynamic Type (XXL)
1. Set text size to XXL
2. Navigate through all screens

**Expected:**
- [ ] All text scales correctly
- [ ] No clipping
- [ ] Layouts adjust appropriately
- [ ] Buttons remain tappable
- [ ] Lists scroll correctly

**Verify:**
- [ ] Test on iPhone SE (small screen)
- [ ] Test on iPhone Pro Max (large screen)

### Test: Reduce Motion
1. Enable Reduce Motion
2. Navigate through app

**Expected:**
- [ ] Pulses become static
- [ ] Glow animations become static
- [ ] Springs become linear (0.1s)
- [ ] No jarring animations
- [ ] App functions normally

---

## 7️⃣ Edge Cases

### Test: Rapid Pull-to-Refresh
1. Pull to refresh
2. Immediately pull again (before first completes)
3. Repeat 5 times rapidly

**Expected:**
- [ ] No state stacking
- [ ] Only one refresh runs
- [ ] No stuck spinner
- [ ] App remains responsive

### Test: Multiple Critical Risk Jobs
1. Create 3 jobs with risk score >= 90
2. Navigate to Operations screen

**Expected:**
- [ ] Banner shows for first critical job only
- [ ] Banner shows once per job
- [ ] Banner doesn't spam
- [ ] After dismissing, doesn't show again for same job

**Verify:**
- [ ] Check UserDefaults: `riskmate.banners.criticalSeen.{jobId}`

### Test: Camera Permission Denied
1. Deny camera permission
2. Try to capture evidence
3. Tap "Open Settings"
4. Grant permission in Settings
5. Return to app

**Expected:**
- [ ] Alert shows with "Open Settings" button
- [ ] Settings opens correctly
- [ ] Permission granted
- [ ] Can capture evidence after returning

### Test: Photo Library Limited Access
1. Grant limited photo library access
2. Try to select photo

**Expected:**
- [ ] Handles limited selection gracefully
- [ ] Doesn't request full access unnecessarily
- [ ] Can select from limited photos

---

## 8️⃣ Crash-Free Sessions

### Test: 1-Hour Session
1. Use app continuously for 1 hour:
   - Capture evidence
   - View jobs
   - View ledger
   - Export proof
   - Switch between tabs

**Expected:**
- [ ] No crashes
- [ ] No memory leaks
- [ ] App remains responsive
- [ ] Battery drain is reasonable

**Verify:**
- [ ] Check Xcode Instruments (Memory, Leaks)
- [ ] Check crash logs

### Test: Multiple App Launches
1. Launch app
2. Use briefly
3. Force quit
4. Repeat 20 times

**Expected:**
- [ ] No crashes on launch
- [ ] Session restores correctly
- [ ] No memory buildup

---

## 9️⃣ App Store Readiness

### Test: Screenshots Ready
- [ ] 3-5 screenshots prepared (dark mode, no marketing)
- [ ] Captions: "Verifiable Ledger", "Evidence Capture", "Audit-Ready Exports"

### Test: Privacy & Permissions
- [ ] Privacy policy accessible
- [ ] Terms of service accessible
- [ ] Permission strings are clear and honest

### Test: Version Info
- [ ] Version string displays correctly
- [ ] Build channel (Development/TestFlight/Production) shows correctly
- [ ] Debug overlay toggle works (dev only)

---

## 📊 Test Results Template

```
Date: __________
Tester: __________
Device: __________
iOS Version: __________

1. Fresh Install: [ ] Pass [ ] Fail - Notes: __________
2. Network Tests: [ ] Pass [ ] Fail - Notes: __________
3. Background/Lifecycle: [ ] Pass [ ] Fail - Notes: __________
4. Observability: [ ] Pass [ ] Fail - Notes: __________
5. Performance/Battery: [ ] Pass [ ] Fail - Notes: __________
6. Accessibility: [ ] Pass [ ] Fail - Notes: __________
7. Edge Cases: [ ] Pass [ ] Fail - Notes: __________
8. Crash-Free: [ ] Pass [ ] Fail - Notes: __________
9. App Store Ready: [ ] Pass [ ] Fail - Notes: __________

Critical Issues Found: __________
Non-Critical Issues: __________
Recommendation: [ ] Ship [ ] Fix Issues First
```

---

## ✅ Pass Criteria

**Must Pass All:**
- [ ] No crashes in 1-hour session
- [ ] All network torture tests pass
- [ ] Background/lifecycle tests pass
- [ ] Accessibility tests pass (VoiceOver + Dynamic Type)
- [ ] No stuck spinners or broken UI
- [ ] Offline banner only shows when truly queued
- [ ] Auth expiry recovery works
- [ ] Animations stop when offscreen

**Nice to Have:**
- [ ] Debug overlay working
- [ ] Analytics events firing correctly
- [ ] Performance is smooth (60fps)

---

**Status:** Ready for QA

**Last Updated:** 2024
