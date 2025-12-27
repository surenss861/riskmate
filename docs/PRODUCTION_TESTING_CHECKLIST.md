# Production Testing Checklist

## Audit-Grade Report System Verification

This checklist verifies that the report system handles all edge cases and production scenarios correctly.

---

## ✅ Test 1: Double-Click Export (Idempotency)

**Expected Behavior**: Second export within 30 seconds should reuse the first run, not create a duplicate.

**Steps**:
1. Navigate to a job report page
2. Click "Export PDF" twice rapidly (within 30 seconds)
3. Check server logs for: `Reusing existing report_run` message
4. Verify only one `report_run` was created in database

**Success Criteria**:
- ✅ Only one `report_run` record created
- ✅ Both API responses return same `report_run_id`
- ✅ Log shows idempotency hit

**Code Location**: `app/api/reports/generate/[id]/route.ts` (lines ~60-85)

---

## ✅ Test 2: Finalize with Missing Signatures (Gate Enforcement)

**Expected Behavior**: Finalization should be blocked with a clear error listing missing signature roles.

**Steps**:
1. Generate a draft report (creates `report_run`)
2. Attempt to finalize without adding signatures
3. Call `POST /api/reports/runs/[id]/finalize`

**Success Criteria**:
- ✅ Returns HTTP 400 (Bad Request)
- ✅ Response includes `missingRoles: ['prepared_by', 'reviewed_by', 'approved_by']`
- ✅ Response includes `signedRoles: []`
- ✅ Error message is clear: "Cannot finalize: missing required signatures"

**Code Location**: `app/api/reports/runs/[id]/finalize/route.ts` (lines ~60-75)

---

## ✅ Test 3: Finalize Then Attempt to Sign (Lock Enforcement)

**Expected Behavior**: After finalization, new signatures should be blocked (unless admin revocation flow).

**Steps**:
1. Generate draft report and add all required signatures
2. Finalize the report run
3. Attempt to add a new signature via `POST /api/reports/runs/[id]/signatures`
4. Test as non-admin user
5. Test as admin user (should still be blocked for new signatures, but revocation allowed)

**Success Criteria**:
- ✅ Non-admin: Returns HTTP 403 with message about finalized report
- ✅ Admin: Returns HTTP 403 (signatures locked, only revocation allowed)
- ✅ `report_run.status === 'final'` prevents new signature creation

**Code Location**: `app/api/reports/runs/[id]/signatures/route.ts` (lines ~75-90)

---

## ✅ Test 4: Mutate Job/Report Payload (Hash Verification)

**Expected Behavior**: Verify endpoint should detect data hash mismatch if job data changes after run creation.

**Steps**:
1. Generate a draft report (creates `report_run` with `data_hash`)
2. Modify job data (e.g., change job description, add hazard, update risk score)
3. Call `GET /api/reports/runs/[id]/verify`
4. Check the verification response

**Success Criteria**:
- ✅ `hash_match: false`
- ✅ `hash_mismatch_reason: "Report data has changed since this run was created"`
- ✅ `stored_hash` and `recomputed_hash` are different
- ✅ Print route logs warning if final report data changed

**Code Location**: 
- `app/api/reports/runs/[id]/verify/route.ts` (lines ~45-60)
- `app/reports/[id]/print/page.tsx` (lines ~80-95)

---

## ✅ Test 5: Final Download (Frozen Artifact)

**Expected Behavior**: Final reports should serve stored PDF artifact, not regenerate from HTML.

**Steps**:
1. Generate draft report and add all signatures
2. Finalize the report run
3. Download PDF via `GET /api/reports/runs/[id]/download`
4. Download same PDF again (multiple times)
5. Verify PDF bytes are identical

**Success Criteria**:
- ✅ Returns HTTP 200 with PDF binary
- ✅ PDF bytes are identical across multiple downloads
- ✅ Headers include `X-Report-Run-ID` and `X-Report-Status: final`
- ✅ PDF is served from storage, not regenerated
- ✅ Draft reports return JSON with message about regeneration

**Code Location**: `app/api/reports/runs/[id]/download/route.ts`

---

## ✅ Test 6: Audit Trail Logging (Traceability)

**Expected Behavior**: All operations should be logged with sufficient detail to trace the full lifecycle.

**Steps**:
1. Generate a report (check logs)
2. Add signatures (check logs)
3. Finalize (check logs)
4. Download (check logs)
5. Verify (check logs)

**Success Criteria**:
- ✅ Report creation: `Created report_run {id} for job {jobId} | hash: {short} | status: {status}`
- ✅ Signature creation: `Signature created | run: {id} | role: {role} | signer: {name}`
- ✅ Finalization: `Report run {id} finalized | job: {jobId} | hash: {short} | signed_by: {userId}`
- ✅ All logs include report_run_id for traceability
- ✅ Can trace: job → run → signatures → finalize → download

**Code Locations**:
- `app/api/reports/generate/[id]/route.ts` (line ~90)
- `app/api/reports/runs/[id]/signatures/route.ts` (line ~160)
- `app/api/reports/runs/[id]/finalize/route.ts` (line ~95)

---

## Additional Verification Tests

### Hash Stability
- Test with null values → should normalize correctly
- Test with undefined values → should normalize to null
- Test with Date objects → should use ISO UTC strings
- Test with nested objects → keys should be sorted
- Test with arrays → order should be preserved, elements normalized

**Code Location**: `lib/utils/canonicalJson.ts`

### Signature Validation
- Test oversized SVG (>100KB) → should reject
- Test SVG with script tags → should reject
- Test SVG with onclick handlers → should reject
- Test valid SVG → should accept

**Code Location**: `lib/utils/signatureValidation.ts`

### RLS Policy Verification
- Test non-org member accessing report_run → should be denied
- Test user creating signature for another user → should be denied (unless admin)
- Test signature revocation → should only allow admins

**Code Location**: `supabase/migrations/20251201000000_add_report_runs_and_signatures.sql`

---

## Production Monitoring Checklist

After deployment, monitor:

1. **Error Rates**: Watch for 400/403/500 errors on report endpoints
2. **Idempotency Hits**: Track how often duplicate runs are prevented
3. **Finalization Blocking**: Monitor how often finalization is blocked due to missing signatures
4. **Hash Mismatches**: Alert on hash mismatches in verify endpoint (indicates data drift)
5. **Storage Usage**: Monitor PDF storage growth
6. **Signature Validation Failures**: Track SVG validation rejections

---

## Quick Verification Commands

```bash
# Check report_run creation
SELECT id, job_id, status, data_hash, created_at 
FROM report_runs 
WHERE job_id = '<job_id>' 
ORDER BY created_at DESC;

# Check signatures
SELECT id, signature_role, signer_name, signed_at, revoked_at
FROM report_signatures
WHERE report_run_id = '<run_id>'
ORDER BY signed_at;

# Verify hash match
# Call: GET /api/reports/runs/<run_id>/verify

# Test finalization
# Call: POST /api/reports/runs/<run_id>/finalize

# Test download (final only)
# Call: GET /api/reports/runs/<run_id>/download
```

---

## Success Criteria Summary

✅ All 6 core tests pass  
✅ Hash stability verified across edge cases  
✅ Signature validation blocks malicious content  
✅ RLS policies enforce proper access control  
✅ Logs provide full audit trail  
✅ Final PDFs are frozen artifacts  
✅ System handles concurrency (idempotency)  
✅ Data integrity is verifiable (hash comparison)

