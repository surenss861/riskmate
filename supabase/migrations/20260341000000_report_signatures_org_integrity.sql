-- Enforce that report_signatures.organization_id matches parent report_runs.organization_id.
-- Ensures org-scoped isolation when using service-role/admin queries.

CREATE OR REPLACE FUNCTION check_report_signature_org_match()
RETURNS TRIGGER AS $$
DECLARE
  run_org_id UUID;
BEGIN
  SELECT organization_id INTO run_org_id
  FROM report_runs
  WHERE id = NEW.report_run_id;
  IF run_org_id IS NULL THEN
    RAISE EXCEPTION 'report_run_id does not exist';
  END IF;
  IF run_org_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'report_signatures.organization_id must match report_runs.organization_id for the given report_run_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS report_signatures_org_integrity_trigger ON report_signatures;
CREATE TRIGGER report_signatures_org_integrity_trigger
BEFORE INSERT OR UPDATE OF organization_id, report_run_id
ON report_signatures
FOR EACH ROW
EXECUTE FUNCTION check_report_signature_org_match();

COMMENT ON FUNCTION check_report_signature_org_match() IS 'Ensures report_signatures.organization_id matches parent report_runs.organization_id for defense-in-depth org isolation';
