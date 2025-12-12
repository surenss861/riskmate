# RiskMate Premium Backend Spec

**Features:** Job Assignment • Evidence Verification • Version History • Permit Packs  
**Status:** Fully Implemented • Production-Ready

---

## 1. Job Assignment — Backend Spec

### 1.1 Purpose

Assign specific workers to a job so accountability is explicit and auditable.

### 1.2 API Endpoints

#### POST /api/jobs/:jobId/assign

Assign a worker to a job.

**Request body:**
```json
{
  "worker_id": "uuid-string"
}
```

**Behavior:**

Validates:
- Authenticated user
- User belongs to the same `organization_id` as the job
- User role is `owner` or `admin`
- `worker_id` exists and belongs to the same org

Inserts row into `job_assignments`:
- `job_id`
- `user_id` (the worker)
- `role` (default: 'worker')
- `assigned_at`

Writes audit log:
- `event_name` = `'worker.assigned'`
- `target_type` = `'job'`
- `target_id` = `jobId`
- `metadata` = `{ worker_id, worker_name }`

Returns updated assignment data with worker details.

#### DELETE /api/jobs/:jobId/assign

Unassign a worker from a job.

**Request body:**
```json
{
  "worker_id": "uuid-string"
}
```

**Behavior:**

Same auth/org checks as POST.

Deletes row in `job_assignments` where `job_id = jobId AND user_id = worker_id`.

Writes audit log:
- `event_name` = `'worker.unassigned'`
- `metadata` = `{ worker_id, worker_name }`

Returns success confirmation.

### 1.3 Database Schema — `job_assignments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `job_id` | uuid | FK → `jobs.id` |
| `user_id` | uuid | FK → `users.id` |
| `role` | text | Worker role (e.g., 'worker', 'lead tech') |
| `assigned_at` | timestamptz | Default `now()` |

**Indexes:**
- `idx_job_assignments_job_id`
- `idx_job_assignments_user_id`

### 1.4 RLS Policies

All queries are scoped by `organization_id` via joins to `jobs` and `users`.

- Only members of the org can see assignments for their jobs.
- **Write access:**
  - `role IN ('owner', 'admin')` can create/delete assignments.
  - `member` can read but not modify.

### 1.5 Audit Logging

Each change is written to `audit_logs`:

```json
{
  "event_name": "worker.assigned" | "worker.unassigned",
  "target_type": "job",
  "target_id": "jobId",
  "actor_id": "actorId",
  "metadata": {
    "worker_id": "uuid-string",
    "worker_name": "John Doe"
  },
  "created_at": "timestamp"
}
```

---

## 2. Evidence Verification — Backend Spec

### 2.1 Purpose

Let supervisors validate worker evidence (photos/docs) with approve/reject flows and reasons, for compliance and audits.

### 2.2 Migration — `evidence_verifications` Table

**Migration:** `20250115000000_add_evidence_verifications.sql`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `job_id` | uuid | FK → `jobs.id` |
| `document_id` | uuid | FK → `documents.id` |
| `organization_id` | uuid | FK → `organizations.id` |
| `status` | text | `'pending'`, `'approved'`, or `'rejected'` |
| `reviewed_by` | uuid | FK → `users.id` |
| `reviewed_at` | timestamptz | Verification timestamp |
| `rejection_reason` | text | Optional; recommended when rejected |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Auto-updated on change |

**Indexes:**
- `idx_evidence_verifications_document_id`
- `idx_evidence_verifications_job_id`
- `idx_evidence_verifications_organization_id`
- `idx_evidence_verifications_status`

### 2.3 RLS Policies

**Read:**
- Any user in the job's organization can see verification status.

**Write:**
- Only `owner` or `admin` can insert/update.
- Enforced via `organization_id` on `jobs` and `users`.

### 2.4 API Endpoint

#### POST /api/jobs/:jobId/evidence/:docId/verify

**Request body:**
```json
{
  "status": "approved" | "rejected",
  "reason": "optional rejection text"
}
```

**Rules:**

Auth user must:
- belong to the same org,
- have role `owner` or `admin`.

`status = 'rejected'` → `reason` is optional but recommended.

`document_id` must belong to the job.

**Behavior:**

Upserts into `evidence_verifications` for `(job_id, document_id)`:
- `status`, `rejection_reason`, `reviewed_by`, `reviewed_at`, `updated_at`.

Writes audit log:
- `event_name` = `'evidence.approved'` or `'evidence.rejected'`
- `metadata` = `{ document_id, document_name, status, rejection_reason }`

Returns verification record.

---

