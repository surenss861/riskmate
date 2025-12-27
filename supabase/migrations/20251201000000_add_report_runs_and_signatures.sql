-- ============================================================================
-- REPORT RUNS & TEAM SIGNATURES (Audit-Ready)
-- ============================================================================
-- This migration adds versioned report runs and immutable signatures
-- for compliance and audit trail purposes.

-- Report Runs table (frozen report versions)
CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  generated_by UUID NOT NULL REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Data integrity: hash of the report payload at generation time
  data_hash TEXT NOT NULL,
  
  -- Optional PDF metadata
  pdf_path TEXT,
  pdf_signed_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  
  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_runs_job_id ON report_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_org_id ON report_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_status ON report_runs(status);
CREATE INDEX IF NOT EXISTS idx_report_runs_generated_at ON report_runs(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_data_hash ON report_runs(data_hash);

-- Report Signatures table (immutable, tamper-evident)
CREATE TABLE IF NOT EXISTS report_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_run_id UUID NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  
  -- Signer information
  signer_user_id UUID REFERENCES auth.users(id), -- nullable for external signers
  signer_name TEXT NOT NULL,
  signer_title TEXT NOT NULL, -- e.g., "Site Supervisor", "Safety Officer"
  signature_role TEXT NOT NULL CHECK (signature_role IN ('prepared_by', 'reviewed_by', 'approved_by', 'other')),
  
  -- Signature data (SVG preferred for crisp PDF rendering)
  signature_svg TEXT NOT NULL, -- SVG path data or full SVG string
  signature_hash TEXT NOT NULL, -- SHA256 of signature_svg + signer fields
  
  -- Timestamp and audit fields
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  
  -- Revocation support (if needed)
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoked_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_signatures_report_run_id ON report_signatures(report_run_id);
CREATE INDEX IF NOT EXISTS idx_report_signatures_org_id ON report_signatures(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_signatures_signer_user_id ON report_signatures(signer_user_id);
CREATE INDEX IF NOT EXISTS idx_report_signatures_role ON report_signatures(signature_role);
CREATE INDEX IF NOT EXISTS idx_report_signatures_signed_at ON report_signatures(signed_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_signatures_revoked ON report_signatures(revoked_at) WHERE revoked_at IS NULL;

-- Unique constraint: one signature per role per report_run (unless revoked)
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_signatures_unique_role 
ON report_signatures(report_run_id, signature_role) 
WHERE revoked_at IS NULL;

-- Function to compute data hash from report payload
CREATE OR REPLACE FUNCTION compute_report_data_hash(payload JSONB)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(payload::text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_report_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER report_runs_updated_at
BEFORE UPDATE ON report_runs
FOR EACH ROW
EXECUTE FUNCTION update_report_runs_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_signatures ENABLE ROW LEVEL SECURITY;

-- Report Runs RLS Policies

-- Org members can read report runs for their organization
CREATE POLICY "Organization members can read report runs"
ON report_runs
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

-- Org members can create draft report runs
CREATE POLICY "Organization members can create draft report runs"
ON report_runs
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
  AND generated_by = auth.uid()
  AND status = 'draft'
);

-- Only the creator or org admin can update report runs
CREATE POLICY "Creator or admin can update report runs"
ON report_runs
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
  AND (
    generated_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.user_id = auth.uid()
      AND om.organization_id = report_runs.organization_id
      AND om.role IN ('owner', 'admin')
    )
  )
);

-- Report Signatures RLS Policies

-- Org members can read signatures for their organization's report runs
CREATE POLICY "Organization members can read signatures"
ON report_signatures
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

-- Users can create their own signatures (or admins can create for external signers)
CREATE POLICY "Users can create signatures"
ON report_signatures
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
  AND (
    signer_user_id = auth.uid() -- User signing for themselves
    OR signer_user_id IS NULL -- External signer (admin creates)
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = report_signatures.organization_id
      AND om.role IN ('owner', 'admin')
    ) -- Admin creating for someone else
  )
  AND revoked_at IS NULL -- Cannot create revoked signatures
);

-- Signatures are immutable (no UPDATE allowed)
-- If revocation is needed, it's done via UPDATE, but this should be rare
CREATE POLICY "Admins can revoke signatures"
ON report_signatures
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = report_signatures.organization_id
    AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  -- Only allow setting revoked_at, revoked_by, revoked_reason
  (OLD.signature_svg = NEW.signature_svg)
  AND (OLD.signature_hash = NEW.signature_hash)
  AND (OLD.signer_name = NEW.signer_name)
  AND (OLD.signer_title = NEW.signer_title)
  AND (OLD.signature_role = NEW.signature_role)
  AND (OLD.signed_at = NEW.signed_at)
);

-- Comments for documentation
COMMENT ON TABLE report_runs IS 'Frozen report versions with data hash for audit integrity';
COMMENT ON COLUMN report_runs.data_hash IS 'SHA256 hash of report payload at generation time - prevents tampering';
COMMENT ON TABLE report_signatures IS 'Immutable signatures attached to specific report runs';
COMMENT ON COLUMN report_signatures.signature_svg IS 'SVG signature data (preferred over raster for PDF quality)';
COMMENT ON COLUMN report_signatures.signature_hash IS 'SHA256 hash of signature_svg + signer fields for tamper detection';
COMMENT ON COLUMN report_signatures.revoked_at IS 'Timestamp when signature was revoked (if applicable)';

