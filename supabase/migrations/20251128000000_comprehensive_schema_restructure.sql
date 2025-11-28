-- Comprehensive RiskMate Database Schema
-- This migration restructures the database to match the production-ready schema

-- ============================================================================
-- 1. CORE TENANT / ACCOUNT TABLES
-- ============================================================================

-- Organizations table (already exists, but ensure it has all required fields)
DO $$
BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'logo_url') THEN
    ALTER TABLE organizations ADD COLUMN logo_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'accent_color') THEN
    ALTER TABLE organizations ADD COLUMN accent_color TEXT;
  END IF;
END $$;

-- Organization Members (replaces/extends users table relationship)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);

-- Roles table (for custom role definitions)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  permissions JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. JOB MANAGEMENT TABLES
-- ============================================================================

-- Jobs table (ensure it has all required fields)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'status') THEN
    ALTER TABLE jobs ADD COLUMN status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'archived'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'created_by') THEN
    ALTER TABLE jobs ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Job Assignments (who is assigned to each job)
CREATE TABLE IF NOT EXISTS job_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'lead tech', 'inspector', 'helper', etc.
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_user_id ON job_assignments(user_id);

-- ============================================================================
-- 3. HAZARD & RISK TABLES
-- ============================================================================

-- Hazards table (separate from risk factors)
CREATE TABLE IF NOT EXISTS hazards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hazard_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hazards_job_id ON hazards(job_id);
CREATE INDEX IF NOT EXISTS idx_hazards_org_id ON hazards(organization_id);
CREATE INDEX IF NOT EXISTS idx_hazards_severity ON hazards(severity);

-- Controls table (mitigation actions - can be linked to hazards or general)
CREATE TABLE IF NOT EXISTS controls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  hazard_id UUID REFERENCES hazards(id) ON DELETE SET NULL, -- nullable for general controls
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controls_job_id ON controls(job_id);
CREATE INDEX IF NOT EXISTS idx_controls_hazard_id ON controls(hazard_id);
CREATE INDEX IF NOT EXISTS idx_controls_org_id ON controls(organization_id);
CREATE INDEX IF NOT EXISTS idx_controls_is_completed ON controls(is_completed);

-- Risk Scores table (versioned scoring)
CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  score_factors JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_job_id ON risk_scores(job_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_created_at ON risk_scores(created_at DESC);

-- ============================================================================
-- 4. JOB ASSET & EVIDENCE TABLES
-- ============================================================================

-- Job Photos table
CREATE TABLE IF NOT EXISTS job_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT,
  category TEXT CHECK (category IN ('before', 'during', 'after')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_path TEXT NOT NULL -- Supabase storage path
);

CREATE INDEX IF NOT EXISTS idx_job_photos_job_id ON job_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_org_id ON job_photos(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_category ON job_photos(category);

-- Job Documents table (manuals, PDFs, client uploads)
CREATE TABLE IF NOT EXISTS job_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_documents_job_id ON job_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_org_id ON job_documents(organization_id);

-- ============================================================================
-- 5. SIGNATURES & COMPLIANCE
-- ============================================================================

-- Signatures table
CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signed_by UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL,
  signature_image_path TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signatures_job_id ON signatures(job_id);
CREATE INDEX IF NOT EXISTS idx_signatures_org_id ON signatures(organization_id);
CREATE INDEX IF NOT EXISTS idx_signatures_signed_by ON signatures(signed_by);

-- Compliance Checks table
CREATE TABLE IF NOT EXISTS compliance_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  checklist_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'pending')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_job_id ON compliance_checks(job_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_org_id ON compliance_checks(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_status ON compliance_checks(status);

-- ============================================================================
-- 6. AUDIT LOGGING (already exists, but ensure it has all fields)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_name') THEN
    ALTER TABLE audit_logs ADD COLUMN actor_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_email') THEN
    ALTER TABLE audit_logs ADD COLUMN actor_email TEXT;
  END IF;
END $$;

-- ============================================================================
-- 7. PDF REPORTS
-- ============================================================================

-- Job Reports table (store metadata + versions)
CREATE TABLE IF NOT EXISTS job_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  file_path TEXT NOT NULL,
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_reports_job_id ON job_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_job_reports_org_id ON job_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_reports_version ON job_reports(job_id, version DESC);

-- ============================================================================
-- 8. BILLING & SUBSCRIPTION (already exists, but ensure structure)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'renews_on') THEN
    ALTER TABLE subscriptions ADD COLUMN renews_on TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'cancel_at_period_end') THEN
    ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Usage Logs table (for metered billing)
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item TEXT NOT NULL, -- 'pdf_generated', 'job_created', 'photos_uploaded'
  count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_org_id ON usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_item ON usage_logs(item);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);

-- ============================================================================
-- 9. MOBILE APP OFFLINE SYNC
-- ============================================================================

-- Sync Queue table (for mobile app offline sync)
CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'job', 'hazard', 'control', 'photo', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  payload JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_user_id ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_job_id ON sync_queue(job_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_synced_at ON sync_queue(synced_at) WHERE synced_at IS NULL;

-- ============================================================================
-- 10. ANALYTICS / INSIGHTS
-- ============================================================================

-- Job Metrics table
CREATE TABLE IF NOT EXISTS job_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hazard_count INTEGER DEFAULT 0,
  high_risk_count INTEGER DEFAULT 0,
  mitigation_completion_rate DECIMAL(5,2) DEFAULT 0.00,
  duration_hours DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_metrics_job_id ON job_metrics(job_id);
CREATE INDEX IF NOT EXISTS idx_job_metrics_org_id ON job_metrics(organization_id);

-- ============================================================================
-- 11. FUTURE-PROOF TABLES
-- ============================================================================

-- Templates table (customizable hazard/control templates per org)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('hazard', 'control', 'checklist')),
  name TEXT NOT NULL,
  fields JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_org_id ON templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- API Keys table (for integrations)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  permissions JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Helper function to get user's organization_id (if not exists)
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Organization Members policies
DROP POLICY IF EXISTS "Users can view members in their organization" ON organization_members;
CREATE POLICY "Users can view members in their organization"
  ON organization_members FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage members in their organization" ON organization_members;
