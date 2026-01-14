# PDF Generation Deployment Checklist

## Current Status

✅ **Code fixes are complete and tested:**
- Table rendering: gap-aware width normalization, truncation, no wrapping
- Auth-gated text: "auth gated" (space instead of hyphen)
- Filter passing: complete filters object to all PDF generators
- Text sanitization: consistent across all PDFs
- All tests passing: smoke, golden path, contracts

⚠️ **Real pack PDFs are from OLD generator:**
- Uploaded PDFs (PACK-35CB8B07C6A2E0F0) still show old issues:
  - Word-splitting: "RiskM / ate", "Evidenc / e", "auth / gated"
  - Active Filters = 1 (should match actual filter count)
  - Evidence Index only shows time_range

**This is expected** - the fixes are in code but not deployed yet.

## Deployment Steps

### Step 1: Validate Current Code (Pre-Deployment)

```bash
# Run all PDF tests to confirm fixes are in code
pnpm --filter @riskmate/backend test:pdf-contracts
pnpm --filter @riskmate/backend test:pdf-smoke
pnpm --filter @riskmate/backend test:pdf-golden

# All should pass ✅
```

### Step 2: Deploy Backend to Railway

1. **Verify Railway is connected to correct branch:**
   - Railway → Backend Service → Settings → Source
   - Should be connected to `main` branch

2. **Trigger deployment:**
   - Push latest commits (if not already pushed)
   - Railway should auto-deploy, or manually trigger redeploy

3. **Verify deployment:**
   ```bash
   # Check backend health
   curl https://api.riskmate.dev/health
   
   # Should return: {"status":"ok",...}
   ```

### Step 3: Validate Old PDFs (Baseline)

Before generating new packs, validate the old ones to establish baseline:

```bash
# Find your old PDFs
find ~/Downloads ~/Desktop . -name "*PACK-35CB8B07C6A2*.pdf" -type f

# Validate them (they should show warnings/errors)
pnpm --filter @riskmate/backend validate:pdf \
  ~/Downloads/ledger_export_PACK-35CB8B07C6A2E0F0.pdf \
  ~/Downloads/evidence_index_PACK-35CB8B07C6A2E0F0.pdf

# Expected results:
# ❌ Word-splitting warnings (RiskM/ate, Evidenc/e)
# ❌ Active Filters count mismatch (if applicable)
# ⚠️  Evidence Index filter display issues
```

### Step 4: Generate Fresh Pack from Deployed Backend

1. **Generate a new pack from the UI:**
   - Go to `/operations/audit/readiness` or `/operations/audit`
   - Click "Generate proof pack"
   - Download the new ZIP

2. **Extract and validate the new PDFs:**
   ```bash
   # Extract ZIP
   unzip audit-pack-PACK-*.zip
   
   # Validate new PDFs
   pnpm --filter @riskmate/backend validate:pdf \
     ledger_export_PACK-*.pdf \
     evidence_index_PACK-*.pdf \
     controls_PACK-*.pdf \
     attestations_PACK-*.pdf
   ```

3. **Expected results (after deployment):**
   - ✅ No word-splitting warnings
   - ✅ Active Filters count matches actual filters applied
   - ✅ Evidence Index shows all active filters
   - ✅ No broken glyphs or control characters

### Step 5: Debug Active Filters Count (If Still Wrong)

If Active Filters still shows 1 when more filters are applied:

1. **Check backend logs:**
   ```
   [ledger pdf] filters being passed: {"time_range":"30d","job_id":null,...}
   ```

2. **Verify frontend is passing all filters:**
   - Open browser DevTools → Network
   - Generate pack → Check POST `/api/audit/export/pack` request
   - Verify request body includes: `job_id`, `site_id`, `category`, etc.

3. **Common issues:**
   - Frontend only sending `time_range` (others missing)
   - Frontend sending empty strings `''` instead of `null`
   - Backend route not reading all filter params

## Verification Checklist

After deployment, verify:

- [ ] Backend health endpoint returns 200
- [ ] All PDF tests pass locally
- [ ] Old PDFs show expected issues (baseline)
- [ ] New pack generated from deployed backend
- [ ] New PDFs validate clean (no word-splitting, correct filter counts)
- [ ] Evidence Index shows all active filters
- [ ] No broken glyphs in extracted text

## Troubleshooting

### Issue: Active Filters still shows 1

**Check:**
1. Backend logs: `[ledger pdf] filters being passed:`
2. Frontend request body (DevTools Network tab)
3. If only `time_range` is set → count = 1 is correct
4. If more filters should be active → frontend not passing them

**Fix:**
- Update frontend to pass all filter parameters
- Ensure backend route reads all filter params (already done in code)

### Issue: Word-splitting still occurs

**Check:**
1. Verify deployment picked up latest code (check commit SHA in Railway)
2. Check if splitting is in tables (should be fixed) or headers/metadata
3. If in headers: apply same truncation logic to header text

**Fix:**
- Redeploy if code isn't latest
- Apply `truncateToWidth()` + `lineBreak: false` to header text if needed

### Issue: Evidence Index only shows time_range

**Check:**
1. Backend logs for filters passed to `generateEvidenceIndexPDF`
2. Verify `formatFilterContext()` is being used (already in code)

**Fix:**
- Ensure filters object includes all active filters (not just time_range)
- Check `apps/backend/src/utils/pdf/proofPack.ts` line ~320

## Quick Reference

```bash
# Test locally (before deployment)
pnpm --filter @riskmate/backend test:pdf-golden

# Validate old PDFs (baseline)
pnpm --filter @riskmate/backend validate:pdf ~/Downloads/*PACK*.pdf

# Validate new PDFs (after deployment)
pnpm --filter @riskmate/backend validate:pdf ledger_export_PACK-*.pdf

# Check backend deployment
curl https://api.riskmate.dev/health
```

## Summary

**The fixes are in the code and tested.** The uploaded PDFs are from the old generator. After redeployment, new packs will have:
- ✅ No word-splitting
- ✅ Correct Active Filters count
- ✅ All filters shown in Evidence Index
- ✅ Clean text extraction

The validation pipeline ensures these fixes stay locked in.
