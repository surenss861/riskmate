# Read-Only Enforcement Summary

## ✅ All Mutation Endpoints Protected

All write operations (POST/PATCH/DELETE) now use `requireWriteAccess` middleware, except:

### ✅ Allowed for Auditors (Read-Only Output)

- **POST /api/jobs/:id/proof-pack** - Generates PDF (read-only output, auditors allowed)

### ✅ Protected (Blocked for Auditors/Executives)

- **POST /api/jobs** - Job creation
- **PATCH /api/jobs/:id** - Job update
- **PATCH /api/jobs/:id/mitigations/:mitigationId** - Mitigation update
- **POST /api/jobs/:id/documents** - Evidence upload
- **POST /api/jobs/:id/archive** - Archive job
- **PATCH /api/jobs/:id/flag** - Flag job (governance signal)
- **POST /api/jobs/:id/signoffs** - Create signoff
- **DELETE /api/jobs/:id** - Delete job

## Policy Decision

**Auditors can generate proof packs** because:
- It's read-only output (PDF generation)
- No mutation to data
- Auditors need to export for verification

**Auditors cannot flag/archive/sign** because:
- These are governance signals
- They affect audit trail
- Read-only means read-only

## Implementation

Middleware: `apps/backend/src/middleware/requireWriteAccess.ts`

Returns `403 AUTH_ROLE_READ_ONLY` and logs to audit trail.
