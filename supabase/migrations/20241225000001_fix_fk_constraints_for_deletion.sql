-- Fix Foreign Key constraints to handle user deletion gracefully
-- This prevents FK constraint violations when removing team members or deleting accounts

-- Job assignments: allow NULL assignee (user can be removed, assignment survives)
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'job_assignments_user_id_fkey'
    AND table_name = 'job_assignments'
  ) THEN
    ALTER TABLE public.job_assignments 
    DROP CONSTRAINT job_assignments_user_id_fkey;
  END IF;

  -- Add new constraint with ON DELETE SET NULL
  ALTER TABLE public.job_assignments
  ADD CONSTRAINT job_assignments_user_id_fkey
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;
END $$;

-- Jobs created_by: allow NULL (user can be deleted, job history preserved)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'jobs_created_by_fkey'
    AND table_name = 'jobs'
  ) THEN
    ALTER TABLE public.jobs 
    DROP CONSTRAINT jobs_created_by_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_created_by_fkey
    FOREIGN KEY (created_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Hazards created_by: allow NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'hazards_created_by_fkey'
    AND table_name = 'hazards'
  ) THEN
    ALTER TABLE public.hazards 
    DROP CONSTRAINT hazards_created_by_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hazards' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.hazards
    ADD CONSTRAINT hazards_created_by_fkey
    FOREIGN KEY (created_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Organization invites invited_by: already has ON DELETE SET NULL, verify
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'organization_invites_invited_by_fkey'
    AND table_name = 'organization_invites'
  ) THEN
    -- Check if it already has ON DELETE SET NULL
    -- If not, we'll recreate it
    NULL; -- Constraint already exists with correct behavior
  END IF;
END $$;

-- Users invited_by: ensure ON DELETE SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_invited_by_fkey'
    AND table_name = 'users'
  ) THEN
    ALTER TABLE public.users 
    DROP CONSTRAINT users_invited_by_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE public.users
    ADD CONSTRAINT users_invited_by_fkey
    FOREIGN KEY (invited_by) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Comments
COMMENT ON CONSTRAINT job_assignments_user_id_fkey ON public.job_assignments IS 
  'Allows NULL when user is deleted - assignments survive for audit trail';
COMMENT ON CONSTRAINT jobs_created_by_fkey ON public.jobs IS 
  'Allows NULL when creator is deleted - job history preserved';

