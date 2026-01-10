# Defensibility Pass Checklist

**Status:** 🚧 **IN PROGRESS**  
**Version:** 1.0  
**Last Updated:** January 15, 2025

## 🎯 Goal: Make RiskMate a "Defensibility OS"

**Every screen answers: "Can I prove it?"** (who/when/what/why + evidence + enforcement + exportable pack)

**The upgrade isn't "add more stuff." It's make every existing thing feel court-ready, audit-ready, and impossible to hand-wave.**

---

## Core Principle: Defensibility Design System

### Global Rules (Apply to Every Page)

1. **One primary CTA per screen (orange). Everything else is secondary or in "Advanced."**
2. **Every record shows a Trust Receipt:**
   - Who did it (role + identity)
   - When (timestamp)
   - What changed (event type)
   - Why (reason / attestation / policy)
   - Integrity (tamper-evident status)
3. **Every action shows enforcement outcome:**
   - ✅ Allowed (logged)
   - ⛔ Blocked (logged)
   - ⚠ Needs review (logged)
4. **Exports always show Pack ID + deterministic fingerprint + verification badge.**

---

## Design System Components

### ✅ Created Components

1. **IntegrityBadge** - "Verified" / "Unverified" / "Mismatch" status indicator
2. **EventChip** - Canonical event type + severity badge
3. **TrustReceiptStrip** - Who/when/what/why + role indicator
4. **EnforcementBanner** - "Policy blocked this action → logged as ..."
5. **PackCard** - Pack ID, filters, contents, hashes, download
6. **EvidenceStamp** - Timestamp + uploader + file hash indicator

### Usage Examples

```tsx
// IntegrityBadge - Show ledger verification status
<IntegrityBadge 
  status="verified" 
  verifiedThrough="evt_abc123"
  lastVerified="2025-01-10T12:00:00Z"
  showDetails
/>

// EventChip - Show event type + severity
<EventChip 
  eventType="auth.role_violation"
  severity="critical"
  outcome="blocked"
  showOutcome
/>

// TrustReceiptStrip - Show who/when/what/why
<TrustReceiptStrip
  actorName="John Doe"
  actorRole="Safety Lead"
  occurredAt="2025-01-10T12:00:00Z"
  eventType="job.created"
  category="operations"
  summary="Created new job for ABC Construction"
  reason="Standard workflow"
/>

// EnforcementBanner - Show policy enforcement
<EnforcementBanner
  action="Attempted to update job status"
  blocked={true}
  eventId="evt_abc123"
  policyStatement="Executives cannot modify job records."
  actorRole="executive"
  severity="critical"
/>

// PackCard - Show proof pack metadata
<PackCard
  packId="pack_abc123"
  packType="proof"
  generatedAt="2025-01-10T12:00:00Z"
  filters={{ view: 'insurance-ready', timeRange: '30d' }}
  contents={{ ledger_pdf: true, controls_csv: true }}
  dataHash="sha256:abc123..."
  integrityStatus="verified"
/>

// EvidenceStamp - Show evidence fingerprint
<EvidenceStamp
  uploadedAt="2025-01-10T12:00:00Z"
  uploadedBy="John Doe"
  uploadedByRole="Safety Lead"
  fileHash="sha256:abc123..."
  verified={true}
/>
```

---

## Page-by-Page Defensibility Pass

### 🏠 Landing Page (`/`)

**Current State:**
- Hero: "Protect Every Job Before It Starts"
- Subhead: "Instant risk scoring, auto-mitigation checklists, and shareable PDF reports"

**Defensibility Pass Checklist:**

#### ✅ Hero Section
- [ ] **Headline swap:** "Audit-ready proof packs from everyday field work"
- [ ] **Subhead swap:** "Immutable compliance ledger + evidence chain-of-custody for high-liability ops"
- [ ] **Add integrity indicator:** Show "Ledger Contract: v1.0 (frozen)" badge in footer
- [ ] **Remove:** Generic "features" language
- [ ] **Add:** "Proof Moments" section (3 examples: incident closed → attestation → logged)