## 3. Version History — Backend Spec

### 3.1 Purpose

Provide a complete, immutable job history for legal, compliance, and insurance purposes.

### 3.2 Existing Audit Log Table (`audit_logs`)

**Fields (simplified):**

```typescript
{
  id: uuid
  organization_id: uuid
  actor_id: uuid | null
  actor_name: string | null
  event_name: string
  target_type: string
  target_id: uuid | null
  metadata: jsonb
  created_at: timestamptz
}
```

### 3.3 Tracked Action Types

**Examples (not exhaustive):**

- `job.created`
- `job.updated`
- `job.status_changed`
- `worker.assigned`
- `worker.unassigned`
- `hazard.added`
- `hazard.removed`
- `mitigation.completed`
- `document.uploaded`
- `evidence.approved`
- `evidence.rejected`
- `report.generated`
- `permit_pack.generated`
- `template.applied`
- `template.created`
- `template.archived`

### 3.4 API Endpoint

#### GET /api/jobs/:jobId/audit

**Behavior:**

- Auth required.
- User must belong to job's organization.
- Returns ordered list of audit entries for that job:
  - Sorted `created_at DESC`.
  - Filtered to job-related events.
  - Limited to 100 most recent entries.

**Response (simplified):**

```json
{
  "data": [
    {
      "id": "uuid",
      "event_name": "mitigation.completed",
      "actor_id": "uuid",
      "target_type": "mitigation",
      "target_id": "uuid",
      "metadata": {
        "title": "Install guardrail",
        "job_id": "uuid"
      },
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### 3.5 Frontend Integration

**New client helper:**

```typescript
getAuditLog(jobId: string): Promise<{ data: AuditLogEntry[] }>
```

**Used to power the Version History / Timeline UI with:**
- Date grouping (Today, Yesterday, specific dates)
- Lucide icons by action type
- Clickable references (e.g., "View template", "View evidence")

---

## 4. Permit Packs — Backend Spec

### 4.1 Purpose

Generate a single ZIP containing everything needed for permit applications, inspections, or audits.

### 4.2 API Endpoints

#### POST /api/jobs/:jobId/permit-pack

**Behavior:**

- Auth required.
- Plan gating enforced (Business plan only).
- Validates org access + permissions.

**Backend flow:**

1. Fetches job, hazards, mitigations, evidence, documents, signatures, etc.
2. (Re)generates latest Risk Snapshot PDF if needed.
3. Builds CSVs:
   - `hazard_checklist.csv`
   - `controls_applied.csv`
   - (optionally) `signatures.csv`
4. Builds JSON:
   - `job_details.json` (job metadata)
   - `metadata.json` (generation info, organization, timestamps)
5. Pulls photos into structured folders (`before`/`during`/`after`).
6. Pulls documents into `/documents`.
7. Streams ZIP with `archiver` (or similar) to Supabase Storage:
   - Path: `{organization_id}/permit-packs/{jobId}_{timestamp}.zip`
8. Returns signed download URL.
9. Writes audit log:
   - `event_name` = `'permit_pack.generated'`
   - `metadata` = `{ file_path, size, file_name }`

**Response:**

```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://...",
    "filePath": "org-id/permit-packs/job-id_timestamp.zip",
    "size": 1234567
  }
}
```

#### GET /api/jobs/:jobId/permit-packs

**Behavior:**

Returns list of all previously generated permit packs for the job:

```json
{
  "data": [
    {
      "id": "uuid",
      "version": 1,
      "file_path": "org/permit-packs/...",
      "generated_at": "2025-01-15T...",
      "generated_by": "uuid",
      "downloadUrl": "https://..."
    }
  ]
}
```

### 4.3 ZIP Contents Breakdown

**Structure:**

```
permit-pack-{jobId}-{date}.zip
├── risk_snapshot.pdf
├── hazard_checklist.csv
├── controls_applied.csv
├── job_details.json
├── metadata.json
├── documents/
│   ├── insurance_certificate.pdf
│   └── ...
└── photos/
    ├── before/
    ├── during/
    └── after/
