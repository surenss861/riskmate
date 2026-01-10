# Phase 3C: Executive + Pricing Polish

**Last Updated:** January 10, 2026  
**Status:** Planning → Ready for Implementation  
**Goal:** Transform Executive dashboard and Pricing page to feel "defensibility-first"

---

## Phase 3C.1: Executive Page (`/operations/executive`)

### Scope (No New Features)

#### 1. Replace Feature-y Tiles with Defensibility Posture
- **Current:** Feature-focused tiles (e.g., "Risk Score", "Jobs", "Mitigations")
- **New:** Defensibility posture tiles:
  - **Ledger Integrity:** IntegrityBadge + "Ledger Contract v1.0 (Frozen)" badge
  - **Proof Packs Generated:** Count + last generated pack preview (if available)
  - **Enforcement Actions:** Blocked actions + policy enforcement evidence
  - **Attestations Coverage:** Signed vs pending attestations
- **Design:** Use IntegrityBadge, PackCard, EnforcementBanner components

#### 2. Add "Ledger Contract v1.0 (Frozen)" Badge
- **Location:** Top of page (near page title or header)
- **Styling:** Matches landing page badge (subtle, non-intrusive)
- **Copy:** "Ledger Contract v1.0 (Frozen)"
- **Purpose:** Signals immutability commitment

#### 3. Add IntegrityBadge to Header
- **Location:** Top-right of page header (next to page title)
- **Status:** Based on ledger integrity (aggregate across all events)
- **Styling:** Prominent but not dominant
- **Tooltip:** Shows verification details (if available)

#### 4. Add "Proof Packs Generated" Metric
- **Location:** In defensibility posture section
- **Display:** Count + last generated pack (if available)
- **If pack exists:** Show compact PackCard preview
- **If no packs:** Show "No proof packs generated yet"
- **Data Source:** Same as saved views (stub for now, ready for backend)

#### 5. Add "Enforcement Actions" Metric
- **Location:** In defensibility posture section
- **Display:** Count of blocked actions + policy enforcement evidence
- **Show:** EnforcementBanner component (sample or real)
- **Purpose:** Demonstrates governance enforcement

#### 6. Update Copy to Defensibility Language
- **"Risk Score"** → **"Exposure Level"** (more defensibility-focused)
- **"Jobs"** → **"Work Records"** (standardized term)
- **"Mitigations"** → **"Controls"** (standardized term)
- **"Sign-offs"** → **"Attestations"** (standardized term)
- **Feature descriptions:** Use defensibility language

---

## Phase 3C.2: Pricing Page (`/pricing`)

### Scope (No New Features)

#### 1. Rewrite Tier Bullets Using Standardized Terms
- **Current:** Generic feature bullets
- **New:** Defensibility-focused bullets:
  - ✅ **"Immutable compliance ledger"** (not "audit log")
  - ✅ **"Governance enforcement"** (not "permissions")
  - ✅ **"Proof pack verification"** (not "report export")
  - ✅ **"Chain of custody"** (not "activity log")
  - ✅ **"Digital attestations"** (not "signatures")
  - ✅ **"Ledger events"** (not "user actions")

#### 2. Show Compact PackCard Example
- **Location:** In pricing tier description (Pro/Business tiers)
- **Display:** Compact PackCard component (sample data)
- **Purpose:** Visual example of proof pack
- **Styling:** Pure UI example (no backend coupling)
- **Note:** This is a static example, not live data

#### 3. Add "Ledger Contract v1.0 (Frozen)" Badge
- **Location:** Near pricing header or in Pro/Business tier highlights
- **Styling:** Matches landing page badge
- **Copy:** "Ledger Contract v1.0 (Frozen)"
- **Purpose:** Signals immutability commitment

#### 4. Update Feature Descriptions
- **"Export reports"** → **"Generate proof packs"**
- **"Activity logs"** → **"Chain of custody"**
- **"Permissions"** → **"Governance enforcement"**
- **"Signatures"** → **"Digital attestations"**
- **"User actions"** → **"Ledger events"**

---

## Implementation Plan

### Step 1: Update Executive Page (`app/operations/executive/page.tsx`)

#### A) Add Ledger Contract Badge
- **Location:** Top of page (near page title)
- **Component:** Badge with "Ledger Contract v1.0 (Frozen)" text
- **Styling:** Matches landing page badge