#### ✅ Proof Moments Section (NEW)
- [ ] **Incident closed → attestation created → logged**
  - Show: EventChip + TrustReceiptStrip + IntegrityBadge
  - Copy: "Every action creates evidence. Including violations."
- [ ] **Access revoked → enforcement logged**
  - Show: EnforcementBanner example
  - Copy: "Role-aware enforcement. Every denial is audit-logged."
- [ ] **Proof pack generated → hashes verified**
  - Show: PackCard example
  - Copy: "Deterministic exports. Reproducible from filters. Court-ready."

#### ✅ "Why We Win" Comparison Section (NEW)
- [ ] **Headline:** "Checklists capture data. RiskMate produces defensible proof."
- [ ] **Comparison table:**
  - Checklist apps: "Forms + exports"
  - RiskMate: "Enforcement + ledger + proof packs"
- [ ] **Key differentiator:** "Immutable audit trail" vs "Exportable logs"

#### ✅ Demo Section
- [ ] **Add:** TrustReceiptStrip to demo screenshots
- [ ] **Add:** IntegrityBadge to demo data
- [ ] **Copy swap:** "Try the product" → "See the proof"

---

### 📊 Operations Dashboard (`/operations`)

**Current State:**
- Job roster with risk scores
- KPI tiles (high risk jobs, evidence count, etc.)
- Trend charts

**Defensibility Pass Checklist:**

#### ✅ Job Roster
- [ ] **Add TrustReceiptStrip** to each job row:
  - Who created it (role + identity)
  - When it was created
  - Last modified by (role + identity)
- [ ] **Add IntegrityBadge** to job cards:
  - Show if job's audit trail is verified
  - Link to ledger events for this job
- [ ] **Add EvidenceStamp** to evidence thumbnails:
  - Show "Fingerprinted" badge
  - Show uploader + timestamp
  - Link to ledger event

#### ✅ KPI Tiles
- [ ] **Add:** "Ledger integrity" KPI tile
  - Show IntegrityBadge status
  - Link to ledger verification page
- [ ] **Copy swap:** "High risk jobs" → "Jobs requiring review"
- [ ] **Add:** "Proof packs generated" counter
  - Link to proof pack history

#### ✅ Trend Charts
- [ ] **Add:** "Enforcement actions" trend line
  - Blocked vs allowed actions over time
- [ ] **Tooltip enhancement:** Show TrustReceiptStrip on hover

---

### 🔍 Compliance Ledger (`/operations/audit`)

**Current State:**
- Event list with filters
- Saved view cards
- Advanced/Integrations menu
- Event details drawer

**Defensibility Pass Checklist:**

#### ✅ Event List
- [ ] **Replace generic event cards** with TrustReceiptStrip component
- [ ] **Add EventChip** to each event:
  - Show event type + severity + outcome
  - Link to canonical event definition
- [ ] **Add IntegrityBadge** to event header:
  - Show if event is part of verified chain
  - Show "Previous hash" pointer
- [ ] **Add EnforcementBanner** for blocked actions:
  - Show policy statement
  - Link to ledger event
  - Show actor role context

#### ✅ Event Details Drawer
- [ ] **Header:** TrustReceiptStrip (full version)
- [ ] **Enforcement section:** If blocked, show EnforcementBanner
- [ ] **Linked evidence:** Show EvidenceStamp for each linked file
- [ ] **Chain of custody:** Show previous/next event hashes
- [ ] **Integrity verification:** Show IntegrityBadge with verification path

#### ✅ Saved View Cards
- [ ] **Add:** Last pack generated (PackCard preview)
- [ ] **Add:** Integrity status indicator
- [ ] **Copy swap:** "Export CSV" → "Generate proof pack (CSV)"

#### ✅ Advanced/Integrations Menu
- [ ] **Already done:** API payload, Proof Pack moved here
- [ ] **Add:** Pack history link
- [ ] **Add:** Integrity verification status

---

### 🎫 Job Detail (`/operations/jobs/[id]`)

**Current State:**
- Job metadata, hazards, mitigations, evidence, signatures

**Defensibility Pass Checklist:**

