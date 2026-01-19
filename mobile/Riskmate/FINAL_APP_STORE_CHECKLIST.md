# Final App Store Checklist

## ✅ Completed

### 1. Read-Only Enforcement (Server-Side)
- ✅ `requireWriteAccess` middleware created
- ✅ Applied to all mutation endpoints:
  - POST /api/jobs
  - PATCH /api/jobs/:id
  - PATCH /api/jobs/:id/mitigations/:mitigationId
  - POST /api/jobs/:id/documents
  - POST /api/jobs/:id/archive
  - PATCH /api/jobs/:id/flag
  - POST /api/jobs/:id/signoffs
  - DELETE /api/jobs/:id
- ✅ Proof-pack generation allowed for auditors (read-only output)

### 2. App Store Description
- ✅ Removed "public blockchain" claim
- ✅ Updated to "Hash-chained proof records"
- ✅ Made offline claims precise: "Capture evidence offline. Uploads sync when you're back online."

### 3. Offline Status UI
- ✅ Created `EvidenceUploadStatusBar` component
- ✅ Shows: "Queued for upload" / "Uploading…" / "Synced" / "Failed — tap to retry"
- ✅ Integrated into `EvidenceCaptureSheet`

### 4. Screenshot Captions
- ✅ Ultra-literal, no adjectives:
  - "Capture Evidence"
  - "Proof Records"
  - "Verification Details"
  - "Work Records"

---

## Next Steps

1. **Test auditor mode** with a user having `role = 'auditor'`:
   - Verify UI hides buttons ✅
   - Verify server returns 403 ✅
   - Verify audit log records violations ✅

2. **Take screenshots** with new ultra-literal captions

3. **Verify offline status UI** works correctly:
   - Capture evidence offline → shows "Queued"
   - Upload starts → shows "Uploading…"
   - Upload completes → shows "Synced"
   - Upload fails → shows "Failed — tap to retry"

---

## Policy Summary

**Auditors can:**
- ✅ GET everything (read-only)
- ✅ Generate proof packs (read-only output)
- ✅ Share/copy hashes (read-only)

**Auditors cannot:**
- ❌ Create/edit/delete jobs
- ❌ Flag jobs (governance signal)
- ❌ Archive jobs
- ❌ Upload evidence
- ❌ Update mitigations
- ❌ Create signoffs

This is now **server-side enforced** via `requireWriteAccess` middleware.
