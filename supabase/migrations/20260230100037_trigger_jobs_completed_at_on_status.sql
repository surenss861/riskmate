-- Enforce completed_at whenever status is set to 'completed' (any update path: API, SQL, bulk RPC).
CREATE OR REPLACE FUNCTION public.set_jobs_completed_at_on_status_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF LOWER(COALESCE(NEW.status, '')) = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_set_completed_at_on_completed ON jobs;
CREATE TRIGGER jobs_set_completed_at_on_completed
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_jobs_completed_at_on_status_completed();
