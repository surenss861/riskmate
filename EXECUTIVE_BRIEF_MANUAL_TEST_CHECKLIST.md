# Executive Brief PDF - Manual Test Checklist

**Date:** January 9, 2026  
**Status:** Final closeout verification

---

## 🎯 Quick Closeout Checklist

Run these 2 things and you're done:

### 1. Run 3 Real-World Fixtures

#### Option A: Use Test Script (Recommended)
```bash
# Set environment variables
export TEST_BASE_URL="http://localhost:3000"  # or your deployed URL
export TEST_AUTH_TOKEN="your-auth-token"
export TEST_ORG_WITH_NAME="org-id-with-name"
export TEST_ORG_WITHOUT_NAME="org-id-without-name"
export TEST_ORG_STRESS="org-id-with-lots-of-content"

# Run test script
tsx scripts/test-executive-brief-closeout.ts
```

#### Option B: Manual Testing

**Fixture 1: Org with Real Name**
1. Generate PDF: `GET /api/executive/brief/pdf?time_range=30d`
2. Verify:
   - ✅ Exactly 2 pages
   - ✅ Org name appears in header (not just ID)
   - ✅ Integrity block complete
   - ✅ No extraction collisions

**Fixture 2: Org without Name (ID Fallback)**
1. Generate PDF for org with no name set
2. Verify:
   - ✅ Exactly 2 pages
   - ✅ Header shows "Org: <short-id>" (not "(name missing)")
   - ✅ Integrity block shows "(org name not set)" in metadata
   - ✅ No extraction collisions

**Fixture 3: Stress Case (Lots of Content)**
1. Generate PDF for org with:
   - Many jobs (10+)
   - Many incidents (5+)
   - Long strings in job names/sites
2. Verify:
   - ✅ Exactly 2 pages (hard lock - no overflow)
   - ✅ Content fits without wrapping artifacts
   - ✅ Integrity block complete
   - ✅ No text extraction collisions

---

### 2. Verify Endpoint End-to-End

**For each fixture above:**

1. **Extract Report ID from PDF**
   - Open generated PDF
   - Find "Report ID: RM-xxxx" in Integrity block
   - Note the ID (e.g., `RM-533e2137`)

2. **Call Verify Endpoint**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://your-domain.com/api/verify/RM-533e2137
   ```

3. **Verify Response Contains:**
   ```json
   {
     "reportId": "RM-533e2137",
     "org": "Organization Name" (or null),
     "windowStart": "2025-12-10T00:00:00.000Z",
     "windowEnd": "2026-01-09T00:00:00.000Z",
     "generatedAt": "2026-01-09T...",
     "metadataHashDeterministic": "abc123...",  // Must match PDF display
     "pdfFileHash": "def456...",                // SHA-256 of actual PDF bytes
     "verifiedAt": "2026-01-09T..."
   }
   ```

4. **Verify Hash Matches:**
   - ✅ `metadataHashDeterministic` matches the hash displayed in PDF (Integrity block)
   - ✅ `pdfFileHash` matches SHA-256 of actual PDF bytes
     ```bash
     # Compute PDF hash locally
     sha256sum generated-pdf.pdf
     # Should match pdfFileHash from API
     ```

---

## ✅ Success Criteria

All tests pass if:
- ✅ All 3 fixtures generate exactly 2 pages
- ✅ All 3 fixtures have complete Integrity blocks
- ✅ Verify endpoint returns correct metadata for all 3
- ✅ Metadata hash matches PDF display for all 3
- ✅ PDF file hash matches computed hash for all 3

---

## 🚨 If Tests Fail

1. **Page count ≠ 2:**
   - Check `build.ts` - ensure only one `doc.addPage()` call
   - Check `ensureSpace()` - must never add pages
   - Review recent changes to layout primitives

2. **Verify endpoint fails:**
   - Check `report_runs` table - ensure `packet_type = 'executive_brief'`
   - Check metadata field - ensure `metadata_hash` and `pdf_hash` are stored
   - Check report ID format (RM-xxxx vs full UUID)

3. **Hash mismatch:**
   - Metadata hash: Check PDF generation logic (should match displayed hash)
   - PDF file hash: Check if PDF is stored correctly in `report_runs.metadata.pdf_hash`

---

## 📝 Notes

- **Test script saves PDFs** to `test-outputs/` for inspection
- **CI will catch regressions** automatically (golden tests blocking)
- **This is a one-time manual check** - CI handles ongoing verification

---

**Once all tests pass: Mark as DONE and enforce freeze rule (PM approval required for changes).**

