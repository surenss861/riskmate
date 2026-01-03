# PDF Packet Improvement Plan

## Current Issues

1. **Empty pages and thin content**
   - Compliance packet shows "No attestations available / No photos attached / No controls applied"
   - Empty sections create entire pages with just error messages
   - Packets feel incomplete/unprofessional

2. **Missing professional structure**
   - No headers/footers/page numbers
   - No Table of Contents
   - No Executive Summary
   - No consistent layout structure

3. **Content gaps**
   - Content doesn't match what's promised in UI
   - Missing key sections (evidence index, timelines, signatures)
   - Many sections return null (unimplemented)

4. **Missing defensibility features**
   - No Integrity & Verification page
   - No chain of custody documentation
   - No clear hash/verification presentation

5. **Visual polish needed**
   - Plain text risk scores (should be badges/gauges)
   - Poor whitespace management
   - No 2-column grids
   - Draft watermark always shows

## Improvement Roadmap

### Phase 1: Foundation (Critical) ✅ Start Here
**Priority: Compliance Packet**

1. **Conditional Rendering**
   - Skip empty sections entirely (no empty pages)
   - Replace "No X available" with defensible statements when required
   - Collapse light sections into single pages

2. **Executive Summary**
   - Add to all packets
   - Include: risk score, # hazards, % controls complete, # attestations, # evidence items

3. **Basic Structure**
   - Standard section headers
   - Better spacing/layout
   - Page breaks handled correctly

### Phase 2: Professional Structure
**All Packets**

4. **Headers & Footers**
   - Header: Logo + packet type + Job ID + Report Run ID
   - Footer: Page X of Y + generated timestamp + doc hash + "confidential"

5. **Table of Contents**
   - Generate from sections
   - Include page numbers

6. **Visual Polish**
   - Risk score badges/gauges
   - 2-column grids for Job Details + Risk Snapshot
   - Section dividers
   - Photo grids
   - Remove draft watermark for production exports

### Phase 3: Content Enhancement
**Packet-Specific**

7. **Insurance Packet**
   - Evidence index (files + timestamps + uploader + hash)
   - Timeline of key events
   - Signatures page
   - Top 5 risks with controls

8. **Audit Packet**
   - Role assignment record
   - Capability violations
   - Access governance trail
   - Export verification section

9. **Incident Packet**
   - Incident summary
   - Escalation trail
   - Accountability timeline
   - Evidence + witness statements

10. **Compliance Packet** (Enhanced)
    - Attestations with signer details
    - Checklist completion with timestamps
    - Evidence photo grid
    - Compliance status with missing items

### Phase 4: Defensibility
**All Packets**

11. **Integrity & Verification Page**
    - Report Run ID
    - Document hash (SHA-256)
    - Hash algorithm
    - "What this proves" bullets
    - Optional: QR code to verifier page

## Implementation Order

**Recommended Start: Compliance Packet (Phase 1)**
- Most visible issues
- Quickest impact
- Tests foundation patterns

Then: Insurance → Audit → Incident (as needed)

