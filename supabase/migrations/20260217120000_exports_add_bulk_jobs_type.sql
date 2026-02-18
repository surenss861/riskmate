-- Allow export_type 'bulk_jobs' for async work-records CSV/PDF export.
ALTER TABLE public.exports DROP CONSTRAINT IF EXISTS exports_export_type_check;
ALTER TABLE public.exports
  ADD CONSTRAINT exports_export_type_check
  CHECK (export_type IN ('proof_pack', 'ledger', 'executive_brief', 'controls', 'attestations', 'bulk_jobs'));
