-- Fix users.current_plan constraint to allow 'none' plan
-- This allows the cancel flow to set users to 'none' without constraint violations

-- Drop the existing constraint
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_current_plan_check;

-- Recreate the constraint with 'none' included
ALTER TABLE public.users
  ADD CONSTRAINT users_current_plan_check
  CHECK (current_plan IS NULL OR current_plan IN ('none', 'starter', 'pro', 'business'));

-- Also update plan_tracking constraints to allow 'none' (for consistency)
ALTER TABLE plan_tracking
  DROP CONSTRAINT IF EXISTS plan_tracking_plan_code_check;

ALTER TABLE plan_tracking
  ADD CONSTRAINT plan_tracking_plan_code_check
  CHECK (plan_code IN ('none', 'starter', 'pro', 'business'));

ALTER TABLE plan_tracking
  DROP CONSTRAINT IF EXISTS plan_tracking_previous_plan_code_check;

ALTER TABLE plan_tracking
  ADD CONSTRAINT plan_tracking_previous_plan_code_check
  CHECK (previous_plan_code IS NULL OR previous_plan_code IN ('none', 'starter', 'pro', 'business'));

-- Update existing NULL values to 'none' for consistency (optional)
UPDATE public.users
SET current_plan = 'none'
WHERE current_plan IS NULL;
