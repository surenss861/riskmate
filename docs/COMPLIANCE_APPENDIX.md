# RiskMate Compliance Appendix

**For:** Legal, Compliance, Insurance, Regulatory Reviewers  
**Version:** 1.0  
**Last Updated:** January 15, 2025

---

## Purpose

This document provides **compliance guarantees** for RiskMate: auditability, immutability, evidence chain integrity, and export reproducibility.

**Use Cases:**
- Legal review
- Insurance claims
- Regulatory compliance
- Inspector audits
- Due diligence

---

## Table of Contents

1. [Audit Trail Guarantees](#1-audit-trail-guarantees)
2. [Evidence Chain Integrity](#2-evidence-chain-integrity)
3. [Data Immutability](#3-data-immutability)
4. [Export Reproducibility](#4-export-reproducibility)
5. [Inspector Workflow Compliance](#5-inspector-workflow-compliance)
6. [Legal & Insurance Readiness](#6-legal--insurance-readiness)
7. [Data Privacy & GDPR](#7-data-privacy--gdpr)

---

## 1. Audit Trail Guarantees

### 1.1 Complete Action Logging

**Guarantee:** Every meaningful state change is logged with:
- **Who:** Actor ID and name
- **What:** Event name (canonical taxonomy)
- **When:** Precise timestamp (UTC)
- **Where:** Organization and job context
- **Why:** Metadata explaining the change

**Enforcement:**
- Database-level triggers (where applicable)
- Application-level logging (all API routes)
- No bypass possible (RLS enforced)

**Audit Log Structure:**
```sql
audit_logs (
  id: uuid (immutable, primary key)
  organization_id: uuid (scope)
  actor_id: uuid (who did it, nullable for system)
  actor_name: text (human-readable)
  event_name: text (canonical event name)
  target_type: text (resource type)
  target_id: uuid (resource ID, nullable)
  metadata: jsonb (additional context)
  created_at: timestamptz (immutable, UTC)
)
```

**Immutability:**
- `created_at` cannot be modified
- Records cannot be deleted
- Records cannot be edited
- Append-only table

---

### 1.2 Tracked Events

**Complete List (30+ event types):**

**Job Lifecycle:**
- Job created, updated, deleted, status changed

**Risk Assessment:**
- Hazards added, removed, updated
- Risk score recalculated

**Mitigation:**
- Mitigation items completed, uncompleted

**Evidence:**
- Documents uploaded, approved, rejected

**Assignments:**
- Workers assigned, unassigned

**Templates:**
- Templates created, applied, archived, duplicated

**Reports:**
- PDF reports generated, shared
- Permit packs generated

**Team:**
- Users invited, joined, removed, role changed

**Subscriptions:**
- Plans created, upgraded, downgraded, cancelled

**See:** `DEVELOPER_CONTRACT.md` Section 1.1 for complete taxonomy.

---

### 1.3 Audit Log Access

**Who Can Access:**
- Organization members (read-only)
- Cannot be restricted or hidden
- Cannot be deleted or modified

**Export:**
- Full audit log export available (JSON/CSV)
- Filtered by date range, event type, actor
- Includes all metadata

**Retention:**
- Permanent (no automatic deletion)
- Required for compliance and legal protection

---

## 2. Evidence Chain Integrity

### 2.1 Document Immutability

**Guarantee:** Once uploaded, documents cannot be:
- Modified
- Deleted (soft delete only, preserves audit trail)
- Replaced without new upload

**Storage:**
- Supabase Storage (immutable file paths)
- Versioned by timestamp
- Original file always preserved

**Verification Workflow:**
```
Upload → Pending → Approved/Rejected
         ↓
    Immutable Status
```

**Once Approved:**
- Status cannot be changed without new verification
- Original verification record preserved
- New verification creates new record (history maintained)

---

### 2.2 Evidence Metadata

**Guaranteed Metadata:**
- **Uploader:** User ID and name
- **Upload Time:** Precise timestamp (UTC)
- **File Hash:** SHA-256 (for integrity verification)
- **GPS Location:** If available from photo EXIF
- **File Type:** MIME type
- **File Size:** Bytes

**Storage:**
```sql
documents (
  id: uuid (immutable)
  job_id: uuid (links to job)
  file_name: text
  file_path: text (Supabase Storage path)
  file_type: text (MIME)
  file_size: integer
  uploaded_by: uuid (actor)
  gps_location: jsonb (lat/lng)
  created_at: timestamptz (immutable)
)
```

---

### 2.3 Verification Chain

**Guarantee:** Every evidence verification is:
- **Logged:** Audit log entry created
- **Attributed:** Reviewer ID and name recorded
- **Timestamped:** Precise verification time (UTC)
- **Reasoned:** Rejection reasons preserved (if applicable)
- **Immutable:** Cannot be edited or deleted

**Verification Record:**
```sql
evidence_verifications (
  id: uuid (immutable)
  job_id: uuid
  document_id: uuid
  status: text ('pending' | 'approved' | 'rejected')
  reviewed_by: uuid (actor)
  reviewed_at: timestamptz (immutable)
  rejection_reason: text (optional, preserved)
  created_at: timestamptz (immutable)
  updated_at: timestamptz (immutable, auto-updated)
)
```

**Chain of Custody:**
1. Document uploaded → `evidence.uploaded` logged
2. Manager reviews → `evidence.approved` or `evidence.rejected` logged
3. Status change creates new verification record (history preserved)

---

## 3. Data Immutability

### 3.1 Immutable Records

**Guarantee:** These records cannot be modified or deleted:

1. **Audit Logs:**
   - Append-only table
   - No UPDATE or DELETE operations allowed
   - `created_at` is immutable

2. **Evidence Verifications:**
   - Once created, cannot be deleted
   - Status changes create new records
   - History preserved

3. **Permit Packs:**
   - Generated ZIP files are immutable
   - Cannot be edited after generation
   - Each generation creates new version

4. **Version History:**
   - Read-only view of audit logs
   - Cannot be edited or deleted

---

### 3.2 Mutable Records (With Audit Trail)

**These can be modified, but changes are logged:**

1. **Jobs:**
   - Can be updated
   - Every update logs `job.updated` with old/new values
   - Deletion is soft delete (preserves audit trail)

2. **Mitigation Items:**
   - Completion status can change
   - Every change logs `mitigation.completed` or `mitigation.uncompleted`

3. **Templates:**
   - Can be edited or archived
   - Changes logged: `template.archived`, `template.updated`

**Key Principle:** If it can change, the change is logged.

---

### 3.3 Soft Deletes

**Guarantee:** Critical records use soft delete:

- **Jobs:** `deleted_at` timestamp (not removed from database)
- **Documents:** `deleted_at` timestamp (file preserved in storage)
- **Templates:** `archived` boolean (hidden, not deleted)

**Rationale:** Preserves audit trail and allows recovery if needed.

---

## 4. Export Reproducibility

### 4.1 Permit Pack Reproducibility

**Guarantee:** Generating a permit pack for the same job at different times produces identical contents (if job data unchanged).

**What's Included (Deterministic):**
- PDF report (generated from current job state)
- CSVs (hazards, controls, signatures)
- JSON (job details, metadata)
- Photos (organized by folder)
- Documents (all uploaded files)

**What's NOT Included (Non-Deterministic):**
- Timestamps in filenames (but metadata includes generation time)
- Signed download URLs (expire, but file path is stable)

**Reproducibility Test:**
```
Job State A → Generate Pack 1 → Contents X
Job State A → Generate Pack 2 → Contents X (identical)
Job State B → Generate Pack 3 → Contents Y (different, expected)
```

---

### 4.2 PDF Report Reproducibility

**Guarantee:** Generating a PDF report for the same job produces identical content (if job data unchanged).

**Report Contents (Deterministic):**
- Job details (client, location, dates)
- Risk score and level
- Hazard breakdown
- Mitigation checklist (with completion status)
- Evidence gallery
- Version history summary

**Report Contents (Non-Deterministic):**
- Generation timestamp (included in report)
- Signed download URL (expires)

---

### 4.3 Data Export

**Guarantee:** Users can export all their data in standard formats.

**Export Formats:**
- **JSON:** Complete job data, audit logs, metadata
- **CSV:** Tabular data (jobs, hazards, mitigations)
- **ZIP:** Permit pack format (all files)

**Export Contents:**
- All jobs (with full history)
- All documents (download links)
- All audit logs
- All templates
- Team member list
- Subscription history

**Export Process:**
1. User requests export
2. System generates export file
3. User downloads (one-time link, expires in 7 days)
4. Export logged: `data.exported`

---

## 5. Inspector Workflow Compliance

### 5.1 Inspector Requirements

**What Inspectors Need:**
1. Complete job documentation
2. Risk assessment with calculations
3. Evidence of safety measures taken
4. Audit trail of who did what, when
5. Reproducible reports

**How RiskMate Delivers:**

✅ **Complete Documentation:**
- All job details captured
- All hazards identified
- All mitigations tracked
- All evidence linked

✅ **Risk Assessment:**
- Transparent scoring algorithm
- Weighted severity system
- Risk level thresholds documented
- Factor breakdown included

✅ **Evidence:**
- Photos with GPS metadata (if available)
- Documents with timestamps
- Verification workflow (manager approval)
- Chain of custody preserved

✅ **Audit Trail:**
- Every action logged
- Who/when/why recorded
- Immutable history
- Exportable for review

✅ **Reproducible Reports:**
- PDF reports are deterministic
- Permit packs are reproducible
- Export formats are standard

---

### 5.2 Inspector-Friendly Features

**One-Click Reports:**
- "View Audit-Ready Report" button
- Generates complete PDF instantly
- Includes everything inspector needs

**Permit Packs:**
- ZIP archive with all documentation
- Organized folders (photos, documents)
- CSVs for data analysis
- JSON for programmatic access

**Version History:**
- Complete timeline of changes
- Human-readable descriptions
- Clickable references
- Date-grouped for easy scanning

**Evidence Verification:**
- Manager approval workflow
- Rejection reasons documented
- Status clearly indicated
- Timestamps preserved

---

## 6. Legal & Insurance Readiness

### 6.1 Legal Protection

**Guarantee:** RiskMate documentation is legally defensible.

**Key Features:**
- **Immutable Audit Trail:** Cannot be tampered with
- **Timestamped Actions:** Precise UTC timestamps
- **Attributed Actions:** Who did what is recorded
- **Evidence Chain:** Complete chain of custody
- **Export Capability:** Data can be exported for legal proceedings

**Use Cases:**
- **Workplace Accidents:** Prove safety measures were taken
- **Insurance Claims:** Document compliance with requirements
- **Regulatory Compliance:** Demonstrate adherence to regulations
- **Legal Disputes:** Provide evidence in court

---

### 6.2 Insurance Claims

**Guarantee:** RiskMate documentation supports insurance claims.

**What Insurers Need:**
1. Proof of safety measures
2. Risk assessment documentation
3. Evidence of compliance
4. Audit trail of actions taken

**How RiskMate Provides:**

✅ **Risk Assessment:**
- Calculated risk scores
- Identified hazards
- Required mitigations
- Completion tracking

✅ **Evidence:**
- Photos of safety measures
- Documents (permits, certificates)
- Verification status
- Timestamps

✅ **Audit Trail:**
- Complete history of actions
- Who performed each action
- When actions were taken
- Why actions were taken (metadata)

✅ **Reports:**
- PDF reports for submission
- Permit packs for comprehensive documentation
- Exportable data for analysis

---

### 6.3 Regulatory Compliance

**Guarantee:** RiskMate supports regulatory compliance requirements.

**Common Regulations:**
- **OSHA (US):** Workplace safety documentation
- **WorkSafe (AU/NZ):** Risk assessment requirements
- **HSE (UK):** Health and safety documentation
- **Local Regulations:** Permit requirements, inspections

**How RiskMate Helps:**
- Complete documentation of hazards
- Risk assessment with calculations
- Mitigation tracking
- Evidence preservation
- Audit trail maintenance

---

## 7. Data Privacy & GDPR

### 7.1 Data Ownership

**Guarantee:** Users own their data.

**Rights:**
- **Access:** Users can view all their data
- **Export:** Users can export all their data
- **Deletion:** Users can request data deletion
- **Portability:** Data export in standard formats

---

### 7.2 Data Retention

**Policy:**
- **Active Accounts:** Data retained indefinitely
- **Cancelled Accounts:** Data retained for 90 days, then deleted
- **Audit Logs:** Retained permanently (compliance requirement)
- **Exports:** User-requested exports expire after 7 days

**Deletion Process:**
1. User requests deletion
2. System marks account for deletion
3. 90-day grace period (for recovery)
4. Data deleted (except audit logs, which are permanent)

---

### 7.3 Data Security

**Guarantee:** Data is protected at multiple levels.

**Security Measures:**
- **Encryption at Rest:** All data encrypted in database
- **Encryption in Transit:** HTTPS/TLS for all connections
- **Row-Level Security:** Database-level access control
- **Authentication:** Secure session management
- **Authorization:** Role-based access control

**Compliance:**
- **GDPR:** Data export/deletion available
- **SOC 2:** Security controls in place (aspirational)
- **ISO 27001:** Security management (aspirational)

---

### 7.4 Data Location

**Storage:**
- **Database:** Supabase (PostgreSQL)
- **Files:** Supabase Storage
- **Location:** Region-specific (user's region)

**Backup:**
- Daily automated backups
- Point-in-time recovery available
- Backup retention: 30 days

---

## Appendix: Compliance Checklist

### For Legal Review

- [x] Immutable audit trail
- [x] Timestamped actions
- [x] Attributed actions
- [x] Evidence chain integrity
- [x] Export capability
- [x] Data retention policy
- [x] Deletion process

### For Insurance Review

- [x] Risk assessment documentation
- [x] Evidence preservation
- [x] Audit trail
- [x] Report generation
- [x] Export capability

### For Regulatory Review

- [x] Complete documentation
- [x] Risk assessment calculations
- [x] Mitigation tracking
- [x] Evidence verification
- [x] Audit trail
- [x] Export formats

### For Inspector Review

- [x] One-click reports
- [x] Permit packs
- [x] Version history
- [x] Evidence verification
- [x] Reproducible exports

---

**Last Updated:** January 15, 2025  
**Version:** 1.0  
**Status:** ✅ Production Ready