#### ✅ Job Header
- [ ] **Add TrustReceiptStrip:**
  - Created by (role + identity) + timestamp
  - Last modified by (role + identity) + timestamp
- [ ] **Add IntegrityBadge:**
  - Show job's audit trail verification status
  - Link to job's ledger events

#### ✅ Evidence Section
- [ ] **Replace generic file list** with EvidenceStamp components:
  - Fingerprinted badge
  - Uploader + role + timestamp
  - Linked ledger events
  - Verification status
- [ ] **Sort by:** "Most defensibility impact" (missing required evidence first)

#### ✅ Signatures/Attestations
- [ ] **Add TrustReceiptStrip** to each signature:
  - Who signed (role + identity)
  - When signed (timestamp)
  - Scope of attestation
  - Linked ledger event
- [ ] **Copy swap:** "Sign off" → "Seal record"
- [ ] **Visual:** Make signatures feel "legal-ish" (not cringe)

#### ✅ Audit Trail Tab
- [ ] **Use TrustReceiptStrip** for each event
- [ ] **Use EventChip** for event types
- [ ] **Use IntegrityBadge** for chain verification
- [ ] **Show:** Previous/next hash pointers

---

### 📦 Proof Pack Generation (`/operations/audit` → Advanced/Integrations)

**Current State:**
- Generate Proof Pack button
- ZIP download with PDF + CSVs + manifest

**Defensibility Pass Checklist:**

#### ✅ Pack Generation Flow
- [ ] **Show progress stages:**
  - "Building PDFs..." → "Collecting CSVs..." → "Hashing..." → "Zipping..." → "Ready"
- [ ] **Prevent double-click:** Disable button during generation
- [ ] **Show PackCard** after completion:
  - Pack ID
  - Filters used (fingerprint)
  - Contents list
  - Data hash
  - Integrity status
  - File size + event count

#### ✅ Pack History (NEW)
- [ ] **Create:** `/operations/audit/packs` route
- [ ] **List all generated packs:**
  - PackCard for each pack
  - Sort by: Most recent first
  - Filter by: Pack type, date range
- [ ] **Actions:** Download, Regenerate (deterministic), View ledger event

---

### ⚠️ Incident Review (`/operations/audit` → Incident Review view)

**Current State:**
- Incident timeline, corrective actions, closure

**Defensibility Pass Checklist:**

#### ✅ Incident Timeline
- [ ] **Use TrustReceiptStrip** for each timeline event:
  - Detection → Response → Corrective Actions → Closure → Attestation
- [ ] **Use EnforcementBanner** for blocked escalations
- [ ] **Show:** Chain of custody (who did what when)
- [ ] **Copy swap:** "Activity log" → "Chain of custody"

#### ✅ Corrective Actions
- [ ] **Add TrustReceiptStrip:**
  - Who created (role + identity)
  - When created
  - Why (reason/policy)
  - Linked ledger event
- [ ] **Add EvidenceStamp** for linked evidence
- [ ] **Show:** Enforcement outcome (allowed/blocked)

#### ✅ Incident Closure
- [ ] **Add:** Attestation workflow (TrustReceiptStrip)
- [ ] **Add:** Final proof pack generation
- [ ] **Show:** Complete chain of custody
- [ ] **Copy swap:** "Close incident" → "Seal record"

---

### 👥 Access Review (`/operations/audit` → Access Review view)

**Current State:**
- Role changes, login events, access revocations

**Defensibility Pass Checklist:**

#### ✅ Access Changes List
- [ ] **Use TrustReceiptStrip** for each change:
  - Who requested (role + identity)
  - Who approved (if applicable)
  - When changed
  - What changed (permissions/role)
  - Why (reason/policy)
- [ ] **Use EventChip** for event type + severity
- [ ] **Show:** Separation of duties (who requested vs who approved)

#### ✅ Revoke Access Action
- [ ] **Add:** Confirm dialog with clear copy:
  - "This will revoke access immediately. This action cannot be undone."
  - "This will be logged as: `auth.access_revoked` (critical severity)"
- [ ] **After revoke:** Show EnforcementBanner:
  - Action: "Access revoked"
  - Event ID: Link to ledger
  - Policy: "Access revocation logged for audit trail"

