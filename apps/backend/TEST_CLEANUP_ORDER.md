# Test Cleanup Order - Foreign Key Reference

## Summary

This document explains the cleanup order for test data and why it respects foreign key constraints.

## Foreign Key Relationships

### Tables that reference `jobs` (ON DELETE CASCADE)
- `job_assignments` → `jobs`
- `job_documents` → `jobs`
- `job_signoffs` → `jobs`
- `job_photos` → `jobs`
- `job_risk_scores` → `jobs`
- `risk_scores` → `jobs`
- `hazards` → `jobs`
- `controls` → `jobs` (also references `hazards` ON DELETE SET NULL)
- `signatures` → `jobs`
- `evidence` → `jobs`
- `evidence_verifications` → `jobs` (also references `documents`)
- `report_runs` → `jobs`
- `report_signatures` → `report_runs` → `jobs`

### Tables that reference `organizations` (ON DELETE CASCADE)
- `organization_members` → `organizations`
- `sites` → `organizations`
- `jobs` → `organizations`
- `hazards` → `organizations`
- `controls` → `organizations`
- `evidence` → `organizations`
- `exports` → `organizations`
- `ledger_roots` → `organizations`
- `idempotency_keys` → `organizations`
- `audit_logs` → `organizations` (job_id is ON DELETE SET NULL, so must delete explicitly)

### Special Cases

1. **`controls` → `hazards`**: Controls can reference hazards, so hazards must be deleted before controls
2. **`evidence_verifications` → `documents`**: Evidence verifications reference documents, so must be deleted before documents
3. **`report_signatures` → `report_runs`**: Report signatures reference report runs, so must be deleted before report runs
4. **`audit_logs.job_id`**: Has ON DELETE SET NULL, so audit logs won't be auto-deleted when jobs are deleted

## Cleanup Order (Current Implementation)

1. **Deepest child tables first** (tables that reference other child tables):
   - `controls` (references hazards)
   - `hazards` (referenced by controls)
   - `evidence_verifications` (references evidence/documents)
   - `evidence` (references jobs)

2. **Report-related tables** (chain of dependencies):
   - `report_signatures` (references report_runs)
   - `report_runs` (references jobs)

3. **Direct job child tables**:
   - `signatures`
   - `job_assignments`
   - `job_documents`
   - `job_signoffs`
   - `mitigation_items`
   - `job_photos`
   - `risk_scores`
   - `job_risk_scores`

4. **Parent table** (jobs):
   - `jobs` (this will cascade delete any remaining child rows)

5. **Organization-scoped tables** (not job-dependent):
   - `exports`
   - `sites`
   - `ledger_roots`
   - `idempotency_keys`

6. **Audit logs** (must be explicit due to ON DELETE SET NULL):
   - `audit_logs`

7. **Organization members**:
   - `organization_members`

## Safety Features

1. **Organization name check**: Verifies org name is "RiskMate Test Org" before any cleanup
2. **Explicit order**: Deletes in correct order even though most have ON DELETE CASCADE
3. **Isolated cleanup**: Only deletes data from `TEST_ORG_ID`, never production data

## Notes

- Most tables have `ON DELETE CASCADE`, so deleting `jobs` would auto-delete children
- However, explicit order is safer and prevents potential constraint errors
- `audit_logs` has `ON DELETE SET NULL` for `job_id`, so must be deleted explicitly
- Users and organization are not deleted (reused across test runs)

## Adding New Tables

When adding new tables that reference `jobs` or `organizations`:

1. If it references other child tables, add it to step 1 (deepest level)
2. If it only references `jobs`, add it to step 3 (direct job children)
3. If it only references `organizations`, add it to step 5 (org-scoped)
4. Update this document with the new table and its FK relationships
