# PDF Validation Guide

## Overview

This guide explains how to validate real pack PDFs and diagnose issues like incorrect Active Filters counts or word-splitting.

## Quick Validation

### Validate a Real Pack PDF

```bash
# Single PDF
pnpm --filter @riskmate/backend validate:pdf path/to/ledger_export_PACK-*.pdf

# Multiple PDFs
pnpm --filter @riskmate/backend validate:pdf \
  ledger_export_PACK-*.pdf \
  evidence_index_PACK-*.pdf \
  controls_PACK-*.pdf \
  attestations_PACK-*.pdf
```

## Diagnosing Active Filters Count Issues

### Step 1: Check What Filters Are Being Passed

The `/export/pack` route logs the filters object:
```
[ledger pdf] filters being passed: {"time_range":"30d","job_id":null,"site_id":null,...}
```

**Expected behavior:**
- If only `time_range` is set → Active Filters = 1 ✅ (correct)
- If `time_range` + `job_id` + `category` are set → Active Filters = 3 ✅ (correct)

**Common issues:**
- Filters object only has `time_range` set (others are `null`) → count will be 1
- Filters come from UI as empty strings `''` instead of `null` → `countActiveFilters` correctly filters these out
- Filters object is missing keys entirely → only existing keys are counted

### Step 2: Verify Filter Passing

Check the route code (`apps/backend/src/routes/audit.ts` line ~1423):
```typescript
const pdfFilters = {
  time_range: time_range || null,
  job_id: job_id || null,
  site_id: site_id || null,
  category: category || null,
  actor_id: actor_id || null,
  severity: severity || null,
  outcome: outcome || null,
}
```

This ensures all filter keys are present (even if `null`), so `countActiveFilters()` can count correctly.

### Step 3: Check countActiveFilters Logic

The function (`apps/backend/src/utils/pdf/normalize.ts` line ~388):
```typescript
export function countActiveFilters(filters: Record<string, any>): number {
  return Object.entries(filters).filter(([_, value]) => {
    return value !== null && value !== undefined && value !== ''
  }).length
}
```

This correctly:
- Counts non-null, non-undefined, non-empty string values
- Ignores `null`, `undefined`, and `''` (empty strings)

### Step 4: Extract and Verify from Real PDF

```bash
# Extract text from PDF
pdftotext -nopgbrk -enc UTF-8 ledger_export_PACK-*.pdf - | grep -A 5 "Active Filters"

# Should show:
# Active Filters
# 3
# (or whatever the actual count is)
```

## Diagnosing Word-Splitting Issues

### Check Table Rendering

The table rendering fixes (`apps/backend/src/utils/pdf/proofPackTheme.ts`):
- ✅ Gap-aware width normalization (accounts for column gaps)
- ✅ `truncateToWidth()` with binary search (fits text within cell width)
- ✅ `lineBreak: false` (prevents wrapping inside cells)

**If you still see word-splitting:**
1. Check if it's in a table cell or header text
2. Verify `lineBreak: false` is set on the `doc.text()` call
3. Check if column width is too narrow (might need to widen specific columns)

### Extract and Check

```bash
# Extract text and look for splits
pdftotext -nopgbrk -enc UTF-8 ledger_export_PACK-*.pdf - | grep -E "RiskM|Evid|auth.*gated"

# Should NOT show:
# RiskM / ate
# Evid / ence
# auth / gated

# Should show:
# RiskMate (or truncated with ellipsis)
# Evidence
# auth gated
```

## Validation Checklist

### For Each Pack PDF:

- [ ] **Text cleanliness**: No broken glyphs, control chars, zero-width chars
- [ ] **Active Filters count**: Matches actual number of non-null filters
- [ ] **No word-splitting**: "RiskMate", "Evidence" don't split mid-word
- [ ] **Auth-gated text**: Shows "auth gated" or "auth-gated" (not broken glyph)
- [ ] **Filter display**: Evidence Index shows all active filters (not just time_range)

### For Evidence Index Specifically:

- [ ] Shows all 3 payload PDFs (ledger_export, controls, attestations)
- [ ] Lists all active filters (time_range, job_id, site_id, category, etc.)
- [ ] Hash verification section is present
- [ ] Total PDF count is correct (4: 3 payload + 1 index)

## Common Issues & Fixes

### Issue: Active Filters = 1 when more filters are applied

**Root cause:** Filters object only has `time_range` set, others are `null`

**Fix:** Check the request body being sent to `/export/pack`. Ensure all filter parameters are being passed from the frontend.

**Debug:**
```bash
# Check backend logs for:
[ledger pdf] filters being passed: {"time_range":"30d","job_id":null,...}

# If job_id, site_id, etc. are null but should have values:
# → Frontend is not passing them in the request
```

### Issue: Word-splitting still occurs

**Root cause:** Column width too narrow or text rendering outside tables

**Fix:** 
1. Check if splitting is in table cells (should be fixed)
2. If in header/metadata text, apply same truncation logic
3. Widen specific columns if needed (e.g., "RiskMate" column)

### Issue: Evidence Index only shows time_range

**Root cause:** `formatFilterContext()` or filter passing issue

**Fix:** Check `apps/backend/src/utils/pdf/proofPack.ts` line ~320 where filters are displayed. Ensure it uses `formatFilterContext(filters)` which shows all active filters.

## Running Tests

### Smoke Test (Fast)
```bash
pnpm test:pdf-smoke
```
Validates generator with synthetic data.

### Golden Path Test (All 4 PDFs)
```bash
pnpm --filter @riskmate/backend test:pdf-golden
```
Validates all 4 PDF types with fixed fixture data.

### File Validator (Real PDFs)
```bash
pnpm --filter @riskmate/backend validate:pdf path/to/*.pdf
```
Validates actual exported pack PDFs.

## CI Integration

The CI workflow (`.github/workflows/pdf-validation.yml`) runs:
1. PDF Contracts Test
2. PDF Smoke Test  
3. PDF Golden Path Test

All tests must pass for PRs to merge.
