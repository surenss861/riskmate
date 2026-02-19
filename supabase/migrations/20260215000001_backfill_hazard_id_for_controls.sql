-- Backfill hazard_id for existing control rows in mitigation_items
-- Control identification: rows with same (job_id, risk_factor_id) - first by created_at = hazard,
-- subsequent rows = controls linked to that hazard. Only applies to rows where hazard_id IS NULL.
-- After this migration, legacy data from generateMitigationItems (multiple steps per risk factor)
-- will correctly appear as hazards with controls in /api/jobs/:id/hazards and /api/jobs/:id/controls.
-- Ensures hazard_id column exists before backfill (column may be added in 20260215000004; order varies).

DO $$
DECLARE
  has_risk_factor_id boolean;
  has_hazard_id boolean;
  updated_count integer := 0;
BEGIN
  -- Ensure hazard_id column exists (add if not, so this migration can run before 20260215000004)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mitigation_items' AND column_name = 'hazard_id'
  ) INTO has_hazard_id;
  IF NOT has_hazard_id THEN
    ALTER TABLE mitigation_items ADD COLUMN hazard_id UUID REFERENCES mitigation_items(id) ON DELETE CASCADE;
  END IF;

  -- Check if risk_factor_id column exists (it may have been made nullable or removed in some migrations)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mitigation_items' AND column_name = 'risk_factor_id'
  ) INTO has_risk_factor_id;

  IF NOT has_risk_factor_id THEN
    RAISE NOTICE 'mitigation_items.risk_factor_id does not exist - skipping hazard_id backfill (no prior linkage data)';
    RETURN;
  END IF;

  -- For each (job_id, risk_factor_id) group with multiple items: first by created_at = hazard,
  -- rest = controls. Set hazard_id on control rows to the first item's id.
  WITH ranked AS (
    SELECT
      mi.id,
      mi.job_id,
      mi.risk_factor_id,
      ROW_NUMBER() OVER (
        PARTITION BY mi.job_id, mi.risk_factor_id
        ORDER BY mi.created_at ASC NULLS LAST, mi.id ASC
      ) AS rn
    FROM mitigation_items mi
    WHERE mi.hazard_id IS NULL
      AND mi.risk_factor_id IS NOT NULL
  ),
  first_per_group AS (
    SELECT id AS first_id, job_id, risk_factor_id
    FROM ranked
    WHERE rn = 1
  )
  UPDATE mitigation_items mi
  SET hazard_id = fpg.first_id
  FROM ranked r
  JOIN first_per_group fpg
    ON r.job_id = fpg.job_id
    AND r.risk_factor_id = fpg.risk_factor_id
    AND r.rn > 1
  WHERE mi.id = r.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled hazard_id for % control rows in mitigation_items', updated_count;
END $$;
