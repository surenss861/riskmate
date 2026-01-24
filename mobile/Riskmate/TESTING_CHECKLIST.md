# Testing Checklist - RiskMate iOS

## ✅ A) Onboarding

### Fresh Install
- [ ] Shows trust onboarding (3 screens)
- [ ] Can navigate forward/back
- [ ] "Get Started" completes onboarding
- [ ] Stored in UserDefaults (check key: `riskmate.onboarding.seen.{userId}` or `.device`)

### Kill App → Relaunch
- [ ] Onboarding does NOT show again
- [ ] User goes directly to Operations screen

### Log Out / Switch User
- [ ] Onboarding shows for new user (if per-user storage)
- [ ] Onboarding does NOT show for returning user
- [ ] Verify key includes userId: `riskmate.onboarding.seen.{userId}`

### Migration
- [ ] Old keys (`trust_onboarding_complete`, `onboarding_complete`, `first_run_complete`) migrate automatically
- [ ] No duplicate onboarding shows

---

## ✅ B) Coach Marks

### First-Time User
- [ ] Coach mark appears on Operations screen
- [ ] Dark overlay with cutout
- [ ] "Got it" button dismisses
- [ ] Shows next coach mark after dismissal
- [ ] All 3 coach marks show sequentially

### VoiceOver
- [ ] VoiceOver focus lands on tooltip (not overlay)
- [ ] Tooltip is readable by VoiceOver
- [ ] "Got it" button is accessible
- [ ] Dark overlay is hidden from VoiceOver

### Small Screens + Dynamic Type
- [ ] Tooltip fits on iPhone SE
- [ ] Tooltip fits with XXL text size
- [ ] No clipping or overlap

### Persistence
- [ ] Coach marks never show again after completion
- [ ] Stored in UserDefaults: `riskmate.coachmarks.{key}`

---

## ✅ C) Just-in-Time Permissions

### Camera Permission
- [ ] Requested when tapping "Capture Photo"
- [ ] "Open Settings" button (not "Settings")
- [ ] Clean permission message
- [ ] Haptic on button tap
- [ ] Settings button opens iOS Settings

### Photo Library Permission
- [ ] Requested when tapping "Choose from Library"
- [ ] Same clean flow as camera

