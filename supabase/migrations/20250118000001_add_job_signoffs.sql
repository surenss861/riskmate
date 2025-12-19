-- Job sign-offs with role-based signatures
-- Enables approvals/sign-offs for compliance and governance

CREATE TABLE IF NOT EXISTS job_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signer_role TEXT NOT NULL, -- 'owner', 'safety_lead', 'admin', etc.
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signoff_type TEXT NOT NULL, -- 'safety_approval', 'completion', 'compliance', 'owner_approval'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'signed', 'rejected'
  signed_at TIMESTAMPTZ,
  signature_data JSONB, -- Can store digital signature data, IP, user agent, etc.
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_job_signoffs_job ON job_signoffs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_signoffs_organization ON job_signoffs(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_signoffs_signer ON job_signoffs(signer_id);
CREATE INDEX IF NOT EXISTS idx_job_signoffs_status ON job_signoffs(status);
CREATE INDEX IF NOT EXISTS idx_job_signoffs_type ON job_signoffs(signoff_type);

-- Enable RLS
ALTER TABLE job_signoffs ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view sign-offs for jobs in their organization
CREATE POLICY "Users can view sign-offs from their organization"
  ON job_signoffs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS policy: Users can create sign-offs for jobs in their organization
CREATE POLICY "Users can create sign-offs for their organization"
  ON job_signoffs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND signer_id = auth.uid() -- Users can only sign for themselves
  );

-- RLS policy: Signers can update their own sign-offs
CREATE POLICY "Signers can update their own sign-offs"
  ON job_signoffs FOR UPDATE
  USING (signer_id = auth.uid())
  WITH CHECK (signer_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE job_signoffs IS 'Role-based sign-offs for job approvals. Enables compliance workflows where specific roles must approve jobs before completion.';
COMMENT ON COLUMN job_signoffs.signoff_type IS 'Type of sign-off: safety_approval, completion, compliance, owner_approval';
COMMENT ON COLUMN job_signoffs.signature_data IS 'Digital signature metadata: IP address, user agent, timestamp, signature hash, etc.';

