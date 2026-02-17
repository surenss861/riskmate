-- Denormalize primary assignee onto jobs for list views and bulk assign consistency.
-- Bulk assign and single assign should update these so list/refetch shows correct assignment.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to_email TEXT;
COMMENT ON COLUMN jobs.assigned_to_id IS 'Primary assignee (denormalized from job_assignments for list/refetch).';
COMMENT ON COLUMN jobs.assigned_to_name IS 'Primary assignee display name.';
COMMENT ON COLUMN jobs.assigned_to_email IS 'Primary assignee email.';
