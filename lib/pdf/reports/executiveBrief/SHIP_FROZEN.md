# Executive Brief PDF - FROZEN

**Status:** ✅ **SHIP-READY - FROZEN**

**Date:** January 9, 2026

**Version:** v1.0-executive-brief

---

## 🚫 **DO NOT MODIFY WITHOUT PM APPROVAL**

This report is **frozen**. The PDF output is locked to maintain "board-grade" credibility.

### What's Frozen:
- **2-page structure** (hard lock - exactly 2 pages, no exceptions)
- **Layout primitives** (KPI cards, Integrity block, chip rendering)
- **Text extraction patterns** (atomic lines, no wrapping artifacts)
- **Golden assertions** (all tests must pass - blocking in CI)

### Changes Require:
1. PM approval
2. Golden test updates (if intentional)
3. Full regression test (3 fixtures: real org, ID fallback, stress case)
4. Verify endpoint compatibility check

### Golden Test Gates:
- ✅ Exactly 2 pages
- ✅ No lonely "Verify:" line on Page 3
- ✅ "Decision requested:" always present
- ✅ Integrity block complete (Report ID, Window, Sources, SHA-256, Verify)
- ✅ No "Mode / rate" wrapping artifacts
- ✅ Headline exactly 2 lines at semicolon
- ✅ Deadline consistency (Decision matches Priority 1)
- ✅ No trailing separators in chips
- ✅ Atomic line rendering (no extraction collisions)

### Verification Endpoint:
- `/api/verify/[reportId]` returns:
  - `metadataHashDeterministic` (displayed in PDF)
  - `pdfFileHash` (SHA-256 of actual PDF bytes)
  - Report metadata (org, window, generatedAt)

### Test Coverage:
- Golden assertions: `lib/pdf/reports/executiveBrief/__tests__/golden-assertions.test.ts`
- CI: `.github/workflows/golden-tests.yml` (blocking on PR)

---

**This document prevents future you from reopening the wound. Respect the freeze.**

