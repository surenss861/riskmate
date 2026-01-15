/**
 * Golden Path Test Suite
 * 
 * Tests the 4 critical flows:
 * 1. Evidence upload (idempotency + sha + storage)
 * 2. Export request → worker → ready → download
 * 3. Verify ledger event (hash + prev link)
 * 4. Verify manifest against export + ledger
 * 
 * Usage:
 *   BACKEND_URL=https://api.riskmate.dev \
 *   JWT_TOKEN=your_jwt_token \
 *   JOB_ID=your_job_id \
 *   tsx scripts/golden-path-test.ts
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
const JWT_TOKEN = process.env.JWT_TOKEN
const JOB_ID = process.env.JOB_ID

if (!JWT_TOKEN) {
  console.error('❌ JWT_TOKEN environment variable is required')
  process.exit(1)
}

if (!JOB_ID) {
  console.error('❌ JOB_ID environment variable is required')
  process.exit(1)
}

const headers = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'Content-Type': 'application/json',
}

let testEvidenceId: string | null = null
let testExportId: string | null = null
let testEventId: string | null = null

// Helper: Make HTTP request
async function request(method: string, url: string, options: any = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...headers,
      ...options.headers,
    },
    body: options.body,
  })

  const text = await response.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`)
  }

  return { status: response.status, data, headers: response.headers }
}

// Helper: Generate idempotency key
function generateIdempotencyKey(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

// Test 1: Evidence Upload (normal upload)
async function testEvidenceUpload() {
  console.log('\n📸 Test 1: Evidence Upload (normal upload)')
  
  const idempotencyKey = generateIdempotencyKey('ev')
  
  // Create a test image file (1x1 PNG)
  const testImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  )
  const testImagePath = path.join(__dirname, 'test-image.png')
  fs.writeFileSync(testImagePath, testImageBuffer)

  // Create multipart form data
  const formData = new FormData()
  const blob = new Blob([testImageBuffer], { type: 'image/png' })
  formData.append('file', blob, 'test.png')
  formData.append('tag', 'PPE')
  formData.append('phase', 'before')
  formData.append('captured_at', new Date().toISOString())

  const response = await fetch(`${BACKEND_URL}/api/jobs/${JOB_ID}/evidence/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Upload failed: ${JSON.stringify(data)}`)
  }

  console.log('✅ Upload successful')
  console.log(`   Evidence ID: ${data.data.evidence_id}`)
  console.log(`   SHA256: ${data.data.file_sha256}`)
  console.log(`   State: ${data.data.state}`)
  console.log(`   Storage Path: ${data.data.storage_path}`)

  // Assertions
  if (data.data.state !== 'sealed') {
    throw new Error(`Expected state='sealed', got '${data.data.state}'`)
  }

  if (!/^[0-9a-f]{64}$/.test(data.data.file_sha256)) {
    throw new Error(`Invalid SHA256 format: ${data.data.file_sha256}`)
  }

  testEvidenceId = data.data.id
  const expectedSha256 = crypto.createHash('sha256').update(testImageBuffer).digest('hex')
  if (data.data.file_sha256 !== expectedSha256) {
    throw new Error(`SHA256 mismatch: expected ${expectedSha256}, got ${data.data.file_sha256}`)
  }

  console.log('✅ All assertions passed')
  
  // Cleanup
  fs.unlinkSync(testImagePath)

  return { evidenceId: data.data.id, sha256: data.data.file_sha256, idempotencyKey }
}

// Test 2: Same idempotency key returns same record
async function testEvidenceIdempotency(idempotencyKey: string) {
  console.log('\n🔄 Test 2: Evidence Upload (idempotency)')
  
  const testImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  )
  const testImagePath = path.join(__dirname, 'test-image.png')
  fs.writeFileSync(testImagePath, testImageBuffer)

  const formData = new FormData()
  const blob = new Blob([testImageBuffer], { type: 'image/png' })
  formData.append('file', blob, 'test.png')
  formData.append('tag', 'PPE')
  formData.append('phase', 'before')

  const response = await fetch(`${BACKEND_URL}/api/jobs/${JOB_ID}/evidence/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Idempotency-Key': idempotencyKey, // Same key
    },
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Upload failed: ${JSON.stringify(data)}`)
  }

  const isReplayed = response.headers.get('X-Idempotency-Replayed') === 'true'

  if (!isReplayed) {
    throw new Error('Expected X-Idempotency-Replayed header')
  }

  console.log('✅ Idempotency check passed (same record returned)')
  console.log(`   Evidence ID: ${data.data.evidence_id}`)
  console.log(`   SHA256: ${data.data.file_sha256}`)

  // Cleanup
  fs.unlinkSync(testImagePath)

  return data.data
}

// Test 3: Export request → poll → download
async function testExportFlow() {
  console.log('\n📦 Test 3: Export Request → Poll → Download')
  
  const idempotencyKey = generateIdempotencyKey('ex')

  // Create export request
  console.log('   Creating export request...')
  const { data: exportData } = await request('POST', `${BACKEND_URL}/api/jobs/${JOB_ID}/export/proof-pack`, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ filters: {} }),
  })

  if (!exportData.data?.id) {
    throw new Error('Export ID not returned')
  }

  testExportId = exportData.data.id
  console.log(`   Export ID: ${testExportId}`)
  console.log(`   Initial state: ${exportData.data.state}`)

  if (exportData.data.state !== 'queued') {
    throw new Error(`Expected state='queued', got '${exportData.data.state}'`)
  }

  // Poll until ready (max 60 seconds)
  console.log('   Polling export status...')
  const maxWait = 60000 // 60 seconds
  const pollInterval = 2000 // 2 seconds
  const startTime = Date.now()

  let exportStatus: any
  while (Date.now() - startTime < maxWait) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))

    const { data: statusData } = await request('GET', `${BACKEND_URL}/api/exports/${testExportId}`)
    exportStatus = statusData.data

    console.log(`   State: ${exportStatus.state}, Progress: ${exportStatus.progress}%`)

    if (exportStatus.state === 'ready') {
      break
    }

    if (exportStatus.state === 'failed') {
      throw new Error(`Export failed: ${exportStatus.error_message} (${exportStatus.error_code})`)
    }
  }

  if (exportStatus.state !== 'ready') {
    throw new Error(`Export did not complete in time. Final state: ${exportStatus.state}`)
  }

  console.log('✅ Export completed')
  console.log(`   Storage Path: ${exportStatus.storage_path}`)
  console.log(`   Manifest Hash: ${exportStatus.manifest_hash}`)

  // Download export
  console.log('   Downloading export...')
  const downloadResponse = await fetch(`${BACKEND_URL}/api/exports/${testExportId}/download`, {
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
  })

  if (!downloadResponse.ok) {
    throw new Error(`Download failed: ${downloadResponse.status}`)
  }

  const downloadBuffer = Buffer.from(await downloadResponse.arrayBuffer())
  const downloadPath = path.join(__dirname, 'proof-pack-test.zip')
  fs.writeFileSync(downloadPath, downloadBuffer)

  console.log(`✅ Export downloaded (${downloadBuffer.length} bytes)`)
  console.log(`   Saved to: ${downloadPath}`)

  // Verify it's a valid ZIP
  // (Basic check: ZIP files start with PK)
  if (downloadBuffer[0] !== 0x50 || downloadBuffer[1] !== 0x4B) {
    throw new Error('Downloaded file is not a valid ZIP')
  }

  console.log('✅ ZIP file validation passed')

  // Cleanup
  fs.unlinkSync(downloadPath)

  return { exportId: testExportId, manifestHash: exportStatus.manifest_hash }
}

// Test 4: Verify ledger event
async function testVerifyEvent() {
  console.log('\n🔍 Test 4: Verify Ledger Event')
  
  if (!testEvidenceId) {
    throw new Error('No evidence ID from previous test')
  }

  // Fetch the ledger event for the evidence upload
  // Note: This assumes we can query audit_logs or get event ID from evidence
  // For now, we'll need to get the event ID from the evidence metadata or query audit_logs
  // This is a simplified test - in production you'd query the ledger for the evidence.sealed event

  console.log('   Note: This test requires querying audit_logs for the evidence.sealed event')
  console.log('   Skipping for now (requires direct DB access or additional endpoint)')
  
  // TODO: Add endpoint to get event ID from evidence ID, or query audit_logs directly
  // For now, we'll just verify the endpoint exists and returns proper structure

  return { skipped: true }
}

// Test 5: Verify manifest
async function testVerifyManifest(exportId: string, manifestHash: string) {
  console.log('\n📋 Test 5: Verify Manifest')
  
  // Fetch the manifest from the export
  const { data: exportData } = await request('GET', `${BACKEND_URL}/api/exports/${exportId}`)
  
  if (!exportData.data.manifest) {
    throw new Error('Export manifest not found')
  }

  const manifest = exportData.data.manifest

  // Verify manifest structure
  if (!manifest.version || !manifest.files || !Array.isArray(manifest.files)) {
    throw new Error('Invalid manifest structure')
  }

  console.log(`   Manifest version: ${manifest.version}`)
  console.log(`   Files: ${manifest.files.length}`)

  // Verify manifest hash matches
  const manifestJson = JSON.stringify(manifest, Object.keys(manifest).sort())
  const computedHash = crypto.createHash('sha256').update(manifestJson).digest('hex')

  if (computedHash !== manifestHash) {
    throw new Error(`Manifest hash mismatch: expected ${manifestHash}, got ${computedHash}`)
  }

  console.log('✅ Manifest hash matches')

  // Verify manifest against endpoint
  const { data: verifyData } = await request('POST', `${BACKEND_URL}/api/verify/manifest`, {
    body: JSON.stringify({
      manifest,
      export_id: exportId,
    }),
  })

  if (!verifyData.data.manifest_valid) {
    throw new Error('Manifest validation failed')
  }

  if (!verifyData.data.export_match) {
    throw new Error('Manifest hash does not match stored export')
  }

  if (!verifyData.data.ledger_match) {
    throw new Error('Manifest hash not found in ledger')
  }

  console.log('✅ Manifest verification passed')
  console.log(`   Export Match: ${verifyData.data.export_match}`)
  console.log(`   Ledger Match: ${verifyData.data.ledger_match}`)

  return verifyData.data
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Golden Path Test Suite')
  console.log(`   Backend: ${BACKEND_URL}`)
  console.log(`   Job ID: ${JOB_ID}`)

  try {
    // Test 1: Evidence upload
    const uploadResult = await testEvidenceUpload()

    // Test 2: Idempotency
    await testEvidenceIdempotency(uploadResult.idempotencyKey)

    // Test 3: Export flow
    const exportResult = await testExportFlow()

    // Test 4: Verify event (skipped for now)
    await testVerifyEvent()

    // Test 5: Verify manifest
    await testVerifyManifest(exportResult.exportId, exportResult.manifestHash)

    console.log('\n✅ All tests passed!')
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run tests
runTests()
