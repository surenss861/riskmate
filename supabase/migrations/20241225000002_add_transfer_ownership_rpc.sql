-- SECURITY DEFINER function to transfer team ownership
-- This function allows the current owner to transfer ownership to another member
-- Usage: SELECT transfer_team_ownership(p_organization_id, p_new_owner_user_id)

CREATE OR REPLACE FUNCTION public.transfer_team_ownership(
  p_organization_id UUID,
  p_new_owner_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_new_owner_role TEXT;
  v_result JSONB;
BEGIN
  -- Get actor's role
  SELECT role INTO v_actor_role
  FROM public.users
  WHERE id = v_actor_id 
    AND organization_id = p_organization_id 
    AND archived_at IS NULL;

  -- Authorization: only current owner can transfer ownership
  IF v_actor_role IS NULL OR v_actor_role != 'owner' THEN
    RAISE EXCEPTION 'not authorized: only the current owner can transfer ownership';
  END IF;

  -- Prevent transferring to yourself
  IF v_actor_id = p_new_owner_user_id THEN
    RAISE EXCEPTION 'cannot transfer ownership to yourself';
  END IF;

  -- Verify new owner exists and is a member of the organization
  SELECT role INTO v_new_owner_role
  FROM public.users
  WHERE id = p_new_owner_user_id 
    AND organization_id = p_organization_id 
    AND archived_at IS NULL;

  IF v_new_owner_role IS NULL THEN
    RAISE EXCEPTION 'new owner not found or not a member of this organization';
  END IF;

  -- Transfer ownership: promote new owner, demote current owner
  UPDATE public.users
  SET role = 'owner'
  WHERE id = p_new_owner_user_id
    AND organization_id = p_organization_id
    AND archived_at IS NULL;

  -- Demote current owner to admin (or member if you prefer)
  UPDATE public.users
  SET role = 'admin'
  WHERE id = v_actor_id
    AND organization_id = p_organization_id
    AND archived_at IS NULL;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'previous_owner_id', v_actor_id,
    'new_owner_id', p_new_owner_user_id,
    'transferred_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.transfer_team_ownership(UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.transfer_team_ownership IS 'Transfers organization ownership from current owner to another member. Only callable by current owner.';

