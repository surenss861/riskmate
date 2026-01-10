# Phase 2 Post-Deploy Checklist

**Date:** January 10, 2026  
**Status:** Ready for Verification  
**Deployment:** Vercel Auto-Deploy (main branch)

---

## A) Vercel Sanity Check (5 minutes)

- [ ] Confirm latest commit `d541297` is the active deployment on Vercel
- [ ] Open deployed URL and verify:
  - [ ] Landing page (`/`) loads correctly
  - [ ] `/operations/audit` loads correctly
  - [ ] `/operations/jobs/[id]` loads correctly (test with a real job ID)
- [ ] Hard refresh (Cmd/Ctrl + Shift + R) to verify no cache issues
- [ ] Check Vercel build logs for any runtime errors

---

## B) Trust Surface Verification (10 minutes)

### Landing Page Proof Moments
- [ ] All 3 Proof Moment cards render without missing props
- [ ] EventChip displays with correct severity and outcome badges
- [ ] TrustReceiptStrip shows actor name, role, timestamp, event type
- [ ] IntegrityBadge displays status correctly (verified/unverified)
- [ ] EnforcementBanner shows policy statement and event ID
- [ ] PackCard displays pack ID, filters, contents, hash, verification badge
- [ ] All components use correct colors and styling

### Audit Page (`/operations/audit`)
- [ ] Blocked events show EnforcementBanner with correct severity
- [ ] Event rows show EventChip + TrustReceiptStrip + IntegrityBadge
- [ ] Event details drawer header matches row content (no mismatched actor/time)
- [ ] Evidence list in drawer uses EvidenceStamp for each file
- [ ] Saved view cards display correctly
- [ ] Pack History drawer opens and shows PackCard entries (if implemented)

### Job Detail Page (`/operations/jobs/[id]`)
- [ ] Job header shows TrustReceiptStrip (created by / last modified)
- [ ] Job header shows IntegrityBadge with correct status (defaults to "unverified" if not verified)
- [ ] Evidence section shows EvidenceStamp for each file
- [ ] Evidence "Verified" badge only appears when `status === 'approved'`
- [ ] Sealed Records section shows TrustReceiptStrip + IntegrityBadge for each signature
- [ ] Rejected attestations show EnforcementBanner with policy statement
- [ ] Version History tab shows EventChip + TrustReceiptStrip + IntegrityBadge pattern
- [ ] Blocked events in version history show EnforcementBanner

---

## C) Mobile + Small Screens (3 minutes)

- [ ] Landing page Proof Moments section doesn't collapse weirdly on mobile
- [ ] Trust components don't overflow (long names / long eventType truncate gracefully)
- [ ] TrustReceiptStrip compact mode displays correctly on narrow screens
- [ ] EventChip badges don't wrap awkwardly
- [ ] PackCard doesn't overflow on small screens
- [ ] EnforcementBanner text wraps correctly

---

## D) Trust UI "Never Lie" Verification

- [ ] No "Verified" badges appear unless status is truly verified
- [ ] All IntegrityBadge components default to "unverified" where appropriate
- [ ] EvidenceStamp only shows verified checkmark when `verified={true}`
- [ ] No hardcoded "verified" statuses in sample data
- [ ] Empty states show correctly (no crashes when arrays are empty)
- [ ] Missing optional fields show fallbacks ("Unknown", "—", "System")

---

## Expected Issues & Fixes

### If Proof Moments Don't Render:
- Check browser console for missing import errors
- Verify all components are exported from `components/shared/index.ts`
- Check that component props match expected types

### If TrustReceiptStrip Shows Wrong Data:
- Verify `occurredAt` is ISO 8601 string format
- Check that `actorName` and `actorRole` are provided
- Ensure `category` is one of: 'governance' | 'operations' | 'access'

### If PackCard Shows Errors:
- Verify `packType` is one of: 'proof' | 'insurance' | 'audit' | 'incident' | 'compliance'
- Check that `generatedAt` is string or Date
- Ensure `filters` object has correct type

### If Build Fails on Vercel:
- Check TypeScript errors in build logs
- Verify all imports are correct
- Check for missing component exports

---

## Post-Verification Actions

If all checks pass:
- [ ] Mark Phase 2 as complete in checklist
- [ ] Begin Phase 3A (Copy swaps)

If issues found:
- [ ] Document issues in GitHub issue
- [ ] Fix and redeploy
- [ ] Re-run verification

---

**Last Updated:** January 10, 2026  
**Verified By:** [TBD]

