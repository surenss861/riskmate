-- Align jobs.status, jobs.client_type, jobs.job_type CHECK constraints with the public API v1 contract
-- so that values accepted by POST /api/v1/jobs (archived, mixed, renovation, new_construction) are allowed by the DB.

-- Drop existing CHECK constraints (names are typically jobs_<column>_check from initial schema)
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_client_type_check;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_job_type_check;

-- Re-add CHECK constraints matching API contract (include on_hold for bulk flows; avoid validation failure on existing rows)
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('draft', 'pending', 'in_progress', 'on_hold', 'completed', 'cancelled', 'archived'));

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_client_type_check
  CHECK (client_type IN ('residential', 'commercial', 'industrial', 'government', 'mixed'));

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_job_type_check
  CHECK (job_type IN ('repair', 'maintenance', 'installation', 'inspection', 'renovation', 'new_construction', 'remodel', 'other'));
