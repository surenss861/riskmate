-- Row Level Security (RLS) Policies
-- Enable RLS on all tables

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_snapshot_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Organizations policies
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update their organization" ON organizations;
CREATE POLICY "Users can update their organization"
  ON organizations FOR UPDATE
  USING (id = get_user_organization_id());

-- Users policies
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Jobs policies
DROP POLICY IF EXISTS "Users can view jobs in their organization" ON jobs;
CREATE POLICY "Users can view jobs in their organization"
  ON jobs FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create jobs in their organization" ON jobs;
CREATE POLICY "Users can create jobs in their organization"
  ON jobs FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update jobs in their organization" ON jobs;
CREATE POLICY "Users can update jobs in their organization"
  ON jobs FOR UPDATE
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete jobs in their organization" ON jobs;
CREATE POLICY "Users can delete jobs in their organization"
  ON jobs FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Risk factors policies (read-only for all authenticated users)
DROP POLICY IF EXISTS "Authenticated users can view risk factors" ON risk_factors;
CREATE POLICY "Authenticated users can view risk factors"
  ON risk_factors FOR SELECT
  TO authenticated
  USING (true);

-- Job risk scores policies
DROP POLICY IF EXISTS "Users can view risk scores for jobs in their organization" ON job_risk_scores;
CREATE POLICY "Users can view risk scores for jobs in their organization"
  ON job_risk_scores FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Users can create risk scores for jobs in their organization" ON job_risk_scores;
CREATE POLICY "Users can create risk scores for jobs in their organization"
  ON job_risk_scores FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Users can update risk scores for jobs in their organization" ON job_risk_scores;
CREATE POLICY "Users can update risk scores for jobs in their organization"
  ON job_risk_scores FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE organization_id = get_user_organization_id()
    )
  );

-- Mitigation items policies
DROP POLICY IF EXISTS "Users can view mitigation items for jobs in their organization" ON mitigation_items;
CREATE POLICY "Users can view mitigation items for jobs in their organization"
  ON mitigation_items FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Users can create mitigation items for jobs in their organization" ON mitigation_items;
CREATE POLICY "Users can create mitigation items for jobs in their organization"
  ON mitigation_items FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Users can update mitigation items for jobs in their organization" ON mitigation_items;
CREATE POLICY "Users can update mitigation items for jobs in their organization"
  ON mitigation_items FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE organization_id = get_user_organization_id()
    )
  );

-- Documents policies
DROP POLICY IF EXISTS "Users can view documents in their organization" ON documents;
CREATE POLICY "Users can view documents in their organization"
  ON documents FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create documents in their organization" ON documents;
CREATE POLICY "Users can create documents in their organization"
  ON documents FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete documents in their organization" ON documents;
CREATE POLICY "Users can delete documents in their organization"
  ON documents FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Risk snapshot reports policies
DROP POLICY IF EXISTS "Users can view reports in their organization" ON risk_snapshot_reports;
CREATE POLICY "Users can view reports in their organization"
  ON risk_snapshot_reports FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create reports in their organization" ON risk_snapshot_reports;
CREATE POLICY "Users can create reports in their organization"
  ON risk_snapshot_reports FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Subscriptions policies
DROP POLICY IF EXISTS "Users can view subscriptions in their organization" ON subscriptions;
CREATE POLICY "Users can view subscriptions in their organization"
  ON subscriptions FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can create notifications for users" ON notifications;
CREATE POLICY "System can create notifications for users"
  ON notifications FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Sub attestations policies
DROP POLICY IF EXISTS "Users can view attestations in their organization" ON sub_attestations;
CREATE POLICY "Users can view attestations in their organization"
  ON sub_attestations FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create attestations in their organization" ON sub_attestations;
CREATE POLICY "Users can create attestations in their organization"
  ON sub_attestations FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update attestations in their organization" ON sub_attestations;
CREATE POLICY "Users can update attestations in their organization"
  ON sub_attestations FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- Analytics events policies
DROP POLICY IF EXISTS "Users can view their organization's analytics events" ON analytics_events;
CREATE POLICY "Users can view their organization's analytics events"
  ON analytics_events FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert analytics events" ON analytics_events;
CREATE POLICY "Users can insert analytics events"
  ON analytics_events FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

