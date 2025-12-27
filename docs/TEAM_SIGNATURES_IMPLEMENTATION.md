# Team Signatures Implementation

## Overview

Audit-ready team signature system for RiskMate reports with versioned report runs, tamper-evident signatures, and compliance-grade documentation.

## Architecture

### Database Schema

**`report_runs`** - Frozen report versions
- `id` (UUID)
- `organization_id`, `job_id`
- `status` ('draft' | 'final')
- `generated_by`, `generated_at`
- `data_hash` (SHA256 of report payload) - **prevents tampering**
- `pdf_path`, `pdf_signed_url`, `pdf_generated_at`

**`report_signatures`** - Immutable signatures
- `id` (UUID)
- `organization_id`, `report_run_id`
- `signer_user_id`, `signer_name`, `signer_title`
- `signature_role` ('prepared_by' | 'reviewed_by' | 'approved_by' | 'other')
- `signature_svg` - SVG signature data (crisp in PDFs)
- `signature_hash` (SHA256) - **tamper detection**
- `signed_at`, `ip_address`, `user_agent`
- `revoked_at`, `revoked_by`, `revoked_reason` (optional revocation)

### Key Features

1. **Versioned Reports** - Each report generation creates a `report_run` with frozen data hash
2. **Tamper-Evident** - Signatures include hash of signature + signer data
3. **Immutable** - Once signed, signatures cannot be updated (only revoked by admins)
4. **Audit Trail** - IP address, user agent, timestamps recorded
5. **SVG Signatures** - Vector format for crisp PDF rendering

## API Routes

### Report Runs

- `POST /api/reports/runs` - Create a new report run
  - Body: `{ job_id, report_payload, status }`
  - Returns: `{ data: reportRun }`

- `GET /api/reports/runs?job_id=xxx` - Get report runs for a job
  - Returns: `{ data: reportRuns[] }`

### Signatures

- `POST /api/reports/runs/[id]/signatures` - Create a signature
  - Body: `{ signer_name, signer_title, signature_role, signature_svg }`
  - Returns: `{ data: signature }`

- `GET /api/reports/runs/[id]/signatures` - Get all signatures for a report run
  - Returns: `{ data: signatures[] }`

- `GET /api/reports/runs/[id]/signatures/check` - Check if all required signatures are present
  - Returns: `{ data: { isComplete, missingRoles, signedRoles, requiredRoles } }`

## UI Components

### `SignatureCapture`
Canvas-based signature pad that:
- Captures mouse/touch input
- Exports to SVG format
- Requires signer name, title, and confirmation checkbox
- Validates all fields before saving

### `TeamSignatures`
Signature management component that:
- Shows required signature slots (Prepared By, Reviewed By, Approved By)
- Displays signature status (Signed/Missing)
- Opens signature capture modal
- Validates all signatures are complete

## Print Route Integration

The print route (`/reports/[id]/print`) now:
- Accepts `report_run_id` in search params
- Fetches and renders actual signatures if available
- Falls back to empty signature boxes if no signatures
- Displays signatures with SVG rendering, signer info, and timestamps

## Security (RLS Policies)

- **Read**: Org members can read report runs and signatures for their organization
- **Create**: Users can create their own signatures; admins can create for external signers
- **Update**: Only admins can revoke signatures (immutable otherwise)
- **Delete**: Not supported (immutable by design)

## Usage Flow

1. **Generate Report** → Creates `report_run` with frozen `data_hash`
2. **Capture Signatures** → Users sign via `SignatureCapture` component
3. **Validate Completion** → Check via `/signatures/check` endpoint
4. **Finalize** → Update `report_run.status = 'final'` (requires all signatures)
5. **Export PDF** → Print route renders signatures with SVG

## Next Steps

1. **Finalization Validation** - Block `status = 'final'` if signatures incomplete
2. **Report Run Creation** - Update export flow to create `report_run` before PDF generation
3. **External Signers** - Support sending signature requests via email/link
4. **Signature Revocation** - Admin UI for revoking signatures with reason
5. **Audit View** - Show signature history and revocation events

## Migration

Run the migration:
```bash
supabase db push
# or apply manually: supabase/migrations/20251201000000_add_report_runs_and_signatures.sql
```

## Notes

- Signatures are stored as SVG strings (not images) for better PDF quality
- Each signature includes a hash for tamper detection
- Report runs are versioned - multiple runs per job are supported
- Signature roles are enforced via unique constraint (one per role per run)

