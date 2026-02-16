-- Enforce that job_assignments.user_id belongs to the same organization as the job.
-- Prevents cross-org or orphaned assignments at the DB level.
CREATE OR REPLACE FUNCTION check_job_assignment_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM users u
    JOIN jobs j ON j.id = NEW.job_id
    WHERE u.id = NEW.user_id
      AND u.organization_id = j.organization_id
  ) THEN
    RAISE EXCEPTION 'job_assignments_org_check: assignee must belong to job organization'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_assignments_org_check_trigger ON job_assignments;
CREATE TRIGGER job_assignments_org_check_trigger
  BEFORE INSERT OR UPDATE ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION check_job_assignment_org();
