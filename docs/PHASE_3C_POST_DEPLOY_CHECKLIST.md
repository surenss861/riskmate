# Phase 3C Post-Deploy Runtime Verification Checklist

**Last Updated:** January 10, 2026  
**Deployment Status:** ✅ Phase 3C.1 (Executive) + Phase 3C.2 (Pricing) deployed  
**Runtime Verification:** Requires authenticated test account (not a product feature — ops discipline)

---

## Quick Reference: Auth Access

**Runtime verification requires authenticated test account:**
- Public pages: `/`, `/pricing` (no auth required)
- Authed pages: `/operations/audit`, `/operations/executive` (login required)
- Use internal test account: `{your-test-account}` (or create one for release hygiene)

**Release Hygiene Note:**
Keep a single internal test user for release verification. This is ops discipline, not a product feature.

---

## A) Public Pages (No Auth Required)

### `/pricing` — Phase 3C.2 Runtime Verification (5 min)

#### Header & Hero
- [ ] "Ledger Contract v1.0 (Frozen)" badge appears below hero subtitle
- [ ] Hero title: "Defensibility Tiers" (not "Simple, Transparent Pricing")
- [ ] Hero subtitle: "Audit-ready proof packs from everyday field work. Immutable compliance ledger + evidence chain-of-custody."

#### PackCard Example Section
- [ ] "Proof Pack Example" section appears above testimonials
- [ ] Label: "Example (demo only — not a real generated pack)" is visible
- [ ] Compact PackCard renders correctly (pack ID truncated, relative time, contents summary)
- [ ] IntegrityBadge shows "Unverified" (truth-safe — demo pack is not verified)
- [ ] Description text: "Real proof packs include immutable compliance ledger, evidence chain-of-custody, and verification hash for audit defense."

#### Tier Bullets (Spot Check)
- [ ] Starter: "View-only proof packs" (not "reports")
- [ ] Pro: "Live, shareable proof packs" (not "reports")
- [ ] Business: "Immutable compliance ledger" (not "audit history")
- [ ] Business: "Generate proof packs (ZIP with verification hash)" (not "Permit Pack Generator")

#### Comparison Table
- [ ] Row: "Proof packs" (not "PDF reports")
- [ ] Row: "Compliance ledger" (not "Audit history")
- [ ] Row: "Chain of custody" exists (Complete for Business)
- [ ] Row: "Governance enforcement" exists (Full role-based for Business)
- [ ] Row: "Generate proof packs" (not "Permit Pack Generator")
- [ ] Row: "Attestations / Seal records" exists

#### FAQ & Testimonials
- [ ] FAQ: "Are my proof packs private?" (not "job reports")
- [ ] Testimonial: "documentation time" + "proof packs" (not "reporting time" + "PDFs")
- [ ] Testimonial: "proof pack feature" + "verification hash" language present

#### Mobile Viewport (2 min)
- [ ] PackCard example section stacks correctly (no horizontal scroll)
- [ ] Comparison table scrolls horizontally (expected)
- [ ] Badge + text don't wrap awkwardly

#### Banned Phrases (Visual Check)
- [ ] No "export report" visible
- [ ] No "activity log" visible
- [ ] No "user actions" visible
- [ ] No "sign-offs" (should be "Attestations / Seal records")

---

### `/` (Landing Page) — Spot Check (2 min)

#### Proof Moments Section
- [ ] "Proof Moments" section still renders correctly
- [ ] EventChip + TrustReceiptStrip + IntegrityBadge components visible
- [ ] EnforcementBanner visible (if blocked event example exists)
- [ ] PackCard visible (if proof pack example exists)
- [ ] "Ledger Contract v1.0 (Frozen)" badge present

#### Copy Consistency
- [ ] Hero: "Audit-ready proof packs from everyday field work"
- [ ] No productivity words (spot check)

---

## B) Authed Pages (Login Required)

**Login:** Use test account at `https://riskmate.vercel.app/login`

---

### `/operations/executive` — Phase 3C.1 Runtime Verification (5 min)

