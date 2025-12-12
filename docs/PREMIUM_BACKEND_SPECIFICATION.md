# RiskMate — Premium Backend Feature Specification

**Permit Packs • Job Assignment • Evidence Verification • Version History**

RiskMate's premium features are now fully implemented across frontend + backend + database, with authentication, RLS, and audit logging in place for enterprise-grade safety.

Below is the complete backend spec for each feature.

---

## 1️⃣ Job Assignment Backend Specification

### Purpose

Allows managers/admins to assign workers to jobs, define responsibility, and track job ownership.

### Endpoints

#### ➤ POST /api/jobs/[id]/assign

Assign a worker to a job.

**Body:**
```json
{
  "worker_id": "uuid-string"
}
```

**Validations:**
- User must belong to the same organization
- User must be owner/admin
- Job must belong to org
- Worker must be a valid org member

**Side Effects:**
- Creates row in `job_assignments`
- Writes audit log entry: `worker.assigned`
- Returns updated assigned workers list

#### ➤ DELETE /api/jobs/[id]/assign

Unassign a worker from a job.

**Body:**
```json
{
  "worker_id": "uuid-string"
}
```

**Side Effects:**
- Removes assignment from table
- Audit log entry: `worker.unassigned`

### Database Schema

Uses existing `job_assignments` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `job_id` | uuid | Foreign key to jobs |
| `user_id` | uuid | Foreign key to users (the worker) |
| `role` | text | Worker role (e.g., 'worker', 'lead tech') |
| `assigned_at` | timestamptz | Assignment timestamp |

**RLS** ✔️ — Locked to organization_id via job relationship.

---

## 2️⃣ Evidence Verification Backend Specification

### Purpose

Supervisors/admins approve or reject evidence uploaded by field workers.

### New Table: `evidence_verifications`

**Migration:** `20250115000000_add_evidence_verifications.sql`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `job_id` | uuid | Foreign key (jobs) |
| `document_id` | uuid | Foreign key (documents) |
| `organization_id` | uuid | Foreign key (organizations) |
| `status` | text | `'pending'`, `'approved'`, or `'rejected'` |
| `reviewed_by` | uuid | User performing verification |
| `reviewed_at` | timestamptz | Verification timestamp |
| `rejection_reason` | text | Optional rejection explanation |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

**RLS Policies:**
- Only Owner/Admin can write
- All job members can read verification state
- Enforced via `organization_id`

### Endpoints

#### ➤ POST /api/jobs/[id]/evidence/[docId]/verify

Approve or reject evidence.

**Body:**
```json
{
  "status": "approved" | "rejected",
  "reason": "optional text"
}
```

**Rules:**
- Only admin/owner can verify
- Rejection reason is optional but recommended
- Must belong to same org
- Document must belong to the job

**Side Effects:**
- Inserts/updates record in `evidence_verifications`
- Audit log entry: `evidence.approved` or `evidence.rejected`

---

## 3️⃣ Version History Backend Specification

### Purpose

Provide a fully traceable audit log for every job. This is critical for:
- Insurance claims
- Legal disputes
- Compliance certifications
- Enterprise customers

### Existing Endpoint

#### ➤ GET /api/jobs/:id/audit

Returns complete ordered timeline of job events.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "event_name": "template.applied",
      "target_type": "job",
      "target_id": "job-uuid",
      "actor_id": "user-uuid",
      "metadata": {
        "template_id": "...",
        "template_name": "..."
      },
      "created_at": "2025-01-15T10:30:00Z"
    },
    ...
  ]
}
```

**Tracked Actions Include:**
- `job.created`
- `template.applied`
- `hazard.added` / `hazard.removed`
- `mitigation.completed`
- `worker.assigned` / `worker.unassigned`
- `document.uploaded`
- `evidence.approved` / `evidence.rejected`
- `report.generated`
- `permit_pack.generated`
- `status_changed`

**Audit logs follow consistent structure and always include:**
- `actor_id` — Who performed the action
- `created_at` — Timestamp
- `event_name` — Action type
- `metadata` — Action-specific data
- `target_type` — What was affected (job, document, etc.)
- `target_id` — Specific resource ID

### Frontend Integration

**Added to `lib/api.ts`:**
```typescript
getAuditLog(jobId: string): Promise<{ data: AuditLogEntry[] }>
```

---

## 4️⃣ Permit Packs Backend Specification

### Purpose

Generate a full ZIP bundle containing everything related to the job for compliance, client delivery, or insurance purposes.

### Endpoints

#### ➤ POST /api/jobs/[id]/permit-pack

Triggers generation of a comprehensive ZIP archive containing:

- **PDF snapshot** — Full job risk report
- **hazard-checklist.csv** — All identified hazards
- **controls-summary.csv** — Mitigation items status
- **signatures.csv** — All collected signatures
- **metadata.json** — Job metadata
- **job-details.json** — Complete job information
- **before/after/during photos** — Organized by category
- **uploaded documents** — All supporting files

ZIP is uploaded to Supabase Storage and a signed download URL is returned.

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://...",
    "filePath": "org-id/job-id/permit-pack-...zip",
    "size": 1234567
  }
}
```

