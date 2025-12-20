-- Executive Read-Only Enforcement
-- Enforces that executives are technically incapable of mutating governance records
-- This is a legal positioning improvement, not a UX feature

-- Jobs: Executives cannot update or delete
DROP POLICY IF EXISTS "Executives cannot update jobs" ON jobs;
CREATE POLICY "Executives cannot update jobs"
  ON jobs
  FOR UPDATE
  USING (
    -- Allow if user is NOT an executive
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

DROP POLICY IF EXISTS "Executives cannot delete jobs" ON jobs;
CREATE POLICY "Executives cannot delete jobs"
  ON jobs
  FOR DELETE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

-- Job Sign-offs: Executives cannot create or update
DROP POLICY IF EXISTS "Executives cannot create sign-offs" ON job_signoffs;
CREATE POLICY "Executives cannot create sign-offs"
  ON job_signoffs
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

DROP POLICY IF EXISTS "Executives cannot update sign-offs" ON job_signoffs;
CREATE POLICY "Executives cannot update sign-offs"
  ON job_signoffs
  FOR UPDATE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

-- Documents: Executives cannot create, update, or delete
DROP POLICY IF EXISTS "Executives cannot create documents" ON documents;
CREATE POLICY "Executives cannot create documents"
  ON documents
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

DROP POLICY IF EXISTS "Executives cannot update documents" ON documents;
CREATE POLICY "Executives cannot update documents"
  ON documents
  FOR UPDATE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

DROP POLICY IF EXISTS "Executives cannot delete documents" ON documents;
CREATE POLICY "Executives cannot delete documents"
  ON documents
  FOR DELETE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

-- Mitigation Items: Executives cannot update
DROP POLICY IF EXISTS "Executives cannot update mitigations" ON mitigation_items;
CREATE POLICY "Executives cannot update mitigations"
  ON mitigation_items
  FOR UPDATE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

-- Sites: Executives cannot update or delete
DROP POLICY IF EXISTS "Executives cannot update sites" ON sites;
CREATE POLICY "Executives cannot update sites"
  ON sites
  FOR UPDATE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

DROP POLICY IF EXISTS "Executives cannot delete sites" ON sites;
CREATE POLICY "Executives cannot delete sites"
  ON sites
  FOR DELETE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

-- Audit Logs: Executives cannot insert (already append-only, but explicit)
-- Note: The existing "Users can insert audit logs" policy allows all org members
-- We need to refine it to exclude executives
DROP POLICY IF EXISTS "Users can insert audit logs" ON audit_logs;
CREATE POLICY "Users can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (SELECT role FROM users WHERE id = auth.uid()) != 'executive'
  );

-- Add comments for documentation
COMMENT ON POLICY "Executives cannot update jobs" ON jobs IS 
  'Enforces executive read-only access. Executives are technically incapable of mutating governance records.';
COMMENT ON POLICY "Executives cannot delete jobs" ON jobs IS 
  'Enforces executive read-only access. Oversight and authority are intentionally separated.';
COMMENT ON POLICY "Executives cannot create sign-offs" ON job_signoffs IS 
  'Executives cannot create sign-offs. This separation ensures oversight cannot be self-validated.';
COMMENT ON POLICY "Executives cannot update sign-offs" ON job_signoffs IS 
  'Executives cannot modify sign-offs. This maintains audit trail integrity.';
COMMENT ON POLICY "Executives cannot create documents" ON documents IS 
  'Executives cannot upload or create documents. This prevents evidence manipulation.';
COMMENT ON POLICY "Executives cannot update documents" ON documents IS 
  'Executives cannot modify documents. This maintains document integrity.';
COMMENT ON POLICY "Executives cannot delete documents" ON documents IS 
  'Executives cannot delete documents. This prevents evidence destruction.';
COMMENT ON POLICY "Executives cannot update mitigations" ON mitigation_items IS 
  'Executives cannot modify mitigation items. This maintains operational accountability.';
COMMENT ON POLICY "Executives cannot update sites" ON sites IS 
  'Executives cannot modify sites. This maintains site configuration integrity.';
COMMENT ON POLICY "Executives cannot delete sites" ON sites IS 
  'Executives cannot delete sites. This prevents operational disruption.';
COMMENT ON POLICY "Users can insert audit logs" ON audit_logs IS 
  'Allows organization members to insert audit logs, except executives. Executives are read-only observers.';