#### Header
- [ ] Title: "Defensibility Posture" (not "Organizational Risk Posture")
- [ ] Subtitle: "Audit-ready proof from everyday field work. Immutable compliance ledger + evidence chain-of-custody."
- [ ] "Ledger Contract v1.0 (Frozen)" badge appears below subtitle
- [ ] IntegrityBadge appears top-right of header (status: verified/unverified/mismatch based on actual ledger integrity)
- [ ] Time Range selector still functional

#### Defensibility Posture Section (4 tiles)
- [ ] **Ledger Integrity tile:**
  - [ ] IntegrityBadge visible (top-right of tile)
  - [ ] Status text matches actual ledger integrity state
  - [ ] "Hash chain verification pending" or "Verified through event..." shown correctly
  - [ ] Link to failing event works (if mismatch exists)

- [ ] **Proof Packs Generated tile:**
  - [ ] Count displays correctly
  - [ ] "View in Pack History" link appears if count > 0
  - [ ] "No proof packs generated yet. Use Pack History to generate one." if count = 0

- [ ] **Enforcement Actions tile:**
  - [ ] Blocked count displays correctly
  - [ ] "blocked attempt(s) (last 30 days)" language present
  - [ ] Sample message shows if count > 0: "Recent blocked attempts logged in Compliance Ledger"
  - [ ] No EnforcementBanner unless real blocked event data exists (truth-safe)

- [ ] **Attestations Coverage tile:**
  - [ ] "sealed" / "total" ratio displays correctly
  - [ ] "pending seal(s)" or "All records sealed" text accurate
  - [ ] Hover state works (Info icon appears)

#### Section Titles (Copy Updates)
- [ ] "Where you're exposed" → "Exposure Assessment"
- [ ] "Whether controls are working" → "Controls Status"
- [ ] "Whether proof exists" → "Defensibility Posture"

#### Copy Updates (Standardized Terms)
- [ ] "jobs" → "work records" (where appropriate)
- [ ] "attestations" uses standardized terms.plural
- [ ] "controls" uses standardized terms.plural
- [ ] "sealed" vs "pending" language consistent

#### Mobile Viewport (2 min)
- [ ] 4-column grid stacks to 1 column on mobile
- [ ] IntegrityBadge never wraps
- [ ] Tile text truncates cleanly
- [ ] No horizontal scroll

---

### `/operations/audit` — Phase 3B Runtime Verification (5 min)

#### Saved View Cards Grid
- [ ] 5 cards render in grid (desktop: 5 columns, mobile: 1 column)
- [ ] No layout jump on hover
- [ ] Active state ring visible when selected

#### IntegrityBadge (Top-Right)
- [ ] IntegrityBadge appears top-right on each card (flex-shrink-0)
- [ ] Shows "Unverified" status (truth-safe — until real verification implemented)
- [ ] Never wraps or breaks layout
- [ ] Badge is clickable/hoverable (if tooltip implemented)

#### Pack Preview Slot (Below CTA)
- [ ] Empty state: "No proof packs generated for this view yet." (when `lastPack` is null)
- [ ] Empty state styling matches PackCard (border, background, padding)
- [ ] Compact PackCard renders if `lastPack` exists (stub returns null for now)
- [ ] PackCard truncates pack ID cleanly (no overflow)
- [ ] Contents summary truncates if long
- [ ] Relative time displays correctly ("2h ago", "just now", etc.)
- [ ] No "Invalid Date" errors

