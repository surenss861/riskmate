/**
 * Test Setup Helpers
 * 
 * Utilities for setting up test users and data for executive immutability tests.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('Test setup requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars')
}

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

export interface TestUser {
  id: string
  email: string
  token: string
  role: 'executive' | 'admin' | 'owner' | 'member'
  organizationId: string
}

export interface TestData {
  organizationId: string
  executive: TestUser
  admin: TestUser
  jobId: string
  controlId: string
  attestationId: string
  documentId: string
  siteId: string
}

/**
 * Creates a test organization with users for testing
 */
export async function createTestOrganization(): Promise<TestData | null> {
  if (!supabaseAdmin) {
    console.warn('Cannot create test organization: supabaseAdmin not initialized')
    return null
  }

  const timestamp = Date.now()
  const orgName = `Test Org ${timestamp}`

  // Create organization
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({
      name: orgName,
      trade_type: 'other',
      subscription_tier: 'business',
      subscription_status: 'active',
    })
    .select()
    .single()

  if (orgError || !org) {
    console.error('Failed to create test organization:', orgError)
    return null
  }

  // Create executive user
  const execEmail = `executive-${timestamp}@test.riskmate.dev`
  const { data: execAuth, error: execAuthError } = await supabaseAdmin.auth.admin.createUser({
    email: execEmail,
    password: 'test-password-123',
    email_confirm: true,
  })

  if (execAuthError || !execAuth?.user) {
    console.error('Failed to create executive auth user:', execAuthError)
    return null
  }

  const { data: execUser, error: execUserError } = await supabaseAdmin
    .from('users')
    .insert({
      id: execAuth.user.id,
      email: execEmail,
      full_name: 'Test Executive',
      organization_id: org.id,
      role: 'executive',
    })
    .select()
    .single()

  if (execUserError || !execUser) {
    console.error('Failed to create executive user:', execUserError)
    return null
  }

  // Create admin user
  const adminEmail = `admin-${timestamp}@test.riskmate.dev`
  const { data: adminAuth, error: adminAuthError } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: 'test-password-123',
    email_confirm: true,
  })

  if (adminAuthError || !adminAuth?.user) {
    console.error('Failed to create admin auth user:', adminAuthError)
    return null
  }

  const { data: adminUser, error: adminUserError } = await supabaseAdmin
    .from('users')
    .insert({
      id: adminAuth.user.id,
      email: adminEmail,
      full_name: 'Test Admin',
      organization_id: org.id,
      role: 'admin',
    })
    .select()
    .single()

  if (adminUserError || !adminUser) {
    console.error('Failed to create admin user:', adminUserError)
    return null
  }

  // Get auth tokens (using sign-in with service role)
  // Note: In real tests, you'd want to use the actual sign-in flow
  // For now, we'll use service role to generate tokens
  const execToken = await getAuthTokenForUser(execAuth.user.id)
  const adminToken = await getAuthTokenForUser(adminAuth.user.id)

  // Create test job via admin
  const { data: testJob, error: jobError } = await supabaseAdmin
    .from('jobs')
    .insert({
      organization_id: org.id,
      client_name: 'Test Job',
      job_type: 'inspection',
      location: 'Test Location',
      status: 'in_progress',
    })
    .select()
    .single()

  if (jobError || !testJob) {
    console.error('Failed to create test job:', jobError)
    return null
  }

  // Create test control (mitigation item)
  const { data: testControl, error: controlError } = await supabaseAdmin
    .from('mitigation_items')
    .insert({
      job_id: testJob.id,
      title: 'Test Control',
      description: 'Test control description',
      done: false,
    })
    .select()
    .single()

  if (controlError || !testControl) {
    console.error('Failed to create test control:', controlError)
  }

  // Create test attestation (sign-off)
  const { data: testAttestation, error: attestationError } = await supabaseAdmin
    .from('job_signoffs')
    .insert({
      job_id: testJob.id,
      signoff_type: 'safety_review',
      status: 'pending',
      signed_by: adminUser.id,
    })
    .select()
    .single()

  if (attestationError || !testAttestation) {
    console.error('Failed to create test attestation:', attestationError)
  }

  // Create test site
  const { data: testSite, error: siteError } = await supabaseAdmin
    .from('sites')
    .insert({
      organization_id: org.id,
      name: 'Test Site',
    })
    .select()
    .single()

  if (siteError || !testSite) {
    console.error('Failed to create test site:', siteError)
  }

  // Create test document (evidence)
  const { data: testDocument, error: docError } = await supabaseAdmin
    .from('documents')
    .insert({
      job_id: testJob.id,
      organization_id: org.id,
      name: 'Test Document',
      type: 'safety_certificate',
    })
    .select()
    .single()

  if (docError || !testDocument) {
    console.error('Failed to create test document:', docError)
  }

  return {
    organizationId: org.id,
    executive: {
      id: execUser.id,
      email: execEmail,
      token: execToken || '',
      role: 'executive',
      organizationId: org.id,
    },
    admin: {
      id: adminUser.id,
      email: adminEmail,
      token: adminToken || '',
      role: 'admin',
      organizationId: org.id,
    },
    jobId: testJob.id,
    controlId: testControl?.id || '',
    attestationId: testAttestation?.id || '',
    documentId: testDocument?.id || '',
    siteId: testSite?.id || '',
  }
}

/**
 * Cleanup test organization and all related data
 */
export async function cleanupTestOrganization(testData: TestData): Promise<void> {
  if (!supabaseAdmin) return

  try {
    // Delete in reverse order of dependencies
    await supabaseAdmin.from('documents').delete().eq('organization_id', testData.organizationId)
    await supabaseAdmin.from('job_signoffs').delete().in('job_id', [testData.jobId])
    await supabaseAdmin.from('mitigation_items').delete().eq('job_id', testData.jobId)
    await supabaseAdmin.from('jobs').delete().eq('organization_id', testData.organizationId)
    await supabaseAdmin.from('sites').delete().eq('organization_id', testData.organizationId)
    await supabaseAdmin.from('users').delete().eq('organization_id', testData.organizationId)
    await supabaseAdmin.auth.admin.deleteUser(testData.executive.id)
    await supabaseAdmin.auth.admin.deleteUser(testData.admin.id)
    await supabaseAdmin.from('organizations').delete().eq('id', testData.organizationId)
  } catch (err) {
    console.error('Error cleaning up test organization:', err)
  }
}

/**
 * Helper to get auth token for a user
 * 
 * IMPORTANT: For test execution, you have two options:
 * 
 * Option 1: Use service role key directly (bypasses RLS)
 * - Use supabaseAdmin with service role key
 * - This is fastest but doesn't test RLS policies
 * 
 * Option 2: Generate actual JWT tokens (recommended for RLS testing)
 * - Use Supabase Admin API to generate tokens: supabaseAdmin.auth.admin.generateLink()
 * - Or implement actual sign-in flow using test credentials
 * - This properly tests both API layer and RLS layer
 * 
 * For CI/CD, use environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - Optionally: TEST_USER_PASSWORD (for sign-in flow)
 */
async function getAuthTokenForUser(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null
  
  // Option 1: Generate a link with token (requires email)
  // const { data, error } = await supabaseAdmin.auth.admin.generateLink({
  //   type: 'magiclink',
  //   email: userEmail,
  // })
  // return data?.properties?.hashed_token || null
  
  // Option 2: Use service role (bypasses auth, tests RLS only)
  // For now, return null - tests should use service role key directly for RLS testing
  // or implement proper sign-in flow for full integration testing
  return null
}