#### ➤ GET /api/jobs/[id]/permit-packs

Returns a list of all generated permit packs for the job.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "version": 1,
      "file_path": "...",
      "generated_at": "2025-01-15T...",
      "generated_by": "user-uuid",
      "downloadUrl": "https://..."
    },
    ...
  ]
}
```

### Backend Logic Overview

The implementation includes:
- File path generation with versioning
- PDFKit rendering for risk snapshot
- CSV generation for structured data
- Photo gathering & sorting by category
- ZIP assembly using `archiver`
- Upload to Supabase Storage
- Signed URL creation (1-hour expiry)
- Audit log entry: `permit_pack.generated`

**Plan Restriction:** Business tier only.

---

## 5️⃣ Updated API Client (Frontend ↔ Backend Integration)

### Added to `lib/api.ts`

#### Assignment API
```typescript
assignWorker(jobId: string, workerId: string): Promise<{ data: Assignment }>
unassignWorker(jobId: string, workerId: string): Promise<{ success: boolean }>
```

#### Evidence Verification
```typescript
verifyEvidence(
  jobId: string,
  docId: string,
  status: 'approved' | 'rejected',
  reason?: string
): Promise<{ success: boolean; data: Verification }>
```

#### Audit Log
```typescript
getAuditLog(jobId: string): Promise<{ data: AuditLogEntry[] }>
```

#### Permit Packs
```typescript
generatePermitPack(jobId: string): Promise<{ success: boolean; data: PermitPack }>
getPermitPacks(jobId: string): Promise<{ data: PermitPack[] }>
```

**All methods include:**
- Automatic authentication token injection
- Organization context validation
- Proper error handling with typed errors
- Consistent response structure

---

## 6️⃣ Full System Status

| Feature | Frontend | Backend | Database | RLS | Audit Log |
|---------|----------|---------|----------|-----|-----------|
| **Permit Packs** | ✅ | ✅ | Existing | N/A | ✅ Yes |
| **Job Assignment** | ✅ | ✅ | Existing | ✅ Yes | ✅ Yes |
| **Evidence Verification** | ✅ | ✅ | New migration | ✅ Yes | ✅ Yes |
| **Version History** | ✅ | ✅ | Existing | ✅ Yes | ✅ Yes |

---

## 7️⃣ Security & Compliance Features

### Authentication
- All endpoints require valid JWT token
- Organization context verified on every request
- User permissions checked before operations

### Row Level Security (RLS)
- All tables enforce organization-level isolation
- Users can only access data from their organization
- Admin/Owner roles enforced at database level

### Audit Logging
- Every critical action is logged
- Includes actor, timestamp, action, and metadata
- Immutable audit trail for compliance
- Supports legal and insurance requirements

### Error Handling
- Consistent error response format
- Proper HTTP status codes
- Detailed error messages in development
- Sanitized errors in production

---

## 8️⃣ RiskMate Now Meets Enterprise Expectations

These backend implementations enable:

✔ **Insurance-grade evidence tracking** — Full verification workflow with rejection reasons  
✔ **Supervisor-level responsibility logs** — Clear assignment and accountability  
✔ **Legally defensible audit trails** — Complete, timestamped history of all changes  
✔ **Complete compliance documentation workflows** — Permit packs with all job artifacts  
✔ **Multi-role operational oversight** — Role-based permissions throughout  
✔ **Scalable org-level permission structures** — RLS ensures data isolation  

**This is enterprise software quality.**

---

## 9️⃣ API Endpoint Summary

| Method | Endpoint | Purpose | Auth Required | Plan Tier |
|--------|----------|---------|---------------|-----------|
| POST | `/api/jobs/[id]/assign` | Assign worker | ✅ | Pro+ |
| DELETE | `/api/jobs/[id]/assign` | Unassign worker | ✅ | Pro+ |
| POST | `/api/jobs/[id]/evidence/[docId]/verify` | Verify evidence | ✅ | Business |
| GET | `/api/jobs/[id]/audit` | Get audit log | ✅ | All |
| POST | `/api/jobs/[id]/permit-pack` | Generate pack | ✅ | Business |
| GET | `/api/jobs/[id]/permit-packs` | List packs | ✅ | Business |

---

## 🔟 Database Migrations

### New Migration Created
- `20250115000000_add_evidence_verifications.sql` — Creates `evidence_verifications` table with RLS policies

### Existing Tables Used
- `job_assignments` — Job worker assignments
- `audit_logs` — Version history / audit trail
- `documents` — Evidence files
- `jobs` — Job records

---

## 📚 Related Documentation

- [Frontend Premium Features Specification](./PREMIUM_FEATURES.md) (if exists)
- [API Client Reference](../lib/api.ts)
- [Database Schema](../supabase/migrations/)

---

**Last Updated:** January 15, 2025  
**Status:** ✅ Production Ready  
**Version:** 1.0

