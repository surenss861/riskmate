-- Atomic delete_hazard for sync: deletes first, tombstones only after deletes succeed.
-- Prevents clients from seeing tombstones when hazard delete fails.
-- Usage: SELECT sync_delete_hazard(p_organization_id, p_job_id, p_hazard_id);
-- Returns JSONB with success/deleted_count/error.

CREATE OR REPLACE FUNCTION public.sync_delete_hazard(
  p_organization_id UUID,
  p_job_id UUID,
  p_hazard_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control_ids UUID[];
  v_ctrl_id UUID;
  v_deleted_controls INT := 0;
  v_deleted_hazard INT := 0;
BEGIN
  -- Fetch control IDs before any deletes (CASCADE would remove rows before we can tombstone)
  SELECT ARRAY_AGG(id) INTO v_control_ids
  FROM mitigation_items
  WHERE job_id = p_job_id
    AND hazard_id = p_hazard_id
    AND organization_id = p_organization_id;

  v_control_ids := COALESCE(v_control_ids, ARRAY[]::UUID[]);

  -- 1. Delete controls first
  DELETE FROM mitigation_items
  WHERE job_id = p_job_id
    AND hazard_id = p_hazard_id
    AND organization_id = p_organization_id;
  GET DIAGNOSTICS v_deleted_controls = ROW_COUNT;

  -- 2. Delete hazard
  DELETE FROM mitigation_items
  WHERE id = p_hazard_id
    AND job_id = p_job_id
    AND organization_id = p_organization_id
    AND hazard_id IS NULL;
  GET DIAGNOSTICS v_deleted_hazard = ROW_COUNT;

  IF v_deleted_hazard = 0 THEN
    RAISE EXCEPTION 'hazard not found or already deleted: %', p_hazard_id;
  END IF;

  -- 3. Insert tombstones only after deletes succeed (no tombstone if delete failed)
  FOREACH v_ctrl_id IN ARRAY v_control_ids
  LOOP
    INSERT INTO sync_mitigation_deletions (mitigation_item_id, job_id, hazard_id, organization_id)
    VALUES (v_ctrl_id, p_job_id, p_hazard_id, p_organization_id);
  END LOOP;

  INSERT INTO sync_mitigation_deletions (mitigation_item_id, job_id, hazard_id, organization_id)
  VALUES (p_hazard_id, p_job_id, NULL, p_organization_id);

  RETURN jsonb_build_object(
    'success', true,
    'deleted_controls', v_deleted_controls,
    'deleted_hazard', v_deleted_hazard
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_delete_hazard(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_delete_hazard(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.sync_delete_hazard IS 'Atomically deletes hazard and its controls, then records tombstones. No tombstone if delete fails.';