### Denied Permissions
- [ ] Shows alert with "Open Settings"
- [ ] No guilt text, just facts
- [ ] Handles gracefully (doesn't crash)

### Limited Photo Library (iOS)
- [ ] Handles limited selection gracefully
- [ ] Doesn't request full access unnecessarily

---

## ✅ D) Long-Press Actions

### Discoverability
- [ ] Hint appears once: "Tip: Long-press a job for quick actions"
- [ ] Hint dismissible with X
- [ ] Hint never shows again after dismissal
- [ ] Stored in UserDefaults: `riskmate.tips.longPressHint`

### Actions
- [ ] Long-press on job card shows context menu
- [ ] Actions: Add Evidence, View Ledger, Export Proof
- [ ] Medium haptic on long-press
- [ ] Analytics tracks action usage

### VoiceOver
- [ ] Actions available via rotor
- [ ] "Add Evidence", "View Ledger", "Export Proof" accessible
- [ ] Can trigger without long-press gesture

---

## ✅ E) Pull-to-Refresh "Anchoring..."

### State Display
- [ ] Shows "Anchoring..." only if refresh > 0.3s
- [ ] Instant refreshes don't show state (no flicker)
- [ ] Spinner + text visible
- [ ] Accessible label: "Anchoring ledger records"

### Edge Cases
- [ ] No state stacking on rapid pulls
- [ ] State cancels cleanly on navigation away
- [ ] State disappears after refresh completes
- [ ] Analytics tracks duration

### Duration
- [ ] Tracks refresh duration in milliseconds
- [ ] Logged to analytics: `refresh_duration_ms`

---

## ✅ F) Critical Risk Banner

### Display Logic
- [ ] Shows when risk score >= 90
- [ ] Shows once per job (tracked in UserDefaults)
- [ ] Stored: `riskmate.banners.criticalSeen.{jobId}`
- [ ] Analytics tracks: `critical_banner_shown`

### Positioning
- [ ] Doesn't block FAB (FAB at bottom, banner at top)
- [ ] Doesn't block scrolling
- [ ] Long-press hint shows below banner (if banner visible)

### Interaction
- [ ] "Add Proof Now" button works
- [ ] X button dismisses
- [ ] Analytics tracks: `critical_banner_clicked`
- [ ] Banner never shows again for same job

### Risk Changes
- [ ] Risk 88 → 92: Shows once ✅
- [ ] Risk stays high: Does not spam ✅
- [ ] Multiple critical jobs: Shows first one

---

## ✅ G) Accessibility

### Dynamic Type
- [ ] All screens scale to XXL text
- [ ] No clipping on large text
- [ ] Spacing adjusts appropriately
- [ ] Test with `.accessibility5` size

### VoiceOver
- [ ] All icon-only buttons have labels
- [ ] Eye icon: "Show password" / "Hide password"
- [ ] FAB: "Add Evidence" with hint
- [ ] Copy hash: "Copy hash" with hint
- [ ] Ledger checkmark: "Verified" with hint
- [ ] Offline banner: Combined label
- [ ] Coach mark tooltip: Combined label

### Reduce Motion
- [ ] Enable in iOS Settings → Accessibility → Motion
- [ ] Pulses become static
- [ ] Glow animations become static
- [ ] Springs become linear (0.1s)
- [ ] No jarring animations

### Contrast
- [ ] Orange on dark meets WCAG AA
- [ ] Muted text meets contrast requirements
- [ ] Risk colors use system colors (accessible)

---

## ✅ H) Analytics

### Events Tracked
- [ ] `onboarding_completed` - When onboarding finishes
- [ ] `evidence_capture_started` - When FAB/capture opens
- [ ] `evidence_capture_completed` - When evidence attached
- [ ] `critical_banner_shown` - When banner appears
- [ ] `critical_banner_clicked` - When user taps "Add Proof Now"
- [ ] `long_press_actions_used` - When long-press action used
- [ ] `refresh_triggered` - When pull-to-refresh
- [ ] `refresh_duration_ms` - Duration of refresh

### Verification
- [ ] Check analytics logs in console (DEBUG mode)
- [ ] Events include correct metadata
- [ ] No duplicate events

---

## ✅ I) Offline Mode

### Banner
- [ ] Shows "Offline — uploads queued"
- [ ] Shows "Last sync: X seconds ago"
- [ ] Retry button works
- [ ] Accessible (combined label)
- [ ] Non-annoying copy

### Sync Status
- [ ] "Live" with pulsing green dot (when online)
- [ ] "Offline" with grey dot (when offline)
- [ ] Pulse respects Reduce Motion

---

## ✅ J) "Verified" Explainer

### Access
- [ ] Tap ledger checkmark opens explainer
- [ ] One-sheet modal (not full onboarding)
- [ ] "Done" button dismisses
- [ ] Haptic on tap

### Content
- [ ] Explains cryptographic anchoring
- [ ] Explains chain of custody
- [ ] Explains court-grade evidence
- [ ] Trust statement present

---

## ✅ K) State Management

### UserDefaults Keys
- [ ] All keys use `riskmate.{category}.{key}` format
- [ ] Migration runs on app launch
- [ ] Old keys cleaned up
- [ ] No orphaned keys

### Race Conditions
- [ ] Refresh doesn't stack states
- [ ] Sync status updates correctly
- [ ] Banner shows only once per job
- [ ] No duplicate coach marks

---

## 📊 Test Results Template

```
Date: __________
Tester: __________
Device: __________
iOS Version: __________

Onboarding: [ ] Pass [ ] Fail - Notes: __________
Coach Marks: [ ] Pass [ ] Fail - Notes: __________
Permissions: [ ] Pass [ ] Fail - Notes: __________
Long-Press: [ ] Pass [ ] Fail - Notes: __________
Refresh State: [ ] Pass [ ] Fail - Notes: __________
Critical Banner: [ ] Pass [ ] Fail - Notes: __________
Accessibility: [ ] Pass [ ] Fail - Notes: __________
Analytics: [ ] Pass [ ] Fail - Notes: __________
Offline Mode: [ ] Pass [ ] Fail - Notes: __________
Verified Explainer: [ ] Pass [ ] Fail - Notes: __________
```

---

**Status:** Ready for testing
