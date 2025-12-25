-- SECURITY DEFINER function to safely remove team members
-- This function handles authorization, dependency cleanup, and soft removal
-- Usage: SELECT remove_team_member(p_organization_id, p_member_user_id, p_reassign_to)

CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_organization_id UUID,
  p_member_user_id UUID,
  p_reassign_to UUID DEFAULT NULL  -- optional: reassign active assignments to this user
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_target_role TEXT;
  v_owner_count INT;
  v_active_assignments INT;
  v_result JSONB;
BEGIN
  -- Get actor's role
  SELECT role INTO v_actor_role
  FROM public.users
  WHERE id = v_actor_id 
    AND organization_id = p_organization_id 
    AND archived_at IS NULL;

  -- Authorization check
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'not authorized: only owners and admins can remove team members';
  END IF;

  -- Prevent removing yourself
  IF v_actor_id = p_member_user_id THEN
    RAISE EXCEPTION 'cannot remove yourself: ask another owner or admin to remove you';
  END IF;

  -- Get target member's role
  SELECT role INTO v_target_role
  FROM public.users
  WHERE id = p_member_user_id 
    AND organization_id = p_organization_id 
    AND archived_at IS NULL;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'member not found or already removed';
  END IF;

  -- Prevent removing last owner
  IF v_target_role = 'owner' THEN
    IF v_actor_role != 'owner' THEN
      RAISE EXCEPTION 'only owners can remove other owners';
    END IF;

    SELECT COUNT(*) INTO v_owner_count
    FROM public.users
    WHERE organization_id = p_organization_id 
      AND role = 'owner' 
      AND archived_at IS NULL
      AND id != p_member_user_id;

    IF v_owner_count = 0 THEN
      RAISE EXCEPTION 'cannot remove last owner: transfer ownership or add another owner first';
    END IF;
  END IF;

  -- Count active job assignments
  SELECT COUNT(*) INTO v_active_assignments
  FROM public.job_assignments ja
  INNER JOIN public.jobs j ON j.id = ja.job_id
  WHERE ja.user_id = p_member_user_id
    AND j.organization_id = p_organization_id
    AND j.status IN ('draft', 'in_progress')
    AND j.archived_at IS NULL;

  -- Handle active assignments
  IF v_active_assignments > 0 THEN
    IF p_reassign_to IS NOT NULL THEN
      -- Reassign to specified user
      UPDATE public.job_assignments
      SET user_id = p_reassign_to
      WHERE user_id = p_member_user_id
        AND job_id IN (
          SELECT id FROM public.jobs 
          WHERE organization_id = p_organization_id 
            AND status IN ('draft', 'in_progress')
            AND archived_at IS NULL
        );
    ELSE
      -- Unassign (set to NULL if FK allows, or find owner/admin to reassign)
      -- First try to find an owner/admin to reassign to
      DECLARE
        v_reassign_target UUID;
      BEGIN
        SELECT id INTO v_reassign_target
        FROM public.users
        WHERE organization_id = p_organization_id
          AND role IN ('owner', 'admin')
          AND archived_at IS NULL
          AND id != p_member_user_id
        LIMIT 1;

        IF v_reassign_target IS NOT NULL THEN
          UPDATE public.job_assignments
          SET user_id = v_reassign_target
          WHERE user_id = p_member_user_id
            AND job_id IN (
              SELECT id FROM public.jobs 
              WHERE organization_id = p_organization_id 
                AND status IN ('draft', 'in_progress')
                AND archived_at IS NULL
            );
        ELSE
          -- No owner/admin available, unassign
          UPDATE public.job_assignments
          SET user_id = NULL
          WHERE user_id = p_member_user_id
            AND job_id IN (
              SELECT id FROM public.jobs 
              WHERE organization_id = p_organization_id 
                AND status IN ('draft', 'in_progress')
                AND archived_at IS NULL
            );
        END IF;
      END;
    END IF;
  END IF;

  -- Soft-remove membership (archive user)
  UPDATE public.users
  SET archived_at = NOW()
  WHERE id = p_member_user_id
    AND organization_id = p_organization_id
    AND archived_at IS NULL;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'member_id', p_member_user_id,
    'assignments_reassigned', v_active_assignments,
    'archived_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.remove_team_member(UUID, UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.remove_team_member IS 'Safely removes a team member by archiving them and handling active job assignments. Requires owner or admin role.';

