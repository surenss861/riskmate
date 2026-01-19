# Auditor Mode Enforcement

## Overview

Auditor mode is **server-side enforced** using the `requireWriteAccess` middleware.

## Policy

**Auditors can:**
- ✅ GET everything (read-only access)
- ✅ Generate proof packs (read-only output)
- ✅ Share/copy hashes (read-only)

**Auditors cannot:**
- ❌ Create/edit/delete jobs
- ❌ Flag jobs (governance signal)
- ❌ Archive jobs
- ❌ Upload evidence
- ❌ Update mitigations
- ❌ Create signoffs

## Implementation

### Middleware

`apps/backend/src/middleware/requireWriteAccess.ts`

Blocks all POST/PATCH/DELETE operations for `role === 'auditor'` or `role === 'executive'`.

### Protected Endpoints

All mutation endpoints in `jobs.ts` use `requireWriteAccess`:

- ✅ POST /api/jobs (job creation)
- ✅ PATCH /api/jobs/:id (job update)
- ✅ PATCH /api/jobs/:id/mitigations/:mitigationId (mitigation update)
- ✅ POST /api/jobs/:id/documents (evidence upload)
- ✅ POST /api/jobs/:id/archive (archive job)
- ✅ PATCH /api/jobs/:id/flag (flag job)
- ✅ POST /api/jobs/:id/signoffs (create signoff)
- ✅ DELETE /api/jobs/:id (delete job)

### Allowed Endpoints (Read-Only Output)

- ✅ POST /api/jobs/:id/proof-pack (generates PDF - read-only output, auditors allowed)

## Error Response

Returns `403` with:

```json
{
  "message": "Auditors have read-only access",
  "code": "AUTH_ROLE_READ_ONLY"
}
```

## Audit Trail

All attempted violations are logged to `audit_logs` with `eventName: "auth.role_violation"`.
