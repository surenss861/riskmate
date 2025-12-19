-- Multi-site support for facilities operations
-- Adds site_id to jobs table for facilities that manage multiple locations

-- Create sites table for multi-site organizations FIRST
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ
);

-- Create index for efficient site lookups
CREATE INDEX IF NOT EXISTS idx_sites_organization ON sites(organization_id);
CREATE INDEX IF NOT EXISTS idx_sites_archived ON sites(archived, archived_at);

-- NOW add site_id column to jobs table (after sites table exists)
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS site_name TEXT;

-- Create index for jobs site lookup
CREATE INDEX IF NOT EXISTS idx_jobs_site ON jobs(site_id);

-- Enable RLS on sites table
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see sites from their organization
CREATE POLICY "Users can view sites from their organization"
  ON sites FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS policy: Only owners/admins can create sites
CREATE POLICY "Owners and admins can create sites"
  ON sites FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- RLS policy: Only owners/admins can update sites
CREATE POLICY "Owners and admins can update sites"
  ON sites FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Add comment for documentation
COMMENT ON TABLE sites IS 'Multi-site locations for facilities operations. Each site represents a physical location managed by an organization.';
COMMENT ON COLUMN jobs.site_id IS 'Optional site association for multi-site operations (facilities, maintenance, etc.)';
COMMENT ON COLUMN jobs.site_name IS 'Denormalized site name for quick display without joins';

