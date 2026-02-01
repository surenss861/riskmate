# iOS Testing Checklist - Bug Fixes Verification

## Overview
This checklist verifies all 15 bug fixes are working correctly in the iOS app.

---

## 🔴 Critical Tests (Must Pass)

### ✅ Test 1: Export File Handling
**Fix:** Removed `try?` silent failures, now throws errors explicitly

**Test Steps:**
1. Open Riskmate iOS app
2. Navigate to Operations
3. Select any job
4. Tap ••• → Export → Risk Snapshot Report
5. Tap "Generate"

**Expected Results:**
- ✅ Shows "Generating..." spinner
- ✅ If success: Shows "Export ready" toast + file appears
- ✅ If failure: Shows "Export failed: [reason]" toast (NOT silent)
- ✅ Check ~/Library/Application Support/Riskmate/exports/ for file

**How to Test Failure:**
- Turn off WiFi mid-export
- Should see error message, not silence

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

### ✅ Test 2: Thread Safety (Export State Updates)
**Fix:** Added `@MainActor` to `updateExportState`, prevents race conditions

**Test Steps:**
1. Open Operations
2. Select 3 different jobs
3. **Quickly** trigger exports for all 3 (within 2 seconds):
   - Job A → ••• → Export → Generate
   - Job B → ••• → Export → Generate
   - Job C → ••• → Export → Generate
4. Watch Xcode console for threading warnings
5. Check UI remains responsive

**Expected Results:**
- ✅ No crashes
- ✅ All 3 exports appear in Export History
- ✅ UI remains smooth (no freezing)
- ✅ No "Main actor" warnings in console
- ✅ Progress updates work correctly

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

### ✅ Test 3: Web URL Force Unwrap Safety
**Fix:** Changed `URL(string:)!` to safe initialization

**Test Steps:**
1. Open any job
2. Tap ••• → "Open in Web App"
3. Should open Safari with correct URL

**Expected Results:**
- ✅ Safari opens
- ✅ URL is https://riskmate.dev/jobs/{jobId}
- ✅ No crash (even with malformed job IDs)

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

### ✅ Test 4: Verification Chain (Backend Fix)
**Fix:** Hash computation now uses correct event data

**Test Steps:**
1. Create a new job
2. Add evidence
3. Complete controls
4. Go to Ledger tab
5. Tap any proof event
6. Check "Verified" badge

**Expected Results:**
- ✅ All events show "Verified ✓" badge
- ✅ No "Verification failed" warnings
- ✅ Chain integrity maintained

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

## 🟡 High Severity Tests

### ✅ Test 5: SQL Injection Prevention (Backend)
**Fix:** Input validation + escaping

**Test via iOS:**
1. Open Operations
2. Use search bar
3. Try searching for: `test'; DROP TABLE jobs;--`

**Expected Results:**
- ✅ Returns 0 results or safe results
- ✅ No server error
- ✅ No database corruption

**Normal search:**
- Search for "Test" should work normally

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

### ✅ Test 6: Promise Resilience (Backend)
**Fix:** Changed to `Promise.allSettled` for signed URLs

**Test Steps:**
1. Create job with multiple evidence files
2. View job detail
3. Evidence should load even if some URLs fail

**Expected Results:**
- ✅ Job detail loads
- ✅ Available evidence shown
- ✅ Missing evidence shows placeholder (not crash)

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

## 🟠 Medium Severity Tests

### ✅ Test 7: Offline Sync Exponential Backoff
**Fix:** Added exponential backoff (1s, 2s, 4s)

**Test Steps:**
1. Turn OFF WiFi
2. Create a new job (will queue for sync)
3. Turn ON WiFi
4. Watch Xcode console for retry timings

**Expected Results:**
- ✅ Retry 1: ~1 second after WiFi on
- ✅ Retry 2: ~2 seconds (if retry 1 fails)
- ✅ Retry 3: ~4 seconds (if retry 2 fails)
- ✅ Max 3 retries
- ✅ Console shows: `[OfflineCache] Retry X with backoff Y seconds`

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

### ✅ Test 8: Email Validation (Backend)
**Fix:** Added regex validation

**Test via iOS:**
1. Go to Settings → Team
2. Tap "+" to invite
3. Enter invalid email: "notanemail"
4. Tap Send

**Expected Results:**
- ✅ Shows error: "Invalid email format"
- ✅ Returns 400 status

**Valid email test:**
5. Enter "test@example.com"
6. Tap Send

**Expected Results:**
- ✅ Shows "Invite sent" success
- ✅ No error

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

## 📊 Performance Tests

### ✅ Test 9: Export Query Performance
**Fix:** Added index on `requested_at`

**Test Steps:**
1. Open Export History (if you have many exports)
2. Should load quickly (< 1 second)
3. Scroll through list smoothly

**Expected Results:**
- ✅ Fast loading
- ✅ Smooth scrolling
- ✅ No lag with large export history

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

### ✅ Test 10: Memory Leak Prevention
**Fix:** LRU cache with 1000 entry limit

**Test Steps:**
1. Generate 10+ job reports
2. Monitor memory in Xcode Instruments
3. Memory should stabilize, not grow infinitely

**Expected Results:**
- ✅ Memory usage stable
- ✅ No continuous growth
- ✅ App doesn't crash on repeated reports

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

## 🧪 Edge Case Tests

### ✅ Test 11: Invalid Date Handling
**Fix:** Date validation in subscriptions

**Test Steps:**
1. Go to Settings → Subscription
2. View subscription details
3. Should show valid dates

**Expected Results:**
- ✅ No "Invalid Date" shown
- ✅ No NaN values
- ✅ Proper error if subscription data invalid

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

### ✅ Test 12: Account Deactivation Protection
**Fix:** Double-check active user count

**Test Steps:**
1. As Owner, try Settings → Deactivate Account
2. Should be blocked if only owner

**Expected Results:**
- ✅ Shows error: "Cannot deactivate: only owner"
- ✅ Shows count of other active users
- ✅ Prevents accidental orphaning

**Status:** [ ] Pass [ ] Fail [ ] Not Tested

---

## 📋 Summary

### Test Results:
- Total Tests: 12
- Passed: ___
- Failed: ___
- Not Tested: ___

### Critical Issues:
- [ ] All critical tests passed
- [ ] No regressions found
- [ ] Ready for TestFlight

### Notes:
(Add any observations or issues found)

---

## 🚀 Next Steps

If all tests pass:
1. ✅ Update TestFlight build
2. ✅ Deploy to production
3. ✅ Monitor Sentry for crashes
4. ✅ Update changelog

If tests fail:
1. ❌ Document failure details
2. ❌ Create bug report
3. ❌ Fix and re-test
4. ❌ Do NOT deploy to production

---

**Tested by:** ___________  
**Date:** ___________  
**Build:** 1.1 (__)  
**iOS Version:** ___________  
**Device:** ___________
