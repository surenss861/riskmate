-- Restore contract compatibility for jobs.status: include on_hold so bulk status flows
-- (BulkStatusModal, app/api/jobs/bulk/shared.ts, Express bulk/status) can set status to on_hold.
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('draft', 'pending', 'in_progress', 'on_hold', 'completed', 'cancelled', 'archived'));