---

### 👤 Team Management (`/operations/team`)

**Current State:**
- Team member list, invites, role management

**Defensibility Pass Checklist:**

#### ✅ Team Member List
- [ ] **Add TrustReceiptStrip** to each member:
  - When invited/added
  - Who invited them (role + identity)
  - Role assigned
  - Linked ledger event
- [ ] **Add EventChip** for role changes
- [ ] **Show:** Access review status (last reviewed date)

#### ✅ Role Changes
- [ ] **Add EnforcementBanner** if role change is blocked:
  - Policy statement
  - Event logged
- [ ] **Add:** Confirmation with copy:
  - "This will change [user]'s role to [role]. This action will be logged as `auth.role_changed`."

#### ✅ Invite Members
- [ ] **Add:** Attestation on invite:
  - "I attest that [email] has authorized access to [org]'s data."
  - This creates a ledger event

---

### 💼 Executive Dashboard (`/operations/executive`)

**Current State:**
- Risk posture, exposure level, ledger integrity

**Defensibility Pass Checklist:**

#### ✅ Risk Posture Header
- [ ] **Add IntegrityBadge** prominently:
  - Show ledger integrity status
  - Link to verification details
  - Show last verified timestamp
- [ ] **Add:** "Ledger Contract: v1.0 (frozen)" badge
- [ ] **Copy swap:** "Risk posture" → "Defensibility posture"

#### ✅ Exposure Metrics
- [ ] **Add:** "Proof packs generated" counter
  - Link to pack history
- [ ] **Add:** "Enforcement actions" breakdown
  - Blocked vs allowed (with TrustReceiptStrip examples)
- [ ] **Show:** Most recent material events (TrustReceiptStrip)

#### ✅ Ledger Integrity Section
- [ ] **Use IntegrityBadge** component
- [ ] **Show:** Verification path (event IDs)
- [ ] **Show:** Last verified timestamp
- [ ] **If mismatch:** Show EnforcementBanner with error details

---

### 💳 Pricing Page (`/pricing`)

**Current State:**
- Three tiers (Starter, Pro, Business)
- Feature comparison table

**Defensibility Pass Checklist:**

#### ✅ Hero Section
- [ ] **Headline swap:** "Defensibility that scales with your business"
- [ ] **Subhead swap:** "Court-ready proof packs. Audit-ready ledger. Insurance-defensible records."

#### ✅ Feature Comparison
- [ ] **Copy swaps:**
  - "Export reports" → "Generate proof packs"
  - "Audit logs" → "Immutable ledger"
  - "Team permissions" → "Governance enforcement"
- [ ] **Add:** "Ledger integrity" as a feature (all tiers)
- [ ] **Add:** "Proof pack verification" badge to Business tier

#### ✅ Pricing Tiers
- [ ] **Starter:** "Basic proofs"
- [ ] **Pro:** "Team governance + branded proof packs"
- [ ] **Business:** "Permit packs / advanced exports / audit controls"
- [ ] **Visual:** Show PackCard example for each tier

---

### 📄 Report View (`/reports/[id]`)

**Current State:**
- PDF report viewer
- Sections: Executive Summary, Job Summary, Risk Score, Evidence, etc.

**Defensibility Pass Checklist:**

#### ✅ Report Header
- [ ] **Add TrustReceiptStrip:**
  - Generated by (role + identity)
  - Generated at (timestamp)
  - Job ID + filters used
- [ ] **Add IntegrityBadge:**
  - Report hash verification
  - Linked ledger events
- [ ] **Add:** "Pack ID" if part of a proof pack

#### ✅ Integrity Verification Section
- [ ] **Use IntegrityBadge** component
- [ ] **Show:** Data hash (fingerprint)
- [ ] **Show:** Verification path
- [ ] **Show:** Previous report hash (if part of chain)

#### ✅ Evidence Sections
- [ ] **Use EvidenceStamp** for each evidence item:
  - Fingerprinted badge
  - Uploader + timestamp
  - Linked ledger events

---

## Copy Swaps (Global)

### Productivity Words → Defensibility Words

