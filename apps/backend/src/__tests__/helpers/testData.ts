/**
 * Test Data Helper
 * 
 * Creates and cleans up test data for integration tests
 * Uses a dedicated test organization to isolate test data
 * 
 * Usage:
 *   const testData = await setupTestData();
 *   // Use testData.ownerToken, testData.auditorToken, etc.
 *   await cleanupTestData(testData.testOrgId);
 */

import { supabase } from "../../lib/supabaseClient";
import { getSupabaseAdmin } from "../../lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

export interface TestData {
  testOrgId: string;
  ownerUserId: string;
  auditorUserId: string;
  executiveUserId: string;
  ownerToken: string;
  auditorToken: string;
  executiveToken: string;
  testJobId: string;
  ownerEmail: string;
  auditorEmail: string;
  executiveEmail: string;
}

/**
 * Creates a test organization and users
 * Returns tokens and IDs for testing
 */
export async function setupTestData(): Promise<TestData> {
  const testOrgId = process.env.TEST_ORG_ID;
  if (!testOrgId) {
    throw new Error(
      "TEST_ORG_ID environment variable is required. " +
      "Create a test organization in Supabase and set TEST_ORG_ID in your test environment."
    );
  }

  // Verify test org exists and has expected name (safety fuse)
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", testOrgId)
    .single();

  if (orgError || !org) {
    throw new Error(
      `Test organization ${testOrgId} not found. ` +
      "Create a test organization in Supabase and set TEST_ORG_ID."
    );
  }

  if (org.name !== "RiskMate Test Org") {
    throw new Error(
      `Test organization name mismatch. Expected "RiskMate Test Org", got "${org.name}". ` +
      "This prevents accidental use of production data."
    );
  }

  // Get or create test users using service role (admin) client
  const adminClient = getSupabaseAdmin();
  
  // Test user emails (from CI secrets or env)
  const ownerEmail = process.env.TEST_OWNER_EMAIL || `test-owner-${Date.now()}@test.riskmate.dev`;
  const auditorEmail = process.env.TEST_AUDITOR_EMAIL || `test-auditor-${Date.now()}@test.riskmate.dev`;
  const executiveEmail = process.env.TEST_EXEC_EMAIL || `test-exec-${Date.now()}@test.riskmate.dev`;
  const testPassword = process.env.TEST_USER_PASSWORD || "TestPassword123!";

  // Helper to get or create user
  async function getOrCreateUser(email: string, password: string): Promise<string> {
    // Try to find existing user
    try {
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === email);
      
      if (existingUser) {
        return existingUser.id;
      }
    } catch (err) {
      // If list fails, try creating anyway
      console.warn(`Could not list users, attempting to create ${email}`);
    }

    // Create new user
    const { data: newUser, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      // If user already exists, try to find them again
      if (error.message.includes("already registered") || error.message.includes("already exists")) {
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u) => u.email === email);
        if (existingUser) {
          return existingUser.id;
        }
      }
      throw new Error(`Failed to create user ${email}: ${error.message}`);
    }

    if (!newUser?.user?.id) {
      throw new Error(`Failed to create user ${email}: No user ID returned`);
    }

    return newUser.user.id;
  }

  // Get or create all test users
  const ownerAuthId = await getOrCreateUser(ownerEmail, testPassword);
  const executiveAuthId = await getOrCreateUser(executiveEmail, testPassword);
  const auditorAuthId = await getOrCreateUser(auditorEmail, testPassword);

  if (!executiveAuthId || !auditorAuthId) {
    throw new Error("Failed to create test users");
  }

  // Create user records in public.users table
  const { error: ownerUserError } = await supabase
    .from("users")
    .upsert({
      id: ownerAuthId,
      email: ownerEmail,
      organization_id: testOrgId,
      role: "owner",
      full_name: "Test Owner",
    }, {
      onConflict: "id",
    });

  if (ownerUserError) {
    throw new Error(`Failed to create owner user record: ${ownerUserError.message}`);
  }

  const { error: executiveUserError } = await supabase
    .from("users")
    .upsert({
      id: executiveAuthId,
      email: executiveEmail,
      organization_id: testOrgId,
      role: "executive",
      full_name: "Test Executive",
    }, {
      onConflict: "id",
    });

  if (executiveUserError) {
    throw new Error(`Failed to create executive user record: ${executiveUserError.message}`);
  }

  const { error: auditorUserError } = await supabase
    .from("users")
    .upsert({
      id: auditorAuthId,
      email: auditorEmail,
      organization_id: testOrgId,
      role: "auditor",
      full_name: "Test Auditor",
    }, {
      onConflict: "id",
    });

  if (auditorUserError) {
    throw new Error(`Failed to create auditor user record: ${auditorUserError.message}`);
  }

  // Ensure organization_members entries exist
  await supabase
    .from("organization_members")
    .upsert([
      {
        user_id: ownerAuthId,
        organization_id: testOrgId,
        role: "admin",
      },
      {
        user_id: executiveAuthId,
        organization_id: testOrgId,
        role: "viewer",
      },
      {
        user_id: auditorAuthId,
        organization_id: testOrgId,
        role: "viewer",
      },
    ], {
      onConflict: "user_id,organization_id",
    });

  // Get JWT tokens by signing in (use anon client for this, not admin)
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);

  const { data: ownerSession } = await anonClient.auth.signInWithPassword({
    email: ownerEmail,
    password: testPassword,
  });

  const { data: executiveSession } = await anonClient.auth.signInWithPassword({
    email: executiveEmail,
    password: testPassword,
  });

  const { data: auditorSession } = await anonClient.auth.signInWithPassword({
    email: auditorEmail,
    password: testPassword,
  });

  if (!ownerSession?.session?.access_token || 
      !executiveSession?.session?.access_token || 
      !auditorSession?.session?.access_token) {
    throw new Error("Failed to get auth tokens for test users");
  }

  // Create a test job
  const { data: testJob, error: jobError } = await supabase
    .from("jobs")
    .insert({
      organization_id: testOrgId,
      client_name: "Test Client",
      job_type: "inspection",
      location: "Test Location",
      status: "in_progress",
      created_by: ownerAuthId,
    })
    .select()
    .single();

  if (jobError) {
    throw new Error(`Failed to create test job: ${jobError.message}`);
  }

  return {
    testOrgId,
    ownerUserId: ownerAuthId,
    auditorUserId: auditorAuthId,
    executiveUserId: executiveAuthId,
    ownerToken: ownerSession.session.access_token,
    auditorToken: auditorSession.session.access_token,
    executiveToken: executiveSession.session.access_token,
    testJobId: testJob.id,
    ownerEmail,
    auditorEmail,
    executiveEmail,
  };
}