```

**Guarantees:**

- Every permit pack is reproducible from stored data.
- Every generation is logged & traceable.
- ZIP is uploaded to Supabase Storage with signed URLs.

---

## 5. System Status Matrix

### 5.1 Feature Completion

| Feature | Frontend | Backend | Database | RLS | Audit Log |
|---------|----------|---------|----------|-----|-----------|
| **Job Assignment** | ✅ | ✅ | Existing table | ✅ | ✅ |
| **Evidence Verification** | ✅ | ✅ | New table + RLS | ✅ | ✅ |
| **Version History** | ✅ | ✅ | Existing logs | ✅ | ✅ |
| **Permit Packs** | ✅ | ✅ | Uses existing | N/A | ✅ |

**All four are fully wired end-to-end:**

```
UI → API client → API routes → DB + RLS → Audit logs
```

---

## 6. Security & Compliance Model

### 6.1 Authentication

All endpoints require a valid session (Supabase auth or equivalent).

**Session contains:**
- `user_id`
- `organization_id`
- `role` (`owner`/`admin`/`member`)
- `subscription_tier`

### 6.2 RLS Enforcement

Every query runs under Row-Level Security.

**Queries are scoped by `organization_id`:**
- Jobs → `jobs.organization_id`
- Documents → join to `jobs`
- Evidence → join to `jobs`
- Assignments → join to `jobs` + `users`

**No cross-org leakage is possible via direct queries.**

### 6.3 Role-Based Access

**Owner/Admin:**
- Full access to premium features (job assignment, evidence verification, permit packs).

**Member:**
- Can upload evidence.
- Can see verification status.
- Cannot verify evidence or change assignments.

### 6.4 Audit Logging Standards

Every "meaningful" state change writes an audit event:

- Includes `organization_id`, `actor_id`, `event_name`, `target_type`, `target_id`, `metadata`, `created_at`.
- Logs are append-only.
- Used by Version History UI and compliance workflows.

### 6.5 Error Handling Patterns

- **Auth failures** → `401 Unauthorized`
- **Org/role mismatches** → `403 Forbidden`
- **Resource not found** → `404 Not Found`
- **Plan restrictions** (e.g., Permit Pack on Starter) → `403 Forbidden` with `FEATURE_RESTRICTED` code
- **Validation issues** → `400 Bad Request` with message
- **Server errors** → `500 Internal Server Error` + generic safe message

---

## 7. API Endpoint Summary

| Endpoint | Method | Auth | Role | Plan |
|----------|--------|------|------|------|
| `/api/jobs/:jobId/assign` | POST | ✅ | owner/admin | Any |
| `/api/jobs/:jobId/assign` | DELETE | ✅ | owner/admin | Any |
| `/api/jobs/:jobId/evidence/:docId/verify` | POST | ✅ | owner/admin | Any |
| `/api/jobs/:jobId/audit` | GET | ✅ | org members | Any |
| `/api/jobs/:jobId/permit-pack` | POST | ✅ | owner/admin | Business |
| `/api/jobs/:jobId/permit-packs` | GET | ✅ | org members | Business |

---

## 8. Ready For

These specs + implementations are strong enough for:

### Developer Onboarding
New devs can understand flows, tables, and responsibilities quickly.

### Investor & Enterprise Buyer Documentation
Shows you're not a toy app; you've got audit trails, RLS, and compliance.

### Compliance / Legal / Insurance Reviews
Evidence, approvals, job assignments, and permit packs are all tracked, immutable, and explainable.

### Internal Technical Documentation
Can live in `/docs/premium-backend.md` or similar with zero edits.

---

## 9. Database Migrations

### New Migration Created
- `20250115000000_add_evidence_verifications.sql` — Creates `evidence_verifications` table with RLS policies, indexes, and triggers

### Existing Tables Used
- `job_assignments` — Job worker assignments (from `20251128000000_comprehensive_schema_restructure.sql`)
- `audit_logs` — Version history / audit trail (from `20251109000200_add_audit_logs.sql`)
- `documents` — Evidence files
- `jobs` — Job records

---

## 10. Frontend API Client Methods

**Added to `lib/api.ts`:**

```typescript
// Job Assignment
assignWorker(jobId: string, workerId: string): Promise<{ data: Assignment }>
unassignWorker(jobId: string, workerId: string): Promise<{ success: boolean }>

// Evidence Verification
verifyEvidence(
  jobId: string,
  docId: string,
  status: 'approved' | 'rejected',
  reason?: string
): Promise<{ success: boolean; data: Verification }>

// Version History
getAuditLog(jobId: string): Promise<{ data: AuditLogEntry[] }>

// Permit Packs
generatePermitPack(jobId: string): Promise<{ success: boolean; data: PermitPack }>
getPermitPacks(jobId: string): Promise<{ data: PermitPack[] }>
```

**All methods include:**
- Automatic authentication token injection
- Organization context validation
- Proper error handling with typed errors
- Consistent response structure

---

**Last Updated:** January 15, 2025  
**Status:** ✅ Production Ready  
**Version:** 1.0
