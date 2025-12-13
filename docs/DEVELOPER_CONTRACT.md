# RiskMate Developer Contract Specification

**For:** Engineers, Technical Reviewers, API Consumers  
**Version:** 1.0  
**Last Updated:** January 15, 2025

---

## Purpose

This document defines the **technical contracts** for every RiskMate feature: inputs, outputs, invariants, audit events, permissions, and failure modes.

**Use Cases:**
- Developer onboarding
- API integration
- Feature implementation
- Technical due diligence
- System architecture review

---

## Table of Contents

1. [Event Taxonomy](#1-event-taxonomy)
2. [Permissions & RLS Canon](#2-permissions--rls-canon)
3. [Feature Contracts](#3-feature-contracts)
4. [API Contracts](#4-api-contracts)
5. [Database Constraints](#5-database-constraints)
6. [Non-Goals & Boundaries](#6-non-goals--boundaries)
7. [Demo Alignment](#7-demo-alignment)

---

## 1. Event Taxonomy

### 1.1 Canonical Event Names

Every meaningful state change writes an audit log with one of these event names:

**Job Events:**
- `job.created` — New job created
- `job.updated` — Job details modified
- `job.status_changed` — Status changed (draft → active → completed)
- `job.deleted` — Job deleted (soft delete)

**Hazard Events:**
- `hazard.added` — Risk factor added to job
- `hazard.removed` — Risk factor removed from job
- `hazards.updated` — Multiple hazards changed (recalculation)

**Mitigation Events:**
- `mitigation.completed` — Mitigation item marked complete
- `mitigation.uncompleted` — Mitigation item unchecked

**Evidence Events:**
- `evidence.uploaded` — Document/photo uploaded
- `evidence.approved` — Evidence verified as approved
- `evidence.rejected` — Evidence verified as rejected (with reason)

**Assignment Events:**
- `worker.assigned` — Worker assigned to job
- `worker.unassigned` — Worker removed from job

**Template Events:**
- `template.created` — New template saved
- `template.applied` — Template applied to job
- `template.archived` — Template archived
- `template.duplicated` — Template duplicated

**Report Events:**
- `report.generated` — PDF report generated
- `report.shared` — Report share link created
- `permit_pack.generated` — Permit pack ZIP generated

**User Events:**
- `user.invited` — Team member invited
- `user.joined` — Team member accepted invite
- `user.removed` — Team member removed
- `user.role_changed` — User role modified

**Subscription Events:**
- `subscription.created` — Plan subscription started
- `subscription.upgraded` — Plan upgraded
- `subscription.downgraded` — Plan downgraded
- `subscription.cancelled` — Plan cancelled

---

### 1.2 Required Metadata Keys

Every audit log entry must include:

**Required:**
- `organization_id` — Organization scope
- `actor_id` — User who performed action (nullable for system actions)
- `actor_name` — Human-readable actor name
- `event_name` — Canonical event name (from taxonomy above)
- `target_type` — Resource type (`'job'`, `'document'`, `'mitigation'`, etc.)
- `target_id` — Resource ID (nullable for creation events)
- `created_at` — Timestamp (immutable)

**Optional (in `metadata` JSONB):**
- `job_id` — If action relates to a job
- `document_id` — If action relates to a document
- `worker_id` — If action relates to worker assignment
- `template_id` — If action relates to a template
- `reason` — For rejections/explanations
- `old_value` — Previous state (for updates)
- `new_value` — New state (for updates)
- `file_path` — For file operations
- `file_size` — For file operations

---

### 1.3 Event Naming Convention

**Format:** `{resource}.{action}`

**Examples:**
- ✅ `job.created` (not `create_job`)
- ✅ `evidence.approved` (not `approve_evidence`)
- ✅ `worker.assigned` (not `assign_worker`)

**Rationale:** Consistent, scannable, sortable.

---

## 2. Permissions & RLS Canon

### 2.1 Role Definitions

| Role | Description | Created By |
|------|-------------|------------|
| **owner** | Full access, billing control | Organization creator |
| **admin** | Full access except billing | Owner/Admin invite |
| **member** | Limited access (view, upload) | Owner/Admin invite |

---

### 2.2 Action Permissions Matrix

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| **Jobs** |
| Create job | ✅ | ✅ | ✅ |
| Edit job | ✅ | ✅ | ✅ |
| Delete job | ✅ | ✅ | ❌ |
| View job | ✅ | ✅ | ✅ |
| **Hazards** |
| Add/remove hazards | ✅ | ✅ | ✅ |
| **Mitigations** |
| Complete mitigation | ✅ | ✅ | ✅ |
| **Evidence** |
| Upload evidence | ✅ | ✅ | ✅ |
| Approve/reject evidence | ✅ | ✅ | ❌ |
| View evidence | ✅ | ✅ | ✅ |
| **Assignments** |
| Assign worker | ✅ | ✅ | ❌ |
| Unassign worker | ✅ | ✅ | ❌ |
| View assignments | ✅ | ✅ | ✅ |
| **Templates** |
| Create template | ✅ | ✅ | ❌ |
| Edit template | ✅ | ✅ | ❌ |
| Apply template | ✅ | ✅ | ✅ |
| Archive template | ✅ | ✅ | ❌ |
| **Reports** |
| Generate report | ✅ | ✅ | ✅ |
| Share report | ✅ | ✅ | ✅ |
| **Permit Packs** |
| Generate permit pack | ✅ | ✅ | ❌ |
| **Team** |
| Invite member | ✅ | ✅ | ❌ |
| Remove member | ✅ | ✅ | ❌ |
| Change role | ✅ | ✅ | ❌ |
| **Billing** |
| View subscription | ✅ | ❌ | ❌ |
| Upgrade/downgrade | ✅ | ❌ | ❌ |
| Cancel subscription | ✅ | ❌ | ❌ |

---

### 2.3 API Route Enforcement

Every API route enforces:

1. **Authentication:** Valid session token required
2. **Organization Context:** User must belong to organization
3. **Resource Ownership:** Resource must belong to user's organization
4. **Role Check:** Action must be allowed for user's role
5. **Plan Gating:** Feature must be available on user's plan

**Example:**
```typescript
POST /api/jobs/:id/assign
├── ✅ Auth: Valid session
├── ✅ Org: User belongs to org
├── ✅ Ownership: Job belongs to org
├── ✅ Role: User is owner/admin
└── ✅ Plan: Any plan (no gating)
```

---

### 2.4 RLS Policy Intent

**Core Principle:** All queries scoped by `organization_id`.

**Tables with RLS:**

| Table | Policy Intent | Enforcement |
|-------|---------------|-------------|
| `jobs` | Users can only access their org's jobs | `organization_id = auth.jwt() ->> 'organization_id'` |
| `documents` | Users can only access their org's documents | Via `job_id` join to `jobs` |
| `mitigation_items` | Users can only access their org's mitigations | Via `job_id` join to `jobs` |
| `job_assignments` | Users can only access their org's assignments | Via `job_id` join to `jobs` |
| `evidence_verifications` | Users can only access their org's verifications | `organization_id = auth.jwt() ->> 'organization_id'` |
| `job_templates` | Users can only access their org's templates | `organization_id = auth.jwt() ->> 'organization_id'` |
| `hazard_templates` | Users can only access their org's templates | `organization_id = auth.jwt() ->> 'organization_id'` |
| `audit_logs` | Users can only access their org's logs | `organization_id = auth.jwt() ->> 'organization_id'` |

**Enforcement Level:** Database (PostgreSQL RLS policies)

**Bypass Prevention:** Even direct database access cannot bypass RLS.

---

## 3. Feature Contracts

Each feature section below follows this contract format:

### Contract Format

**Inputs:** What the user/system provides  
**Outputs:** What changes + what's produced  
**Invariants:** What must always be true  
**Audit Events:** Exact event names written  
**Plan/Role Gates:** One-line gate description  
**Failure Modes:** What can go wrong + UI copy expectation

---

### 3.1 Job Creation

**Inputs:**
- Client name, type, location, description
- Job type, dates (optional)
- Risk factor codes (optional)
- Organization context (from session)

**Outputs:**
- Job record in `jobs` table
- Risk score calculation (if hazards selected)
- Mitigation items generated (if hazards selected)
- Audit log: `job.created`

**Invariants:**
- Job always belongs to user's organization
- Job always has `created_by` = current user
- Risk score is 0-100 (capped)
- If hazards selected, risk score must be calculated
- If risk score calculated, mitigation items must be generated

**Audit Events:**
- `job.created` (with metadata: client_name, job_type, location, risk_factor_count)

**Plan/Role Gates:**
- Any authenticated user can create jobs
- Starter plan: 10 jobs/month limit (hard)
- Pro/Business: Unlimited

**Failure Modes:**
- **Plan limit reached:** `403` with `JOB_LIMIT` code, message: "Starter plan limit reached (10 jobs/month). Upgrade to Pro for unlimited jobs."
- **Invalid data:** `400` with validation errors
- **Auth failure:** `401` Unauthorized
- **Server error:** `500` with generic message

---

### 3.2 Risk Score Calculation

**Inputs:**
- Array of risk factor codes
- Risk factor library (from database)

**Outputs:**
- `overall_score` (0-100)
- `risk_level` ('low' | 'medium' | 'high' | 'critical')
- `factors` array with weights

**Invariants:**
- Score is sum of severity weights, capped at 100
- Risk level determined by thresholds:
  - Low: 0-40
  - Medium: 41-70
  - High: 71-90
  - Critical: 91-100
- Every selected factor must exist and be active
- Score calculation is deterministic (same inputs = same output)

**Audit Events:**
- None (calculation is internal, logged via `hazards.updated`)

**Plan/Role Gates:**
- Available on all plans
- No role restrictions

**Failure Modes:**
- **Invalid factor codes:** `400` with message: "Invalid risk factor codes provided"
- **No factors selected:** Returns score 0, level 'low' (not an error)
- **Calculation error:** `500` with message: "Failed to calculate risk score"

---

### 3.3 Mitigation Completion

**Inputs:**
- Job ID
- Mitigation item ID
- New completion state (true/false)

**Outputs:**
- `mitigation_items.done` updated
- `mitigation_items.is_completed` updated
- `jobs.updated_at` updated
- Audit log: `mitigation.completed` or `mitigation.uncompleted`

**Invariants:**
- Mitigation item must belong to job
- Job must belong to user's organization
- Completion state is boolean
- Audit log always written on state change

**Audit Events:**
- `mitigation.completed` (when checked)
- `mitigation.uncompleted` (when unchecked)

**Plan/Role Gates:**
- Any authenticated user can complete mitigations
- No plan restrictions

**Failure Modes:**
- **Item not found:** `404` with message: "Mitigation item not found"
- **Job not found:** `404` with message: "Job not found"
- **Auth failure:** `401` Unauthorized
- **Update error:** `500` with message: "Failed to update mitigation"

---

### 3.4 Evidence Verification

**Inputs:**
- Job ID
- Document ID
- Status ('approved' | 'rejected')
- Rejection reason (optional, recommended for rejections)

**Outputs:**
- `evidence_verifications` record upserted
- Status, reviewed_by, reviewed_at updated
- Audit log: `evidence.approved` or `evidence.rejected`

**Invariants:**
- Document must belong to job
- Job must belong to user's organization
- User must be owner/admin (enforced)
- Status must be 'approved' or 'rejected'
- Rejection reason recommended but not required

**Audit Events:**
- `evidence.approved` (with metadata: document_id, document_name)
- `evidence.rejected` (with metadata: document_id, document_name, rejection_reason)

**Plan/Role Gates:**
- Owner/admin only
- Available on all plans

**Failure Modes:**
- **Insufficient permissions:** `403` with message: "Only owners and admins can verify evidence"
- **Document not found:** `404` with message: "Document not found"
- **Invalid status:** `400` with message: "Status must be 'approved' or 'rejected'"
- **Auth failure:** `401` Unauthorized

---

### 3.5 Worker Assignment

**Inputs:**
- Job ID
- Worker ID (user ID)

**Outputs:**
- `job_assignments` record inserted
- Audit log: `worker.assigned`

**Invariants:**
- Worker must belong to same organization
- Job must belong to same organization
- User must be owner/admin (enforced)
- Assignment is idempotent (duplicate assignment = no-op)

**Audit Events:**
- `worker.assigned` (with metadata: worker_id, worker_name)

**Plan/Role Gates:**
- Owner/admin only
- Available on all plans

**Failure Modes:**
- **Insufficient permissions:** `403` with message: "Only owners and admins can assign workers"
- **Worker not found:** `404` with message: "Worker not found"
- **Worker in different org:** `403` with message: "Worker must belong to your organization"
- **Job not found:** `404` with message: "Job not found"

---

### 3.6 Permit Pack Generation

**Inputs:**
- Job ID
- Organization context

**Outputs:**
- ZIP file generated with:
  - PDF report
  - CSVs (hazards, controls, signatures)
  - JSON (job details, metadata)
  - Photos organized by folder
  - Documents folder
- ZIP uploaded to Supabase Storage
- Signed download URL returned
- Audit log: `permit_pack.generated`

**Invariants:**
- Job must belong to user's organization
- User must be owner/admin
- User must have Business plan
- ZIP is reproducible (same job = same contents)
- ZIP is immutable (cannot be edited after generation)

**Audit Events:**
- `permit_pack.generated` (with metadata: file_path, size, file_name)

**Plan/Role Gates:**
- Owner/admin only
- Business plan only

**Failure Modes:**
- **Insufficient plan:** `403` with `FEATURE_RESTRICTED` code, message: "Permit Pack Generator is only available for Business plan subscribers"
- **Insufficient permissions:** `403` with message: "Only owners and admins can generate permit packs"
- **Job not found:** `404` with message: "Job not found"
- **Generation error:** `500` with message: "Failed to generate permit pack"

---

## 4. API Contracts

### 4.1 Request/Response Format

**Standard Request:**
```typescript
Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body: { ... } // Feature-specific
```

**Standard Response (Success):**
```typescript
{
  success: true,
  data: { ... } // Feature-specific
}
```

**Standard Response (Error):**
```typescript
{
  error: string, // Human-readable message
  code?: string, // Error code (e.g., 'FEATURE_RESTRICTED', 'JOB_LIMIT')
  details?: any // Additional context (dev only)
}
```

---

### 4.2 Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `UNAUTHORIZED` | 401 | Invalid or missing auth token |
| `FORBIDDEN` | 403 | Insufficient permissions or plan |
| `FEATURE_RESTRICTED` | 403 | Feature not available on current plan |
| `JOB_LIMIT` | 403 | Starter plan job limit reached |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `SERVER_ERROR` | 500 | Internal server error |

---

## 5. Database Constraints

### 5.1 Foreign Key Constraints

All foreign keys enforce referential integrity:

- `jobs.organization_id` → `organizations.id`
- `jobs.created_by` → `users.id`
- `documents.job_id` → `jobs.id`
- `mitigation_items.job_id` → `jobs.id`
- `job_assignments.job_id` → `jobs.id`
- `job_assignments.user_id` → `users.id`
- `evidence_verifications.job_id` → `jobs.id`
- `evidence_verifications.document_id` → `documents.id`
- `audit_logs.organization_id` → `organizations.id`
- `audit_logs.actor_id` → `users.id` (nullable)

---

### 5.2 Unique Constraints

- `jobs.id` (primary key)
- `users.email` (unique per organization)
- `organizations.id` (primary key)
- `audit_logs.id` (primary key)

---

### 5.3 Check Constraints

- `jobs.risk_score` BETWEEN 0 AND 100
- `evidence_verifications.status` IN ('pending', 'approved', 'rejected')
- `users.role` IN ('owner', 'admin', 'member')
- `subscriptions.tier` IN ('starter', 'pro', 'business')

---

## 6. Non-Goals & Boundaries

### 6.1 Global Boundaries

**No Real-Time Collaboration:**
- No live editing
- No presence indicators
- No concurrent editing detection
- Changes require page refresh to see

**No Bulk Operations:**
- Evidence verification: One document at a time
- Worker assignment: One worker at a time
- Job creation: One job at a time
- No bulk approve/reject, no bulk assign

**No Historical Editing:**
- Audit logs are append-only (immutable)
- Once verified, evidence status cannot be changed without new verification
- Permit packs are snapshots (cannot edit after generation)
- Version history is read-only

**No Cross-Organization Access:**
- Strict data isolation by `organization_id`
- No shared workspaces
- No cross-tenant features
- RLS enforces at database level

**No External Integrations:**
- No webhook support for events
- No third-party API access to audit logs
- No export formats beyond ZIP/PDF
- No direct database dumps for external systems

**No Real-Time Notifications:**
- No push notifications
- No email notifications (unless explicitly configured)
- No in-app notification center

---

### 6.2 Why These Boundaries Exist

**Security:** Prevents data leakage and unauthorized access  
**Compliance:** Ensures audit trail integrity  
**Simplicity:** Reduces attack surface and maintenance burden  
**Performance:** Keeps queries fast and predictable  
**Reliability:** Fewer moving parts = fewer failure modes

---

## 7. Demo Alignment

### 7.1 Demo Steps → Real Features

| Demo Step | Real Feature | Data Persistence |
|-----------|--------------|------------------|
| **Step 1: Create Job** | Job Creation | ❌ Simulated (no DB write) |
| **Step 2: Apply Template** | Template Application | ❌ Simulated (no DB write) |
| **Step 3: Assign Worker** | Worker Assignment | ❌ Simulated (no DB write) |
| **Step 4: Approve Evidence** | Evidence Verification | ❌ Simulated (no DB write) |
| **Step 5: Generate Permit Pack** | Permit Pack Generation | ❌ Simulated (no ZIP generated) |
| **Step 6: View Version History** | Version History | ❌ Simulated (hardcoded entries) |

**Key Difference:** Demo is **read-only simulation**. Real features write to database, generate files, and create audit logs.

---

### 7.2 Demo Constraints

**What Demo Blocks:**
- All API calls (`/api/*` routes blocked)
- Navigation outside `/demo` and `/pricing`
- File uploads
- Real authentication
- Database writes

**What Demo Allows:**
- UI interactions (buttons, forms)
- Visual feedback (modals, toasts)
- State management (local React state)
- localStorage (for demo progress)

**Demo Protection:** `DemoProtection` component enforces constraints.

---

## Appendix: Quick Reference

### Event Names (Alphabetical)

```
evidence.approved
evidence.rejected
evidence.uploaded
hazard.added
hazard.removed
hazards.updated
job.created
job.deleted
job.status_changed
job.updated
mitigation.completed
mitigation.uncompleted
permit_pack.generated
report.generated
report.shared
subscription.cancelled
subscription.created
subscription.downgraded
subscription.upgraded
template.applied
template.archived
template.created
template.duplicated
user.invited
user.joined
user.removed
user.role_changed
worker.assigned
worker.unassigned
```

### Role Abbreviations

- **O** = Owner
- **A** = Admin
- **M** = Member

### Plan Abbreviations

- **S** = Starter
- **P** = Pro
- **B** = Business

---

**Last Updated:** January 15, 2025  
**Version:** 1.0  
**Status:** ✅ Production Ready

