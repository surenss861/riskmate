# App Store Safety Fixes

## ✅ Fixed Issues

### 1. Blockchain Claim - REMOVED
**Problem:** App Store description claimed "anchored to a public blockchain" but system only computes Merkle roots and hash-chains (not actual blockchain anchoring).

**Fix:** Updated description to:
- "Tamper-Evident Ledger"
- "Hash-chained proof records"
- "Cryptographically hashed and linked in a chain"

**Status:** ✅ App Store description updated

### 2. Auditor Mode - Server-Side Enforced
**Problem:** Auditor mode was UI-only (security theater).

**Fix:** Added server-side enforcement to all mutation endpoints:
- ✅ POST /api/jobs (job creation)
- ✅ PATCH /api/jobs/:id (job update)
- ✅ PATCH /api/jobs/:id/mitigations/:mitigationId (mitigation update)
- ✅ POST /api/jobs/:id/documents (evidence upload)
- ✅ DELETE /api/jobs/:id (job deletion)

**Behavior:** Returns 403 `AUTH_ROLE_READ_ONLY` and logs to audit trail.

**Status:** ✅ Backend enforcement complete

### 3. Offline Claims - Made Precise
**Problem:** "Works offline and syncs automatically" was too vague.

**Fix:** Updated to:
- "Capture evidence offline. Uploads sync when you're back online."

**Status:** ✅ Description updated

**TODO:** Add offline status display in evidence capture sheet (see `EVIDENCE_OFFLINE_STATUS.md`)

### 4. Screenshot Captions - Ultra-Literal
**Problem:** Captions had adjectives ("site", "immutable", "cryptographic", "designed").

**Fix:** Changed to literal, no-adjective captions:
- "Capture Evidence"
- "Proof Records"
- "Verification Details"
- "Work Records"

**Status:** ✅ Screenshot guidelines updated

---

## Summary

**Blockchain:** ✅ Removed (using accurate "hash-chained" language)
**Auditor Mode:** ✅ Server-side enforced (403 on mutations)
**Offline Claims:** ✅ Made precise (capture offline, sync online)
**Screenshots:** ✅ Ultra-literal captions (no adjectives)

---

## Next Steps

1. Add offline status display in `EvidenceCaptureSheet` showing:
   - "Queued for upload"
   - "Synced"
   - "Failed — tap to retry"

2. Test auditor mode with a user having `role = 'auditor'` to verify:
   - UI hides buttons ✅
   - Server returns 403 ✅
   - Audit log records violations ✅

3. Take screenshots with new ultra-literal captions for App Store submission.