#### CTA Hierarchy
- [ ] Primary orange action button is visually dominant
- [ ] Secondary CSV export button is secondary
- [ ] Pack preview appears below CTA area (doesn't interfere with button hierarchy)

#### Mobile Viewport (2 min)
- [ ] Grid stacks to 1 column (`grid-cols-1` on mobile)
- [ ] No horizontal scroll
- [ ] Pack ID truncates properly (title attribute shows full ID on hover)
- [ ] Contents summary truncates cleanly
- [ ] IntegrityBadge never wraps
- [ ] Empty state text doesn't overflow

#### Hover States
- [ ] No layout jump on card hover
- [ ] Info icons appear on hover (where implemented)
- [ ] Smooth transitions

---

## C) Edge Cases & Error States

### Loading States
- [ ] No flash of unstyled content on page load
- [ ] IntegrityBadge shows correct status on load (not flickering)

### Empty States
- [ ] All empty states use defensibility language
- [ ] No "No data" or generic messages (should be specific: "No proof packs generated for this view yet.")

### Error Handling
- [ ] If backend unreachable, error messages use defensibility terms
- [ ] No "Failed to export report" (should be "Failed to generate proof pack")
- [ ] Timeout messages don't use old terminology

---

## D) Banned Phrases Visual Sweep

**Quick check (scan with eyes, or use browser search):**

- [ ] No "export report" visible anywhere
- [ ] No "activity log" visible (should be "Chain of Custody")
- [ ] No "user actions" visible (should be "Ledger Events")
- [ ] No "sign-offs" visible (should be "Seal Record" or "Attestations")
- [ ] No "permissions" visible (should be "Governance")
- [ ] No "audit log" visible (should be "Compliance Ledger" or "Ledger Events")

**Note:** API endpoints, database column names, and route names are intentionally unchanged (per guardrails).

---

## E) Trust UI Verification ("Trust UI must never lie")

### IntegrityBadge States
- [ ] Shows "Unverified" if not actually verified (truth-safe)
- [ ] Shows "Verified" only if ledger integrity is actually verified
- [ ] Shows "Mismatch" only if there's a real integrity error
- [ ] Demo PackCard on Pricing shows "Unverified" (truth-safe — it's a demo)

### PackCard Example (Pricing Page)
- [ ] Clearly labeled as "demo only — not a real generated pack"
- [ ] IntegrityBadge shows "Unverified" (truth-safe)
- [ ] No implication that it's a real generated pack
- [ ] Description explains what real packs include

### EnforcementBanner
- [ ] Only shown when real blocked event data exists (not on placeholder counts)
- [ ] Policy statement is accurate (if shown)

---

## F) Performance & UX

### Loading Performance
- [ ] Executive page loads without layout shift
- [ ] Pricing page loads without layout shift
- [ ] PackCard example doesn't cause jank

### Accessibility (Basic Check)
- [ ] Badges and icons have accessible labels/titles
- [ ] Truncated text has `title` attribute with full text
- [ ] Buttons are keyboard accessible

---

## Runtime Verification Summary

### Pass Criteria
- [ ] All public pages (Pricing, Landing) render correctly
- [ ] All authed pages (Executive, Audit) render correctly after login
- [ ] No banned phrases visible in UI
- [ ] Trust UI is truthful (unverified shows as unverified, etc.)
- [ ] Mobile viewports work correctly (no overflow, proper stacking)
- [ ] No TypeScript/runtime errors in console
- [ ] Copy uses standardized defensibility terms throughout

### Fail Criteria (if any of these fail, fix before release)
- ❌ Banned phrases visible in UI
- ❌ False "Verified" claims (trust UI lies)
- ❌ Horizontal scroll on mobile
- ❌ Layout jump on hover
- ❌ "Invalid Date" or other runtime errors
- ❌ IntegrityBadge wraps or breaks layout

---

## Post-Deploy Actions

### If All Checks Pass
1. ✅ Mark Phase 3C as complete in project tracking
2. ✅ Update release notes: "Phase 3C: Executive + Pricing pages updated with defensibility posture and standardized terms"
3. ✅ Document auth requirement for future runtime verification: "Use test account X for authed page verification"

### If Checks Fail
1. ❌ Document specific failures (which page, what broke)
2. ❌ Fix issues in separate PR
3. ❌ Re-run this checklist after fix deployment

---

## Release Hygiene Note

**Runtime verification for authed pages requires:**
- Authenticated test account (internal, not a product feature)
- Or local dev environment with login flow
- This is ops discipline, not feature creep

**Public pages can be verified without auth:**
- `/pricing` — fully accessible
- `/` — fully accessible

---

**Last Verified:** [Date]  
**Verified By:** [Name]  
**Result:** ✅ PASS / ❌ FAIL  
**Notes:** [Any issues found]

