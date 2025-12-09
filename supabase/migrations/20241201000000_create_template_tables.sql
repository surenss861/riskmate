-- Create template tables for RiskMate
-- Hazard Templates, Job Templates (Mitigation Templates deferred to v2)

-- Hazard Templates table
CREATE TABLE IF NOT EXISTS hazard_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade TEXT,
  description TEXT,
  hazard_ids TEXT[] DEFAULT '{}', -- Array of risk_factor IDs
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_hazard_templates_org_id ON hazard_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_hazard_templates_archived ON hazard_templates(archived);

-- Job Templates table
CREATE TABLE IF NOT EXISTS job_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade TEXT,
  job_type TEXT,
  client_type TEXT,
  description TEXT,
  hazard_template_ids TEXT[] DEFAULT '{}', -- Array of hazard_template IDs
  mitigation_template_ids TEXT[] DEFAULT '{}', -- Array of mitigation_template IDs (future)
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_job_templates_org_id ON job_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_templates_archived ON job_templates(archived);

-- Enable RLS
ALTER TABLE hazard_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hazard_templates
CREATE POLICY "Users can view hazard templates in their organization"
  ON hazard_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create hazard templates in their organization"
  ON hazard_templates FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update hazard templates in their organization"
  ON hazard_templates FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete hazard templates in their organization"
  ON hazard_templates FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- RLS Policies for job_templates
CREATE POLICY "Users can view job templates in their organization"
  ON job_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create job templates in their organization"
  ON job_templates FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update job templates in their organization"
  ON job_templates FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete job templates in their organization"
  ON job_templates FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