#### B) Add IntegrityBadge to Header
- **Location:** Top-right of page header
- **Status:** Compute from ledger integrity (stub: defaults to unverified)
- **Styling:** Prominent but not dominant

#### C) Replace Feature Tiles with Defensibility Posture
- **Replace:** "Risk Score", "Jobs", "Mitigations" tiles
- **New:** "Ledger Integrity", "Proof Packs Generated", "Enforcement Actions", "Attestations Coverage"
- **Use Components:** IntegrityBadge, PackCard (compact), EnforcementBanner

#### D) Update Copy
- **Use terms from:** `lib/copy/terms.ts`
- **Replace:** All feature-focused language with defensibility language
- **Maintain:** Same functionality, different messaging

### Step 2: Update Pricing Page (`app/pricing/page.tsx`)

#### A) Rewrite Tier Bullets
- **Use terms from:** `lib/copy/terms.ts`
- **Replace:** All old terminology with standardized terms
- **Examples:**
  - ✅ "Immutable compliance ledger"
  - ✅ "Governance enforcement"
  - ✅ "Proof pack verification"
  - ✅ "Chain of custody"

#### B) Add Compact PackCard Example
- **Location:** In Pro/Business tier description
- **Display:** Static PackCard component with sample data
- **Props:**
  ```tsx
  <PackCard
    variant="compact"
    packId="pack_sample123"
    packType="proof"
    generatedAt={new Date()}
    integrityStatus="verified"
    contents={{
      ledger_pdf: true,
      controls_csv: true,
      attestations_csv: true,
    }}
  />
  ```
- **Styling:** Non-intrusive, visual example only

#### C) Add Ledger Contract Badge
- **Location:** Near pricing header or in tier highlights
- **Component:** Badge with "Ledger Contract v1.0 (Frozen)" text
- **Styling:** Matches landing page badge

#### D) Update Feature Descriptions
- **Use terms from:** `lib/copy/terms.ts`
- **Replace:** All old terminology with standardized terms
- **Maintain:** Same functionality description, different language

---

## Files to Modify

1. **`app/operations/executive/page.tsx`**
   - Add Ledger Contract badge
   - Add IntegrityBadge to header
   - Replace feature tiles with defensibility posture
   - Update copy to use standardized terms

2. **`app/pricing/page.tsx`**
   - Rewrite tier bullets with standardized terms
   - Add compact PackCard example (sample data)
   - Add Ledger Contract badge
   - Update feature descriptions

---

## Design Constraints

### Executive Page
- **No new features:** Only UI polish + copy updates
- **Maintain functionality:** All existing metrics/data remain
- **Defensibility focus:** Transform feature-y tiles to defensibility posture
- **Component reuse:** Use IntegrityBadge, PackCard, EnforcementBanner

### Pricing Page
- **No new features:** Only copy updates + visual example
- **PackCard example:** Static/sample data (pure UI, no backend)
- **Terminology:** Use standardized terms from `lib/copy/terms.ts`
- **Badge:** Matches landing page badge styling

---

## Acceptance Criteria

### Executive Page
- [ ] Ledger Contract badge shows at top
- [ ] IntegrityBadge shows in header (top-right)
- [ ] Feature tiles replaced with defensibility posture tiles
- [ ] Proof packs generated metric shows (count + preview if available)
- [ ] Enforcement actions metric shows (count + sample banner)
- [ ] All copy uses standardized terms
- [ ] Mobile viewport: Layout doesn't break

### Pricing Page
- [ ] Tier bullets use standardized terms
- [ ] Compact PackCard example shows in Pro/Business tiers
- [ ] Ledger Contract badge shows near header
- [ ] All feature descriptions use standardized terms
- [ ] Mobile viewport: Layout doesn't break

---

## Testing Checklist

### Executive Page
- [ ] Page renders correctly
- [ ] Ledger Contract badge visible
- [ ] IntegrityBadge shows in header
- [ ] Defensibility posture tiles render
- [ ] Proof packs metric shows (empty state if no packs)
- [ ] Enforcement actions metric shows
- [ ] Mobile viewport: No overflow, layout stacks correctly

### Pricing Page
- [ ] Page renders correctly
- [ ] Tier bullets use standardized terms
- [ ] Compact PackCard example shows (sample data)
- [ ] Ledger Contract badge visible
- [ ] Feature descriptions use standardized terms
- [ ] Mobile viewport: No overflow, layout stacks correctly

---

**Phase 3C Status:** Ready for Implementation  
**Next:** After Phase 3B runtime verification passes

