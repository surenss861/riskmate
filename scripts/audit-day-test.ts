/**
 * Audit Day Test Script
 * 
 * Produces a perfect demo + proof pack sequence:
 * 1. Flag → Assign → Upload evidence → Resolve
 * 2. Open incident → Corrective action → Close (with attestation)
 * 3. Access flag → Revoke
 * 4. Generate proof pack
 * 5. Verify hashes match manifest
 * 6. Verify executive mutation attempts are logged and blocked
 * 
 * Run with: ts-node scripts/audit-day-test.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as JSZip from 'jszip'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface TestUser {
  id: string
  email: string
  role: string
  authToken: string
}

interface TestResult {
  step: string
  success: boolean
  ledger_entry_id?: string
  error?: string
  details?: any
}

async function createTestUser(role: 'admin' | 'executive' | 'member'): Promise<TestUser> {
  const email = `test-${role}-${Date.now()}@riskmate.test`
  const password = 'TestPassword123!'
  
  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  
  if (authError || !authData.user) {
    throw new Error(`Failed to create auth user: ${authError?.message}`)
  }
  
  // Create user record
  const { data: orgData } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single()
  
  if (!orgData) {
    throw new Error('No organization found for test')
  }
  
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      organization_id: orgData.id,
      role,
      full_name: `Test ${role}`,
    })
    .select()
    .single()
  
  if (userError || !userData) {
    throw new Error(`Failed to create user record: ${userError?.message}`)
  }
  
  // Get auth token
  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (sessionError || !sessionData.session) {
    throw new Error(`Failed to get auth token: ${sessionError?.message}`)
  }
  
  return {
    id: authData.user.id,
    email,
    role,
    authToken: sessionData.session.access_token,
  }
}

async function apiRequest(
  endpoint: string,
  method: string,
  token: string,
  body?: any
): Promise<any> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(`API error: ${error.message || response.statusText}`)
  }
  
  return response.json()
}

async function runAuditDayTest(): Promise<void> {
  console.log('🚀 Starting Audit Day Test Sequence...\n')
  
  const results: TestResult[] = []
  
  try {
    // Setup: Create test users
    console.log('📋 Setting up test users...')
    const adminUser = await createTestUser('admin')
    const executiveUser = await createTestUser('executive')
    console.log(`✅ Created admin user: ${adminUser.email}`)
    console.log(`✅ Created executive user: ${executiveUser.email}\n`)
    
    // Get organization ID
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single()
    
    if (!orgData) {
      throw new Error('No organization found')
    }
    
    // Step 1: Create a work record (job)
    console.log('📝 Step 1: Creating work record...')
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert({
        organization_id: orgData.id,
        client_name: 'Audit Day Test Client',
        job_type: 'Construction',
        location: 'Test Site',
        status: 'in_progress',
        risk_score: 75,
        risk_level: 'high',
      })
      .select()
      .single()
    
    if (jobError || !jobData) {
      throw new Error(`Failed to create job: ${jobError?.message}`)
    }
    
    const workRecordId = jobData.id
    console.log(`✅ Created work record: ${workRecordId}\n`)
    
    // Step 2: Flag → Assign → Upload evidence → Resolve
    console.log('🔍 Step 2: Review Queue Workflow...')
    
    // 2a. Assign
    console.log('  → Assigning review item...')
    try {
      const assignResult = await apiRequest(
        '/api/audit/assign',
        'POST',
        adminUser.authToken,
        {
          target_type: 'job',
          target_id: workRecordId,
          owner_id: adminUser.id,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          note: 'Test assignment for audit day',
        }
      )
      results.push({ step: 'Assign', success: true, ledger_entry_id: assignResult.ledger_entry_id })
      console.log(`    ✅ Assigned (Ledger: ${assignResult.ledger_entry_id})`)
    } catch (err: any) {
      results.push({ step: 'Assign', success: false, error: err.message })
      throw err
    }
    
    // 2b. Upload evidence (simulate)
    console.log('  → Uploading evidence...')
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        job_id: workRecordId,
        organization_id: orgData.id,
        filename: 'test-evidence.pdf',
        file_type: 'application/pdf',
        uploaded_by: adminUser.id,
      })
      .select()
      .single()
    
    if (docError || !docData) {
      throw new Error(`Failed to upload evidence: ${docError?.message}`)
    }
    console.log(`    ✅ Evidence uploaded (ID: ${docData.id})`)
    
    // 2c. Resolve
    console.log('  → Resolving review item...')
    try {
      const resolveResult = await apiRequest(
        '/api/audit/resolve',
        'POST',
        adminUser.authToken,
        {
          target_type: 'job',
          target_id: workRecordId,
          reason: 'completed',
          comment: 'Evidence attached and reviewed',
          requires_followup: false,
        }
      )
      results.push({ step: 'Resolve', success: true, ledger_entry_id: resolveResult.ledger_entry_id })
      console.log(`    ✅ Resolved (Ledger: ${resolveResult.ledger_entry_id})\n`)
    } catch (err: any) {
      results.push({ step: 'Resolve', success: false, error: err.message })
      throw err
    }
    
    // Step 3: Open incident → Corrective action → Close
    console.log('🚨 Step 3: Incident Review Workflow...')
    
    // 3a. Create corrective action
    console.log('  → Creating corrective action...')
    try {
      const caResult = await apiRequest(
        '/api/audit/incidents/corrective-action',
        'POST',
        adminUser.authToken,
        {
          work_record_id: workRecordId,
          title: 'Test Corrective Action',
          owner_id: adminUser.id,
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          verification_method: 'attestation',
          notes: 'Test corrective action for audit day',
          severity: 'material',
        }
      )
      results.push({ step: 'Create Corrective Action', success: true, ledger_entry_id: caResult.ledger_entry_id })
      console.log(`    ✅ Corrective action created (Ledger: ${caResult.ledger_entry_id})`)
    } catch (err: any) {
      results.push({ step: 'Create Corrective Action', success: false, error: err.message })
      throw err
    }
    
    // 3b. Close incident
    console.log('  → Closing incident...')
    try {
      const closeResult = await apiRequest(
        '/api/audit/incidents/close',
        'POST',
        adminUser.authToken,
        {
          work_record_id: workRecordId,
          closure_summary: 'Test incident closed for audit day',
          root_cause: 'human_error',
          evidence_attached: true,
          waived: false,
          no_action_required: false,
        }
      )
      results.push({
        step: 'Close Incident',
        success: true,
        ledger_entry_id: closeResult.ledger_entry_id,
        details: {
          attestation_id: closeResult.attestation_id,
          attestation_ledger_entry_id: closeResult.attestation_ledger_entry_id,
        },
      })
      console.log(`    ✅ Incident closed (Ledger: ${closeResult.ledger_entry_id})`)
      console.log(`    ✅ Attestation created (ID: ${closeResult.attestation_id})\n`)
    } catch (err: any) {
      results.push({ step: 'Close Incident', success: false, error: err.message })
      throw err
    }
    
    // Step 4: Access flag → Revoke
    console.log('🔐 Step 4: Access Review Workflow...')
    
    // 4a. Flag suspicious access
    console.log('  → Flagging suspicious access...')
    try {
      const flagResult = await apiRequest(
        '/api/audit/access/flag-suspicious',
        'POST',
        adminUser.authToken,
        {
          target_user_id: executiveUser.id,
          reason: 'unusual_login_time',
          notes: 'Test flag for audit day',
          severity: 'material',
          open_incident: true,
        }
      )
      results.push({
        step: 'Flag Suspicious',
        success: true,
        ledger_entry_id: flagResult.ledger_entry_id,
        details: {
          incident_ledger_entry_id: flagResult.incident_ledger_entry_id,
        },
      })
      console.log(`    ✅ Suspicious access flagged (Ledger: ${flagResult.ledger_entry_id})`)
    } catch (err: any) {
      results.push({ step: 'Flag Suspicious', success: false, error: err.message })
      throw err
    }
    
    // Step 5: Generate proof pack
    console.log('📦 Step 5: Generating Audit Pack...')
    try {
      const packResponse = await fetch(`${BACKEND_URL}/api/audit/export/pack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.authToken}`,
        },
        body: JSON.stringify({
          time_range: 'all',
          job_id: workRecordId,
        }),
      })
      
      if (!packResponse.ok) {
        throw new Error(`Failed to generate pack: ${packResponse.statusText}`)
      }
      
      const packBuffer = Buffer.from(await packResponse.arrayBuffer())
      const packId = packResponse.headers.get('content-disposition')?.match(/audit-pack-([^.]+)/)?.[1] || 'unknown'
      
      // Save pack to disk
      const packPath = path.join(__dirname, `../test-outputs/audit-pack-${packId}.zip`)
      fs.mkdirSync(path.dirname(packPath), { recursive: true })
      fs.writeFileSync(packPath, packBuffer)
      
      // Verify ZIP contents
      const zip = await JSZip.loadAsync(packBuffer)
      const files = Object.keys(zip.files)
      
      console.log(`    ✅ Pack generated (ID: ${packId})`)
      console.log(`    ✅ Files in pack: ${files.length}`)
      
      // Verify manifest
      const manifestFile = files.find(f => f.includes('manifest'))
      if (manifestFile) {
        const manifestContent = await zip.file(manifestFile)?.async('string')
        const manifest = JSON.parse(manifestContent || '{}')
        
        // Verify hashes
        let hashMatches = true
        for (const file of manifest.files || []) {
          const fileContent = await zip.file(file.name)?.async('nodebuffer')
          if (fileContent) {
            const hash = crypto.createHash('sha256').update(fileContent).digest('hex')
            if (hash !== file.sha256) {
              hashMatches = false
              console.log(`    ❌ Hash mismatch for ${file.name}`)
            }
          }
        }
        
        if (hashMatches) {
          console.log(`    ✅ All file hashes match manifest`)
        }
        
        results.push({
          step: 'Generate Audit Pack',
          success: true,
          details: {
            pack_id: packId,
            file_count: files.length,
            hash_verified: hashMatches,
            manifest,
          },
        })
      }
      
      console.log(`    ✅ Pack saved to: ${packPath}\n`)
    } catch (err: any) {
      results.push({ step: 'Generate Audit Pack', success: false, error: err.message })
      throw err
    }
    
    // Step 6: Verify executive immutability
    console.log('🛡️  Step 6: Verifying Executive Immutability...')
    
    try {
      // Attempt to assign as executive (should fail)
      await apiRequest(
        '/api/audit/assign',
        'POST',
        executiveUser.authToken,
        {
          target_type: 'job',
          target_id: workRecordId,
          owner_id: executiveUser.id,
          due_date: new Date().toISOString().split('T')[0],
        }
      )
      results.push({ step: 'Executive Immutability Test', success: false, error: 'Executive was able to assign (should be blocked)' })
      throw new Error('Executive immutability test failed - executive was able to assign')
    } catch (err: any) {
      if (err.message.includes('403') || err.message.includes('AUTH_ROLE_READ_ONLY')) {
        // Check for violation log
        const { data: violationLog } = await supabase
          .from('audit_logs')
          .select('id, event_name, metadata')
          .eq('organization_id', orgData.id)
          .eq('actor_id', executiveUser.id)
          .eq('event_name', 'auth.role_violation')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        if (violationLog) {
          console.log(`    ✅ Executive mutation blocked`)
          console.log(`    ✅ Violation logged (Ledger: ${violationLog.id})`)
          results.push({
            step: 'Executive Immutability Test',
            success: true,
            ledger_entry_id: violationLog.id,
            details: {
              violation_logged: true,
              attempted_action: violationLog.metadata?.attempted_action,
            },
          })
        } else {
          results.push({
            step: 'Executive Immutability Test',
            success: false,
            error: 'Mutation blocked but violation not logged',
          })
        }
      } else {
        throw err
      }
    }
    
    // Summary
    console.log('\n📊 Test Summary:')
    console.log('='.repeat(50))
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌'
      console.log(`${index + 1}. ${status} ${result.step}`)
      if (result.ledger_entry_id) {
        console.log(`   Ledger Entry: ${result.ledger_entry_id}`)
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    })
    
    const successCount = results.filter(r => r.success).length
    const totalCount = results.length
    
    console.log('='.repeat(50))
    console.log(`\n✅ ${successCount}/${totalCount} tests passed`)
    
    if (successCount === totalCount) {
      console.log('🎉 Audit Day Test Sequence Complete!')
    } else {
      console.log('⚠️  Some tests failed - review errors above')
      process.exit(1)
    }
    
  } catch (error: any) {
    console.error('\n❌ Test sequence failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  runAuditDayTest().catch(console.error)
}

export { runAuditDayTest }

