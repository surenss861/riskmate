# Future Improvements

## PDF Generator Consistency (Optional Polish)

Currently, PDF generators have inconsistent return types:
- `generateExecutiveBriefPDF`: Returns `{ buffer: Buffer; hash: string }`
- `generateLedgerExportPDF`: Returns `Buffer`
- `generateControlsPDF`, `generateAttestationsPDF`, `generateEvidenceIndexPDF`: Return `Buffer`

**Recommendation**: Standardize all PDF generators to return `{ buffer: Buffer; hash: string }` to prevent "Buffer vs object" errors and make hash computation consistent.

**Impact**: Low priority - current code works correctly, but this would prevent future mistakes.

**Implementation**:
1. Update all PDF generators to compute and return hash
2. Update `exportWorker.ts` to destructure `{ buffer, hash }` consistently
3. Remove manual hash computation in worker

## Evidence Upload Contract (Optional Hardening)

Define a strict `EvidenceUploadInput` type and validate before storage/DB writes to prevent multipart edge cases.

**Impact**: Medium priority - adds defense-in-depth for file uploads.
