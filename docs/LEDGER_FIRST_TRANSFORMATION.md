# Ledger-First Product Transformation

**Date:** January 2025  
**Status:** In Progress  
**Goal:** Transform RiskMate from "job management tool" to "Compliance Ledger platform"

## Core Principle

**The Compliance Ledger is the product. Everything else feeds it.**

## Transformation Checklist

### ✅ Phase 1: Default Route & Navigation (COMPLETE)
- [x] Change default route after login to `/operations/audit` (Compliance Ledger)
- [x] Update navigation: "Compliance Ledger" as primary entry point
- [x] Rename "Audit" nav item to "Compliance Ledger"
- [x] Rename "Operations" nav item to "Work Records"
- [x] Add immutability statement to Ledger header

### 🔄 Phase 2: Terminology Transformation (IN PROGRESS)
- [ ] Jobs → "Work Records"
- [ ] Mitigations → "Controls & Corrective Actions"
- [ ] Documents → "Evidence"
- [ ] Sign-offs → "Attestations"
- [ ] Sites → "Operational Context"
- [ ] Audit logs → "Chain of custody"
- [ ] Templates → "Playbooks" (already done)

### ⏳ Phase 3: Ledger Confirmations (PENDING)
- [ ] Add "Entry added to Ledger" confirmation after:
  - Job creation
  - Job updates
  - Mitigation updates
  - Document uploads
  - Sign-off creation
  - Flag/unflag actions
- [ ] Include link back to Ledger in all confirmations
- [ ] Show Ledger entry ID in confirmations

### ⏳ Phase 4: Audit-Grade Exports (PENDING)
- [ ] **PDF Ledger Export**
  - Date range selector
  - Site/job filters
  - Appendices with evidence links
  - Export ID and verification
- [ ] **Controls Report**
  - Mitigations + verification
  - Due dates + outcomes
  - Status summary
- [ ] **Attestation Pack**
  - Sign-offs + roles
  - Timestamps
  - Audit log references

### ⏳ Phase 5: Audit Readiness View (PENDING)
- [ ] "What's missing for audit?" view showing:
  - Missing evidence
  - Unsigned items
  - Overdue mitigations
  - Role violation attempts logged
- [ ] Single "Make audit-ready" checklist
- [ ] Progress indicator

### ⏳ Phase 6: Immutability Marketing (PENDING)
- [ ] Add immutability messaging throughout UI
- [ ] Show role separation prominently
- [ ] Display violation attempts to admins
- [ ] Add "Trust Architecture" section to homepage

## Product Narrative

**One-liner:** "RiskMate is a Compliance Ledger that turns day-to-day ops into audit-ready proof."

**3 Pillars:**
1. **Evidence** → All actions produce evidence
2. **Attestations** → Sign-offs and approvals
3. **Immutable Ledger** → Tamper-evident record

## UI Surface Area Changes

### Default Route
- **Before:** `/operations` (dashboard)
- **After:** `/operations/audit` (Compliance Ledger)

### Navigation
- **Before:** Operations | Audit | Executive View | Account | Team
- **After:** Compliance Ledger | Work Records | Risk Posture | Account | Team

### Page Titles
- **Before:** "Job Roster"
- **After:** "Work Records"

### Confirmations
- **Before:** "Job created successfully"
- **After:** "Work record created. Entry added to Compliance Ledger. [View Entry]"

## Trust Features

### Immutability Messaging
- Executive View: "Executive access is read-only by database policy"
- Ledger Header: "Immutable governance record"
- All mutation confirmations: "Entry added to Ledger"

### Role Separation
- Show role capabilities clearly
- Display violation attempts to admins
- Make executive read-only status visible

## Launch Requirements

- [ ] Seed demo data
- [ ] 1-click "Audit-ready demo export"
- [ ] Simple pricing story: Ledger + Evidence + Attestations

## Success Metrics

- Users land on Ledger first (not dashboard)
- All confirmations include Ledger links
- Audit exports are used in demos
- Buyers understand "Ledger-first" positioning

