# Quick Start Guide - Verifying Bug Fixes

## 🎯 TL;DR - Do This First

### 1. Database Migration (5 minutes)
```sql
-- Go to: https://supabase.com/dashboard/project/xwxghduwkzmzjrbpzwwq/sql
-- Copy/paste this entire block:

ALTER TABLE exports 
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

UPDATE exports 
SET requested_at = created_at 
WHERE requested_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exports_requested_at ON exports(requested_at DESC);

SELECT pg_notify('pgrst', 'reload schema');

-- Verify it worked:
\d exports
-- Look for: requested_at | timestamp with time zone | default CURRENT_TIMESTAMP
```

### 2. Backend Verification (1 minute)
```bash
# Check backend is healthy
curl https://api.riskmate.dev/v1/health

# Should return:
# {"status":"ok","commit":"...","db":"ok"}
```

### 3. iOS Quick Test (5 minutes)
```
1. Xcode → Clean Build Folder (⇧⌘K)
2. Build & Run (⌘R)
3. Operations → Any job → ••• → Export → Generate
4. Should work (no 500 error, no silent failure)
```

**If all 3 work → You're good to go! ✅**

---

## 📊 What Was Fixed?

### Critical (Must Test)
- ✅ iOS export file handling (no silent failures)
- ✅ iOS thread safety (no crashes)
- ✅ Backend hash verification (crypto fixed)

### High Priority
- ✅ SQL injection prevented
- ✅ Export creation works (no PGRST204)
- ✅ Promise failures handled gracefully

### Medium Priority
- ✅ Memory leaks fixed
- ✅ Offline sync with backoff
- ✅ Email validation

---

## 🔍 Detailed Testing

### Option A: Automated Script
```bash
cd ~/coding\ projects/riskmate
./verify_deployment.sh

# Set these for full testing:
export TEST_TOKEN="your_auth_token"
export TEST_JOB_ID="any_job_id"
./verify_deployment.sh
```

### Option B: Manual Checklist
See `IOS_TESTING_CHECKLIST.md` for comprehensive test cases.

---

## 🚨 If Something Fails

### Export Returns 500
**Problem:** Database migration not applied  
**Fix:** Run the SQL migration above

### iOS Crashes on Export
**Problem:** Old build  
**Fix:** Clean build (⇧⌘K) and rebuild

### Backend Shows Old Commit
**Problem:** Railway still deploying  
**Fix:** Wait 2-3 minutes, check again

### Tests Show Regressions
**Problem:** Bug in fix  
**Fix:** Check `BUG_FIXES_2026_02_01.md` for details, report issue

---

## 📈 Success Criteria

✅ **Minimum (Ship-Ready):**
- Database migration applied
- Export creation works (200 response)
- iOS export doesn't crash
- No PGRST204 errors

✅ **Ideal (Production-Ready):**
- All critical tests pass
- No console warnings
- Performance tests pass
- Full QA checklist complete

---

## 🎯 Next Steps After Verification

1. **Document Results:** Update `IOS_TESTING_CHECKLIST.md` with test results
2. **TestFlight:** Upload new build if tests pass
3. **Monitor:** Check logs for 24 hours post-deploy
4. **Iterate:** Address any issues found in testing

---

## 📚 References

- **Full Report:** `BUG_FIXES_2026_02_01.md`
- **iOS Checklist:** `IOS_TESTING_CHECKLIST.md`
- **Migration Guide:** `APPLY_MIGRATIONS.md`
- **Automated Script:** `verify_deployment.sh`

---

**Questions?** Check the full report or run the verification script for diagnostics.

**Ready to deploy?** Make sure all critical tests pass first!
