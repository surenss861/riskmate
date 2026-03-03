-- jobs_status_check already includes 'on_hold' as of 20260340000000_jobs_enum_constraints_api_contract.sql.
-- Bulk status flows (BulkStatusModal, app/api/jobs/bulk/shared.ts, Express bulk/status) are covered there.
-- No constraint change needed (idempotent no-op to avoid redundant churn).
SELECT 1;
