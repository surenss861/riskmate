/**
 * PDF Smoke Test Script
 * 
 * Generates a PDF using the same code path as the API route (no fetch, no SW, no caching variables).
 * This script is run in Docker/CI to verify PDF generation works correctly.
 * 
 * Usage: pnpm run pdf:smoke
 */

import fs from 'fs'
import path from 'path'

// Mock risk posture data (minimal but valid)
const mockRiskPostureData = {
  exposure_level: 'low' as const,
  posture_score: 75,
  delta: 5,
  high_risk_jobs: 3,
  open_incidents: 1,
  recent_violations: 0,
  flagged_jobs: 2,
  pending_signoffs: 5,
  signed_signoffs: 10,
  proof_packs_generated: 2,
  confidence_statement: 'Overall risk posture is stable with key areas for improvement. All critical incidents have been addressed.',
  ledger_integrity: 'verified' as const,
  ledger_integrity_last_verified_at: new Date().toISOString(),
  total_jobs: 50,
  last_job_at: new Date().toISOString(),
  drivers: {
    highRiskJobs: [
      { label: 'Electrical work without permit', count: 2 },
      { label: 'Missing safety equipment', count: 1 },
    ],
    openIncidents: [
      { label: 'Safety violation report', count: 1 },
    ],
    violations: [],
  },
  deltas: {
    high_risk_jobs: 1,
    open_incidents: -1,
    violations: 0,
    flagged_jobs: 0,
    pending_signoffs: 2,
    signed_signoffs: 3,
    proof_packs: 1,
  },
  recommended_actions: [
    { priority: 1, action: 'Complete pending attestations', reason: '5 attestations are pending and need signatures' },
    { priority: 2, action: 'Address high-risk jobs', reason: '3 high-risk jobs require immediate attention' },
    { priority: 3, action: 'Resolve open incidents', reason: '1 open incident needs investigation' },
  ],
}

async function main() {
  console.log('[PDF Smoke Test] Starting PDF generation...')
  
  // Dynamic import to avoid build-time issues with Next.js route files
  const { buildExecutiveBriefPDF } = await import('../app/api/executive/brief/pdf/route')
  
  const organizationName = 'Test Organization'
  const generatedBy = 'test@example.com'
  const timeRange = '30d'
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local-test'
  const reportId = 'test-report-' + Date.now()

  try {
    // Generate PDF using the same function as the API route
    const { buffer, hash, apiLatency, timeWindow } = await buildExecutiveBriefPDF(
      mockRiskPostureData,
      organizationName,
      generatedBy,
      timeRange,
      buildSha,
      reportId
    )

    console.log('[PDF Smoke Test] PDF generated successfully')
    console.log(`  - Size: ${(buffer.length / 1024).toFixed(2)} KB`)
    console.log(`  - Hash: ${hash.substring(0, 16)}...`)
    console.log(`  - Latency: ${apiLatency}ms`)
    console.log(`  - Time window: ${timeWindow.start.toISOString()} to ${timeWindow.end.toISOString()}`)

    // Verify PDF structure
    const pdfHeader = buffer.toString('ascii', 0, 5)
    const pdfFooter = buffer.toString('ascii', buffer.length - 6).trim()

    if (pdfHeader !== '%PDF-') {
      throw new Error(`Invalid PDF header: ${pdfHeader}`)
    }

    if (!pdfFooter.includes('%%EOF')) {
      throw new Error(`Invalid PDF footer: ${pdfFooter}`)
    }

    console.log('[PDF Smoke Test] PDF structure verified (valid header and footer)')

    // Save PDF artifact
    const artifactsDir = path.join(process.cwd(), 'artifacts')
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true })
    }

    const outputPath = path.join(artifactsDir, 'executive-brief.pdf')
    fs.writeFileSync(outputPath, buffer)

    console.log(`[PDF Smoke Test] PDF saved to: ${outputPath}`)
    console.log('[PDF Smoke Test] ✅ All checks passed')

    // Exit with success
    process.exit(0)
  } catch (error: any) {
    console.error('[PDF Smoke Test] ❌ Failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
