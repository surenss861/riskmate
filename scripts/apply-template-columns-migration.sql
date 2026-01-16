-- Migration: Add template tracking columns to jobs table
-- This migration adds applied_template_id and applied_template_type columns
-- Run this in Supabase SQL Editor if the columns don't exist yet

-- Add applied_template_id and applied_template_type columns to jobs table
-- Note: We can't use a foreign key constraint because the template could be from either
-- hazard_templates or job_templates. We'll enforce referential integrity at the application level.
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS applied_template_id UUID,
ADD COLUMN IF NOT EXISTS applied_template_type TEXT CHECK (applied_template_type IN ('hazard', 'job'));

-- Create index for faster queries on template usage
CREATE INDEX IF NOT EXISTS idx_jobs_applied_template_id ON jobs(applied_template_id) WHERE applied_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_applied_template_type ON jobs(applied_template_type) WHERE applied_template_type IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN jobs.applied_template_id IS 'The hazard_template or job_template that was applied to this job';
COMMENT ON COLUMN jobs.applied_template_type IS 'Type of template applied: hazard or job';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('applied_template_id', 'applied_template_type')
ORDER BY column_name;
