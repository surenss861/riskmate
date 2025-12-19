# Demo Vertical Mapping

**How RiskMate demo scenarios map to operation types**

---

## Operation Type Presets

### Residential Trades
**Examples:** Electrical, Plumbing, HVAC, Roofing, Landscaping, Handyman, Renovation, Concrete/Paving, Waterproofing

**Demo Configuration:**
- Role: Owner
- Scenario: Normal Operations
- Message: "Stop relying on texts + memory. Prove due diligence."

**Why This Works:**
- High volume, low maturity operations
- Too many jobs in motion
- Too many crews / subs
- Insurance + incident documentation needs
- Best buyer: Owner / Ops Manager

**Demo Shows:**
- Standard job roster with risk scoring
- Operational snapshot (jobs by status/risk)
- Basic governance (who can do what)

---

### Commercial Contractors
**Examples:** Commercial construction, Multi-trade, Facilities contractors, Tenant improvements, GC + subs

**Demo Configuration:**
- Role: Safety Lead
- Scenario: Audit Review
- Message: "Governance enforcement across teams. Audit-ready by default."

**Why This Works:**
- Role complexity (multiple stakeholders)
- Subcontractor accountability
- Audit trail / enforcement matters
- Client-driven compliance
- Best buyer: VP Ops / Safety Lead

**Demo Shows:**
- Audit Summary card with capability violations
- Role-based access enforcement
- Flagged jobs and escalation
- Team accountability structure

---

### Facilities & Building Services
**Examples:** Janitorial, Window cleaning, Building maintenance, Rolling shutters/doors, Garage doors, Elevators, Locksmith, Fire/security systems, Pest control

**Demo Configuration:**
- Role: Admin
- Scenario: Audit Review
- Message: "Proof of work + compliance history, without paperwork."

**Why This Works:**
- Multi-site operations
- Service logs need to be provable
- Client compliance requirements
- SLAs and security events matter
- Best buyer: Director Ops / Compliance

**Demo Shows:**
- Audit trail emphasis
- Security events tracking
- Compliance-ready documentation
- Access & accountability structure

---

### Fire & Life Safety
**Examples:** Fire protection / Sprinklers, Fire & security systems, Life safety, Inspections

**Demo Configuration:**
- Role: Safety Lead
- Scenario: Audit Review
- Message: "If it isn't logged, it didn't happen. RiskMate makes it defensible."

**Why This Works:**
- Regulation + inspections = constant documentation pressure
- Chain of accountability is everything
- Audit trail is a real pain
- Best buyer: Owner / Compliance Manager

**Demo Shows:**
- Heavy audit trail emphasis
- Capability violation logging
- Flagged jobs for compliance review
- Immutable audit logs

---

### Infrastructure & Heavy Civil
**Examples:** Heavy civil, Utilities/underground, Pipeline, Hydrovac/excavation, Shoring, Rail/transit, Infrastructure programs, Environmental/hazmat, Industrial maintenance/shutdowns

**Demo Configuration:**
- Role: Executive
- Scenario: Insurance Packet
- Message: "Role-based enforcement + audit defensibility across high-liability field ops."

**Why This Works:**
- High liability + high consequence
- Multiple stakeholder roles
- Incident/insurance packets are routine
- Governance + audit trail = core requirement
- Best buyer: Risk / Compliance / VP Ops

**Demo Shows:**
- Insurance Packet Contents card
- Completed jobs with full audit trail
- Executive read-only oversight
- Download-ready artifacts

---

## Scenario → Operation Type Mapping

| Scenario | Best For | Shows |
|----------|----------|-------|
| **Normal Operations** | Residential Trades | Standard job roster, operational snapshot, basic governance |
| **Audit Review** | Commercial Contractors, Facilities Services, Fire & Life Safety | Audit Summary, capability violations, enforcement proof |
| **Incident** | All (but sells best to heavy liability) | Escalation Trail, flagged jobs, mitigation checklists |
| **Insurance Packet** | Infrastructure & Heavy Civil, Roofing, Waterproofing, Restoration | Packet Contents, completed jobs, download-ready artifacts |

---

## Sales Positioning by Lane

### Lane A — Residential Trades
**Pain:** Too many jobs, too many crews, no documentation system
**Solution:** "Stop relying on texts + memory. Prove due diligence."
**Demo Focus:** Normal operations, risk scoring, basic governance

### Lane B — Commercial Contractors
**Pain:** Role complexity, subcontractor accountability, client compliance
**Solution:** "Governance enforcement across teams. Audit-ready by default."
**Demo Focus:** Audit review, role enforcement, team accountability

### Lane C — Facilities & Building Services
**Pain:** Multi-site operations, service logs, client compliance
**Solution:** "Proof of work + compliance history, without paperwork."
**Demo Focus:** Audit review, security events, compliance documentation

### Lane D — Fire & Life Safety
**Pain:** Regulation pressure, accountability chain, audit trail pain
**Solution:** "If it isn't logged, it didn't happen. RiskMate makes it defensible."
**Demo Focus:** Audit review, compliance emphasis, immutable logs

### Lane E — Infrastructure & Heavy Civil
**Pain:** High liability, multiple stakeholders, insurance packets
**Solution:** "Role-based enforcement + audit defensibility across high-liability field ops."
**Demo Focus:** Insurance packet, executive oversight, download-ready artifacts

---

## URL Structure

Demo links can now include operation type:

- `/demo?operation=residential_trades`
- `/demo?operation=commercial_contractors`
- `/demo?operation=fire_life_safety&tour=1`

This auto-configures:
- Role (Owner, Safety Lead, Admin, Executive)
- Scenario (Normal, Audit Review, Incident, Insurance Packet)
- Tour steps (adaptive by role)

---

## Next Steps

1. **Create industry-specific landing pages** (optional)
   - `/demo/residential-trades`
   - `/demo/fire-life-safety`
   - Each with tailored copy but same demo

2. **Add industry-specific job examples** (optional)
   - Fire & Life Safety: "Sprinkler System Inspection"
   - Facilities: "Building Maintenance - HVAC"
   - Infrastructure: "Pipeline Safety Assessment"

3. **Map scenarios to buyer pain points**
   - Normal → "We need basic risk tracking"
   - Audit Review → "We need to prove compliance"
   - Incident → "We need escalation proof"
   - Insurance Packet → "We need insurance-ready documentation"

---

**This mapping transforms the demo from "for everyone" to "configured for your vertical" — much stronger conversion positioning.**