CREATE POLICY "Admins can manage members in their organization"
  ON organization_members FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid()
      AND organization_id = get_user_organization_id()
      AND role = 'admin'
    )
  );

-- Job Assignments policies
DROP POLICY IF EXISTS "Users can view assignments in their organization" ON job_assignments;
CREATE POLICY "Users can view assignments in their organization"
  ON job_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_assignments.job_id
      AND jobs.organization_id = get_user_organization_id()
    )
  );

-- Hazards policies
DROP POLICY IF EXISTS "Users can view hazards in their organization" ON hazards;
CREATE POLICY "Users can view hazards in their organization"
  ON hazards FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can manage hazards in their organization" ON hazards;
CREATE POLICY "Users can manage hazards in their organization"
  ON hazards FOR ALL
  USING (organization_id = get_user_organization_id());

-- Controls policies
DROP POLICY IF EXISTS "Users can view controls in their organization" ON controls;
CREATE POLICY "Users can view controls in their organization"
  ON controls FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can manage controls in their organization" ON controls;
CREATE POLICY "Users can manage controls in their organization"
  ON controls FOR ALL
  USING (organization_id = get_user_organization_id());

-- Risk Scores policies
DROP POLICY IF EXISTS "Users can view risk scores in their organization" ON risk_scores;
CREATE POLICY "Users can view risk scores in their organization"
  ON risk_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = risk_scores.job_id
      AND jobs.organization_id = get_user_organization_id()
    )
  );

-- Job Photos policies
DROP POLICY IF EXISTS "Users can view photos in their organization" ON job_photos;
CREATE POLICY "Users can view photos in their organization"
  ON job_photos FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can manage photos in their organization" ON job_photos;
CREATE POLICY "Users can manage photos in their organization"
  ON job_photos FOR ALL
  USING (organization_id = get_user_organization_id());

-- Job Documents policies
DROP POLICY IF EXISTS "Users can view documents in their organization" ON job_documents;
CREATE POLICY "Users can view documents in their organization"
  ON job_documents FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can manage documents in their organization" ON job_documents;
CREATE POLICY "Users can manage documents in their organization"
  ON job_documents FOR ALL
  USING (organization_id = get_user_organization_id());

-- Signatures policies
DROP POLICY IF EXISTS "Users can view signatures in their organization" ON signatures;
CREATE POLICY "Users can view signatures in their organization"
  ON signatures FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can manage signatures in their organization" ON signatures;
CREATE POLICY "Users can manage signatures in their organization"
  ON signatures FOR ALL
  USING (organization_id = get_user_organization_id());

-- Compliance Checks policies
DROP POLICY IF EXISTS "Users can view compliance checks in their organization" ON compliance_checks;
CREATE POLICY "Users can view compliance checks in their organization"
  ON compliance_checks FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can manage compliance checks in their organization" ON compliance_checks;
CREATE POLICY "Users can manage compliance checks in their organization"
  ON compliance_checks FOR ALL
  USING (organization_id = get_user_organization_id());

-- Job Reports policies
DROP POLICY IF EXISTS "Users can view reports in their organization" ON job_reports;
CREATE POLICY "Users can view reports in their organization"
  ON job_reports FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can manage reports in their organization" ON job_reports;
CREATE POLICY "Users can manage reports in their organization"
  ON job_reports FOR ALL
  USING (organization_id = get_user_organization_id());

-- Usage Logs policies
DROP POLICY IF EXISTS "Users can view usage logs in their organization" ON usage_logs;
CREATE POLICY "Users can view usage logs in their organization"
  ON usage_logs FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Sync Queue policies
DROP POLICY IF EXISTS "Users can manage their own sync queue" ON sync_queue;
CREATE POLICY "Users can manage their own sync queue"
  ON sync_queue FOR ALL
  USING (user_id = auth.uid());

-- Job Metrics policies
DROP POLICY IF EXISTS "Users can view metrics in their organization" ON job_metrics;
CREATE POLICY "Users can view metrics in their organization"
  ON job_metrics FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Templates policies
DROP POLICY IF EXISTS "Users can view templates in their organization" ON templates;
CREATE POLICY "Users can view templates in their organization"
  ON templates FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage templates in their organization" ON templates;
CREATE POLICY "Admins can manage templates in their organization"
  ON templates FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid()
      AND organization_id = get_user_organization_id()
      AND role = 'admin'
    )
  );

-- Notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- API Keys policies
DROP POLICY IF EXISTS "Admins can view API keys in their organization" ON api_keys;
CREATE POLICY "Admins can view API keys in their organization"
  ON api_keys FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid()
      AND organization_id = get_user_organization_id()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage API keys in their organization" ON api_keys;
CREATE POLICY "Admins can manage API keys in their organization"
  ON api_keys FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid()
      AND organization_id = get_user_organization_id()
      AND role = 'admin'
    )
  );

