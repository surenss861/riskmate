-- Make current_period_start and current_period_end nullable in subscriptions table
-- This allows "none" plan state to be stored without violating NOT NULL constraints
-- The "none" plan is a valid state that doesn't have billing periods

ALTER TABLE public.subscriptions
  ALTER COLUMN current_period_start DROP NOT NULL;

ALTER TABLE public.subscriptions
  ALTER COLUMN current_period_end DROP NOT NULL;

-- Also make stripe_subscription_id nullable for "none" plan
-- (it's already nullable in some migrations, but ensure it's consistent)
ALTER TABLE public.subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL;

-- Update the tier constraint to include 'none' if not already included
-- (This may have been done in a previous migration, but ensure it's there)
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_tier_check
    CHECK (tier IN ('none', 'starter', 'pro', 'business'));

-- Update the status constraint to include 'inactive' if not already included
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'inactive'));
