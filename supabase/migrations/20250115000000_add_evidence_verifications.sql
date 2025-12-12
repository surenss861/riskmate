-- Create evidence_verifications table for manager approval workflow
CREATE TABLE IF NOT EXISTS evidence_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_evidence_verifications_document_id ON evidence_verifications(document_id);
CREATE INDEX IF NOT EXISTS idx_evidence_verifications_job_id ON evidence_verifications(job_id);
CREATE INDEX IF NOT EXISTS idx_evidence_verifications_organization_id ON evidence_verifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_evidence_verifications_status ON evidence_verifications(status);

-- Enable RLS
ALTER TABLE evidence_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view verifications in their organization
CREATE POLICY "Users can view verifications in their organization"
  ON evidence_verifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = evidence_verifications.organization_id
    )
  );

-- Only admins and owners can insert/update verifications
CREATE POLICY "Admins and owners can manage verifications"
  ON evidence_verifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = evidence_verifications.organization_id
      AND users.role IN ('admin', 'owner')
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_evidence_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_evidence_verifications_updated_at
  BEFORE UPDATE ON evidence_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_evidence_verifications_updated_at();

