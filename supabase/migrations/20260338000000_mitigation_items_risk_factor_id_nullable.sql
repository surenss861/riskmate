-- Allow mitigation_items without risk_factor_id for API-created hazards and template-generated items.
-- Existing rows keep their risk_factor_id; new rows may omit it (custom hazards).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mitigation_items' AND column_name = 'risk_factor_id'
  ) THEN
    ALTER TABLE mitigation_items ALTER COLUMN risk_factor_id DROP NOT NULL;
  END IF;
END $$;