- [ ] "Complete checklist" → "Seal record"
- [ ] "Export report" → "Generate proof pack"
- [ ] "Activity log" → "Chain of custody"
- [ ] "Permissions" → "Governance"
- [ ] "User actions" → "Ledger events"
- [ ] "Download" → "Generate pack" (for exports)
- [ ] "Save" → "Record" (for actions that create ledger events)
- [ ] "Update" → "Mutate" (for actions that modify records)
- [ ] "Delete" → "Archive" (for soft deletes that create ledger events)

---

## QA / Reliability Polish

### Deterministic Exports
- [ ] **Every export** has deterministic filename (based on filters + timestamp)
- [ ] **Every export** includes Pack ID in filename/metadata
- [ ] **Every export** includes data hash in metadata
- [ ] **Every export** can be regenerated from same filters (same Pack ID)

### Error Taxonomy
- [ ] **Every action** has clear error codes:
  - `BACKEND_CONFIG_ERROR` → "Set BACKEND_URL in Vercel..."
  - `BACKEND_CONNECTION_ERROR` → "Backend server not accessible..."
  - `REQUEST_TIMEOUT` → "Request exceeded timeout. For long operations, use async job pattern."
- [ ] **No vague errors:** Every error has actionable copy

### Zero Broken Trust Moments
- [ ] **No silent failures:** Every action either succeeds or shows clear error
- [ ] **No orphaned data:** Every record links to ledger event
- [ ] **No missing evidence:** Required evidence clearly marked and enforced
- [ ] **No broken chains:** Integrity verification catches mismatches immediately

---

## Implementation Priority

### Phase 1: Core Components ✅
- [x] Create IntegrityBadge
- [x] Create EventChip
- [x] Create TrustReceiptStrip
- [x] Create EnforcementBanner
- [x] Create PackCard
- [x] Create EvidenceStamp
- [x] Export all from `components/shared/index.ts`

### Phase 2: High-Impact Pages
- [ ] Compliance Ledger page (`/operations/audit`)
- [ ] Job Detail page (`/operations/jobs/[id]`)
- [ ] Landing page (`/`)

### Phase 3: Medium-Impact Pages
- [ ] Operations Dashboard (`/operations`)
- [ ] Executive Dashboard (`/operations/executive`)
- [ ] Pricing page (`/pricing`)

### Phase 4: Polish & Consistency
- [ ] All remaining pages
- [ ] Global copy swaps
- [ ] Error taxonomy standardization

---

## Testing Checklist

### Component Tests
- [ ] IntegrityBadge renders correctly for all statuses
- [ ] EventChip shows correct severity + outcome
- [ ] TrustReceiptStrip formats timestamps correctly
- [ ] EnforcementBanner shows policy correctly
- [ ] PackCard displays all metadata correctly
- [ ] EvidenceStamp shows fingerprint correctly

### Integration Tests
- [ ] All components work with existing Badge/Button styles
- [ ] All components accessible (keyboard navigation, screen readers)
- [ ] All components responsive (mobile/tablet/desktop)

### User Acceptance
- [ ] Users understand what "Verified" means
- [ ] Users can find proof packs easily
- [ ] Users can verify integrity status
- [ ] Users trust the "defensibility" messaging

---

## Success Metrics

### Qualitative
- [ ] Every page feels "court-ready"
- [ ] Every action shows "proof" (who/when/what/why)
- [ ] Every export includes "verification" (Pack ID + hash)
- [ ] Users say: "This feels more defensible than [competitor]"

### Quantitative
- [ ] 100% of pages use TrustReceiptStrip for audit events
- [ ] 100% of exports include Pack ID + hash
- [ ] 100% of evidence files show EvidenceStamp
- [ ] 0% of actions fail silently (all errors actionable)

---

## Notes

- **No new features:** This is polish, not new functionality
- **Reuse existing data:** All components use existing ledger/audit data
- **Incremental:** Can be implemented page-by-page without breaking existing functionality
- **Backward compatible:** All changes are additive (don't break existing UI)

---

**Last Updated:** January 15, 2025  
**Next Review:** After Phase 2 completion