/**
 * Cleans up test data for a test organization
 * Deletes in order to respect foreign key constraints
 */
export async function cleanupTestData(testOrgId: string): Promise<void> {
  // Verify this is the test org (safety fuse)
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", testOrgId)
    .single();

  if (orgError || !org) {
    console.warn(`Test organization ${testOrgId} not found, skipping cleanup`);
    return;
  }

  if (org.name !== "RiskMate Test Org") {
    throw new Error(
      `Safety fuse: Attempted to cleanup non-test organization "${org.name}". ` +
      "Only 'RiskMate Test Org' can be cleaned up by tests."
    );
  }

  // Delete in order to respect foreign key constraints
  // Order: child tables first, then parent tables
  // Most have ON DELETE CASCADE, but explicit order prevents issues

  // 1. Job-related child tables (deepest level first)
  // Controls reference hazards, so hazards must be deleted first
  await supabase
    .from("controls")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("hazards")
    .delete()
    .eq("organization_id", testOrgId);

  // Evidence verifications reference documents/jobs
  await supabase
    .from("evidence_verifications")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("evidence")
    .delete()
    .eq("organization_id", testOrgId);

  // Report runs and signatures reference jobs
  await supabase
    .from("report_signatures")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("report_runs")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("signatures")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("job_assignments")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("job_documents")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("job_signoffs")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("mitigation_items")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("job_photos")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("risk_scores")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("job_risk_scores")
    .delete()
    .eq("organization_id", testOrgId);

  // 2. Jobs (parent of above)
  // This will cascade delete any remaining child rows due to ON DELETE CASCADE
  await supabase
    .from("jobs")
    .delete()
    .eq("organization_id", testOrgId);

  // 3. Organization-scoped tables (not job-dependent)
  await supabase
    .from("exports")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("sites")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("ledger_roots")
    .delete()
    .eq("organization_id", testOrgId);

  await supabase
    .from("idempotency_keys")
    .delete()
    .eq("organization_id", testOrgId);

  // 4. Audit logs (optional, but good to clean)
  // Note: audit_logs.job_id has ON DELETE SET NULL, so jobs deletion won't remove these
  await supabase
    .from("audit_logs")
    .delete()
    .eq("organization_id", testOrgId);

  // 5. Organization members
  await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", testOrgId);

  // Note: We don't delete users or the organization itself
  // Users can be reused across test runs
  // Organization should remain for consistency
}
