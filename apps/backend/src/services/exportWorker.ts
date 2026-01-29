/**
 * Async Export Worker
 * Processes queued exports from the exports table
 * 
 * This worker:
 * - Claims exports with state='queued' using FOR UPDATE SKIP LOCKED
 * - Generates PDFs/ZIPs + manifest.json
 * - Uploads to Supabase Storage
 * - Updates state to 'ready' or 'failed'
 * - Writes ledger events
 */

import { supabase } from '../lib/supabaseClient'
import { recordAuditLog, extractClientMetadata } from '../middleware/audit'
import { logStructured } from '../utils/structuredLog'
import archiver from 'archiver'
import crypto from 'crypto'
import { generateLedgerExportPDF } from '../utils/pdf/ledgerExport'
import { generateControlsPDF, generateAttestationsPDF, generateEvidenceIndexPDF } from '../utils/pdf/proofPack'

const WORKER_INTERVAL_MS = 5000 // Check every 5 seconds
const MAX_CONCURRENT_EXPORTS = 3

let workerRunning = false
let workerInterval: NodeJS.Timeout | null = null

/**
 * Start the export worker
 */
export function startExportWorker() {
  if (workerRunning) {
    console.log('[ExportWorker] Already running')
    return
  }

  console.log('[ExportWorker] Starting...')
  workerRunning = true

  // Process immediately, then on interval
  processExportQueue()
  workerInterval = setInterval(processExportQueue, WORKER_INTERVAL_MS)
}

/**
 * Stop the export worker
 */
export function stopExportWorker() {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
  }
  workerRunning = false
  console.log('[ExportWorker] Stopped')
}

/**
 * Process one export from the queue
 * Uses DB-atomic claiming to prevent race conditions with multiple workers
 */
async function processExportQueue() {
  try {
    // Try RPC function first (atomic claiming)
    const { data: claimedJob, error: rpcError } = await supabase
      .rpc('claim_export_job', { p_max_concurrent: MAX_CONCURRENT_EXPORTS })

    if (!rpcError && claimedJob && claimedJob.length > 0) {
      // Successfully claimed a job via RPC
      const job = claimedJob[0]
      logStructured('info', 'Claimed export job via RPC', {
        export_id: job.id,
        org_id: job.organization_id,
        export_type: job.export_type,
        work_record_id: job.work_record_id,
      })
      await processExport(job)
      return
    }

    // Fallback: Manual claim with optimistic locking
    // In production, RPC should always exist - fail fast if missing
    const requireRpc = process.env.EXPORT_WORKER_REQUIRE_RPC === 'true'
    
    if (rpcError) {
      if (rpcError.code === '42883') {
        // 42883 = function does not exist
        const errorMsg = 'RPC function claim_export_job not found. Apply migration 20251203000004_export_worker_atomic_claim.sql'
        
        if (requireRpc) {
          // Production: Fail fast with loud error
          console.error('[ExportWorker] ❌ CRITICAL: RPC function missing in production!')
          console.error('[ExportWorker] This should never happen. Check Supabase migrations.')
          console.error('[ExportWorker] Error:', errorMsg)
          // Don't process exports if RPC is required but missing
          return
        } else {
          // Development: Log warning once per minute
          const lastWarning = (global as any).__exportWorkerRpcWarningTime || 0
          const now = Date.now()
          if (now - lastWarning > 60000) { // 1 minute
            console.warn('[ExportWorker] ⚠️  RPC function not found. Using fallback. Apply migration 20251203000004_export_worker_atomic_claim.sql')
            ;(global as any).__exportWorkerRpcWarningTime = now
          }
        }
      } else {
        // Other errors are unexpected
        console.warn('[ExportWorker] RPC claim failed, using fallback:', rpcError.message)
        if (requireRpc) {
          console.error('[ExportWorker] ❌ CRITICAL: RPC call failed in production!')
          return
        }
      }
    }

    const { data: manualClaim, error: manualError } = await supabase
      .from('exports')
      .select('*')
      .eq('state', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (manualError || !manualClaim) {
      // No jobs in queue
      return
    }

    // Update state to 'preparing' (claim it) with optimistic locking
    const { data: updated, error: updateError } = await supabase
      .from('exports')
      .update({ 
        state: 'preparing',
        started_at: new Date().toISOString(),
      })
      .eq('id', manualClaim.id)
      .eq('state', 'queued') // Optimistic locking: only update if still 'queued'
      .select()
      .single()

    if (updateError || !updated) {
      // Another worker claimed it, skip
      return
    }

    // Successfully claimed via fallback (optimistic locking)
    logStructured('info', 'Claimed export job via fallback (optimistic locking)', {
      export_id: updated.id,
      org_id: updated.organization_id,
      export_type: updated.export_type,
      work_record_id: updated.work_record_id,
    })
    await processExport(updated)
  } catch (err: any) {
    console.error('[ExportWorker] Error processing queue:', err)
  }
}

/**
 * Process a single export job
 */
async function processExport(exportJob: any) {
  const { id, organization_id, work_record_id, export_type, filters, created_by, request_id, failure_count } = exportJob

  logStructured('info', 'Processing export', {
    export_id: id,
    org_id: organization_id,
    export_type,
    request_id,
    failure_count: failure_count || 0,
  })

  try {
    // Update state to 'generating'
    await supabase
      .from('exports')
      .update({ 
        state: 'generating',
        progress: 10,
      })
      .eq('id', id)

    // Write ledger event: export.started
    await recordAuditLog({
      organizationId: organization_id,
      actorId: created_by,
      eventName: `export.${export_type}.started`,
      targetType: 'export',
      targetId: id,
      metadata: {
        export_type,
        work_record_id,
        filters,
      },
    })

    let storagePath: string
    let manifestPath: string
    let manifestHash: string
    let manifest: any

    if (export_type === 'proof_pack') {
      // Generate proof pack (ZIP with multiple PDFs)
      const result = await generateProofPack(organization_id, work_record_id, filters || {})
      storagePath = result.storagePath
      manifestPath = result.manifestPath
      manifestHash = result.manifestHash
      manifest = result.manifest
    } else if (export_type === 'ledger') {
      // Generate ledger export PDF
      const result = await generateLedgerExport(organization_id, filters || {})
      storagePath = result.storagePath
      manifestPath = result.manifestPath
      manifestHash = result.manifestHash
      manifest = result.manifest
    } else if (export_type === 'executive_brief') {
      // Generate executive brief PDF
      const result = await generateExecutiveBrief(organization_id, work_record_id)
      storagePath = result.storagePath
      manifestPath = result.manifestPath
      manifestHash = result.manifestHash
      manifest = result.manifest
    } else {
      throw new Error(`Unsupported export type: ${export_type}`)
    }

    // Update state to 'uploading'
    await supabase
      .from('exports')
      .update({ 
        state: 'uploading',
        progress: 80,
      })
      .eq('id', id)

    // Upload to Supabase Storage
    await ensureBucketExists('exports')
    
    // Note: Files are already uploaded during generation
    // Just update the export record

    // Update state to 'ready'
    await supabase
      .from('exports')
      .update({ 
        state: 'ready',
        progress: 100,
        storage_path: storagePath,
        manifest_path: manifestPath,
        manifest_hash: manifestHash,
        manifest: manifest,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)

    // Write ledger event: export.completed
    await recordAuditLog({
      organizationId: organization_id,
      actorId: created_by,
      eventName: `export.${export_type}.completed`,
      targetType: 'export',
      targetId: id,
      metadata: {
        export_type,
        work_record_id,
        storage_path: storagePath,
        manifest_path: manifestPath,
        manifest_hash: manifestHash,
        filters,
      },
    })

    logStructured('info', 'Export completed successfully', {
      export_id: id,
      org_id: organization_id,
      export_type,
      request_id,
    })
  } catch (err: any) {
    const newFailureCount = (failure_count || 0) + 1
    const isPoisonPill = newFailureCount >= 3

    logStructured('error', 'Export failed', {
      export_id: id,
      org_id: organization_id,
      export_type,
      request_id,
      failure_count: newFailureCount,
      is_poison_pill: isPoisonPill,
      error: err?.message || String(err),
    })

    // Specific, actionable failure_reason for UI (trust moment)
    let failureReason: string
    try {
      failureReason = await getFailureReason(exportJob, err)
    } catch (_) {
      failureReason = `Export failed. Tap retry or contact support with export ID: ${id}`
    }

    const errorId = crypto.randomUUID()
    await supabase
      .from('exports')
      .update({ 
        state: isPoisonPill ? 'failed' : 'queued', // Poison pill: stop retrying
        failure_count: newFailureCount,
        error_code: 'EXPORT_GENERATION_FAILED',
        error_id: errorId,
        error_message: err?.message || String(err),
        failure_reason: failureReason, // Human-readable for iOS/UI
      })
      .eq('id', id)

    // Write ledger event: export.failed
    await recordAuditLog({
      organizationId: organization_id,
      actorId: created_by,
      eventName: `export.${export_type}.failed`,
      targetType: 'export',
      targetId: id,
      metadata: {
        export_type,
        work_record_id,
        error_code: 'EXPORT_GENERATION_FAILED',
        error_id: errorId,
        error_message: err?.message || String(err),
      },
    })
  }
}

/**
 * Generate proof pack (ZIP with Ledger + Controls + Attestations + Evidence Index)
 */
async function generateProofPack(
  organizationId: string,
  jobId: string | null,
  filters: Record<string, any>
): Promise<{
  storagePath: string
  manifestPath: string
  manifestHash: string
  manifest: any
}> {
  // Fetch data for PDFs
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single()

  const { data: userData } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('organization_id', organizationId)
    .limit(1)
    .single()

  const exportId = `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  
  // Fetch ledger events
  let eventsQuery = supabase
    .from('audit_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (filters.time_range) {
    // Apply time range filter
    const now = new Date()
    const daysAgo = parseInt(filters.time_range) || 30
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    eventsQuery = eventsQuery.gte('created_at', startDate.toISOString())
  }

  const { data: events } = await eventsQuery

  const auditEntries = (events || []).map((e: any) => ({
    id: e.id,
    event_name: e.event_name,
    created_at: e.created_at,
    category: e.category,
    outcome: e.outcome,
    severity: e.severity,
    actor_name: e.actor_name,
    actor_role: e.actor_role,
    job_id: e.job_id,
    job_title: e.job_title,
    target_type: e.target_type,
    summary: e.summary,
  }))

  // Generate ledger PDF
  const ledgerPdf = await generateLedgerExportPDF({
    organizationName: orgData?.name || 'Unknown',
    generatedBy: userData?.full_name || 'Unknown',
    generatedByRole: userData?.role || 'Unknown',
    exportId,
    timeRange: filters.time_range || 'All',
    filters,
    events: auditEntries,
  })

  // Generate other PDFs (stub for now - these need proper data fetching)
  const controlsPdf = await generateControlsPDF([], {
    packId: exportId,
    organizationName: orgData?.name || 'Unknown',
    generatedBy: userData?.full_name || 'Unknown',
    generatedByRole: userData?.role || 'Unknown',
    generatedAt: new Date().toISOString(),
    timeRange: filters.time_range || 'All',
  })

  const attestationsPdf = await generateAttestationsPDF([], {
    packId: exportId,
    organizationName: orgData?.name || 'Unknown',
    generatedBy: userData?.full_name || 'Unknown',
    generatedByRole: userData?.role || 'Unknown',
    generatedAt: new Date().toISOString(),
    timeRange: filters.time_range || 'All',
  })

  const evidenceIndexPdf = await generateEvidenceIndexPDF([], {
    packId: exportId,
    organizationName: orgData?.name || 'Unknown',
    generatedBy: userData?.full_name || 'Unknown',
    generatedByRole: userData?.role || 'Unknown',
    generatedAt: new Date().toISOString(),
    timeRange: filters.time_range || 'All',
  })

  // Create ZIP archive
  const archive = archiver('zip', { zlib: { level: 9 } })
  const chunks: Buffer[] = []

  archive.on('data', (chunk: Buffer) => {
    chunks.push(chunk)
  })

  // Add PDFs to archive
  archive.append(ledgerPdf, { name: 'ledger-export.pdf' })
  archive.append(controlsPdf, { name: 'controls.pdf' })
  archive.append(attestationsPdf, { name: 'attestations.pdf' })
  archive.append(evidenceIndexPdf, { name: 'evidence-index.pdf' })

  // Generate manifest
  const manifest = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    organization_id: organizationId,
    work_record_id: jobId,
    filters,
    files: [
      { name: 'ledger-export.pdf', type: 'pdf', hash: crypto.createHash('sha256').update(ledgerPdf).digest('hex') },
      { name: 'controls.pdf', type: 'pdf', hash: crypto.createHash('sha256').update(controlsPdf).digest('hex') },
      { name: 'attestations.pdf', type: 'pdf', hash: crypto.createHash('sha256').update(attestationsPdf).digest('hex') },
      { name: 'evidence-index.pdf', type: 'pdf', hash: crypto.createHash('sha256').update(evidenceIndexPdf).digest('hex') },
    ],
  }

  const manifestJson = JSON.stringify(manifest, null, 2)
  const manifestBuffer = Buffer.from(manifestJson, 'utf-8')
  archive.append(manifestBuffer, { name: 'manifest.json' })

  await archive.finalize()

  // Wait for archive to finish
  await new Promise<void>((resolve) => {
    archive.on('end', resolve)
  })

  const zipBuffer = Buffer.concat(chunks)
  const zipHash = crypto.createHash('sha256').update(zipBuffer).digest('hex')
  const manifestHash = crypto.createHash('sha256').update(manifestBuffer).digest('hex')

  // Upload ZIP
  const zipPath = `${organizationId}/proof-packs/${jobId || 'all'}-${Date.now()}.zip`
  const { error: zipError } = await supabase.storage
    .from('exports')
    .upload(zipPath, zipBuffer, {
      contentType: 'application/zip',
      upsert: false,
    })

  if (zipError) throw zipError

  // Upload manifest
  const manifestPath = `${organizationId}/proof-packs/${jobId || 'all'}-${Date.now()}-manifest.json`
  const { error: manifestError } = await supabase.storage
    .from('exports')
    .upload(manifestPath, manifestBuffer, {
      contentType: 'application/json',
      upsert: false,
    })

  if (manifestError) throw manifestError

  return {
    storagePath: zipPath,
    manifestPath,
    manifestHash,
    manifest,
  }
}

/**
 * Generate ledger export PDF
 */
async function generateLedgerExport(
  organizationId: string,
  filters: Record<string, any>
): Promise<{
  storagePath: string
  manifestPath: string
  manifestHash: string
  manifest: any
}> {
  // Fetch data for ledger export
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single()

  const { data: userData } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('organization_id', organizationId)
    .limit(1)
    .single()

  const exportId = `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

  // Fetch ledger events
  let eventsQuery = supabase
    .from('audit_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (filters.time_range) {
    const now = new Date()
    const daysAgo = parseInt(filters.time_range) || 30
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    eventsQuery = eventsQuery.gte('created_at', startDate.toISOString())
  }

  const { data: events } = await eventsQuery

  const auditEntries = (events || []).map((e: any) => ({
    id: e.id,
    event_name: e.event_name,
    created_at: e.created_at,
    category: e.category,
    outcome: e.outcome,
    severity: e.severity,
    actor_name: e.actor_name,
    actor_role: e.actor_role,
    job_id: e.job_id,
    job_title: e.job_title,
    target_type: e.target_type,
    summary: e.summary,
  }))

  const pdfBuffer = await generateLedgerExportPDF({
    organizationName: orgData?.name || 'Unknown',
    generatedBy: userData?.full_name || 'Unknown',
    generatedByRole: userData?.role || 'Unknown',
    exportId,
    timeRange: filters.time_range || 'All',
    filters,
    events: auditEntries,
  })
  const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

  const storagePath = `${organizationId}/ledger-exports/${Date.now()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('exports')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const manifest = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    organization_id: organizationId,
    filters,
    files: [
      { name: 'ledger-export.pdf', type: 'pdf', hash: pdfHash },
    ],
  }

  const manifestJson = JSON.stringify(manifest, null, 2)
  const manifestBuffer = Buffer.from(manifestJson, 'utf-8')
  const manifestHash = crypto.createHash('sha256').update(manifestBuffer).digest('hex')

  const manifestPath = `${organizationId}/ledger-exports/${Date.now()}-manifest.json`
  const { error: manifestError } = await supabase.storage
    .from('exports')
    .upload(manifestPath, manifestBuffer, {
      contentType: 'application/json',
      upsert: false,
    })

  if (manifestError) throw manifestError

  return {
    storagePath,
    manifestPath,
    manifestHash,
    manifest,
  }
}

/**
 * Generate executive brief PDF
 */
async function generateExecutiveBrief(
  organizationId: string,
  jobId: string | null
): Promise<{
  storagePath: string
  manifestPath: string
  manifestHash: string
  manifest: any
}> {
  // Import executive brief generator
  const { generateExecutiveBriefPDF } = await import('../utils/pdf/executiveBrief')
  
  // TODO: Fetch executive brief data from database
  // For now, use placeholder data
  const now = new Date().toISOString()
  const briefData = {
    generated_at: now,
    time_range: 'Last 30 days',
    summary: {
      exposure_level: 'low' as const,
      confidence_statement: 'System-generated from ledger + evidence status',
      counts: {
        high_risk_jobs: 0,
        open_incidents: 0,
        violations: 0,
        flagged: 0,
        pending_attestations: 0,
        signed_attestations: 0,
        proof_packs: 0,
      },
    },
  }
  
  // Get organization name
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single()
  
  const { buffer: pdfBuffer, hash: pdfHash } = await generateExecutiveBriefPDF(
    briefData,
    orgData?.name || 'Organization',
    'System'
  )

  const storagePath = `${organizationId}/executive-briefs/${jobId || 'all'}-${Date.now()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('exports')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const manifest = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    organization_id: organizationId,
    work_record_id: jobId,
    files: [
      { name: 'executive-brief.pdf', type: 'pdf', hash: pdfHash },
    ],
  }

  const manifestJson = JSON.stringify(manifest, null, 2)
  const manifestBuffer = Buffer.from(manifestJson, 'utf-8')
  const manifestHash = crypto.createHash('sha256').update(manifestBuffer).digest('hex')

  const manifestPath = `${organizationId}/executive-briefs/${jobId || 'all'}-${Date.now()}-manifest.json`
  const { error: manifestError } = await supabase.storage
    .from('exports')
    .upload(manifestPath, manifestBuffer, {
      contentType: 'application/json',
      upsert: false,
    })

  if (manifestError) throw manifestError

  return {
    storagePath,
    manifestPath,
    manifestHash,
    manifest,
  }
}

/**
 * Build a specific, actionable failure_reason for the UI (trust moment).
 * Used when an export fails so users see "Missing 2 evidence items" instead of "Export generation failed".
 */
async function getFailureReason(exportJob: any, err: any): Promise<string> {
  const { id, work_record_id: jobId, export_type, organization_id } = exportJob
  const msg = (err?.message || String(err)).toLowerCase()

  // Storage / network timeouts
  if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnreset')) {
    return 'Upload timed out. Check your internet connection and retry.'
  }

  // PDF / generation errors → ask user to contact support with export ID
  if (msg.includes('pdf') || msg.includes('generation') || msg.includes('enotype')) {
    return `Report generation failed. Contact support with export ID: ${id}`
  }

  // Proof pack: try to explain using evidence/job data
  if (export_type === 'proof_pack' && jobId) {
    try {
      const evidenceRequired = 5
      const { count: evidenceCount } = await supabase
        .from('evidence')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .eq('work_record_id', jobId)

      const actual = evidenceCount ?? 0
      if (actual < evidenceRequired) {
        const missing = evidenceRequired - actual
        return `Missing ${missing} evidence item${missing === 1 ? '' : 's'}. Upload photos before generating proof pack.`
      }
    } catch (_) {
      // Ignore; fall through to generic
    }
  }

  return `Export failed. Tap retry or contact support with export ID: ${id}`
}

/**
 * Ensure exports bucket exists
 */
const ensuredBuckets = new Set<string>()

async function ensureBucketExists(bucketId: string) {
  if (ensuredBuckets.has(bucketId)) {
    return
  }

  const { data, error } = await supabase.storage.getBucket(bucketId)

  if (error || !data) {
    const { error: createError } = await supabase.storage.createBucket(bucketId, {
      public: false,
      fileSizeLimit: 500 * 1024 * 1024, // 500MB max
    })

    if (createError) {
      throw createError
    }
  }

  ensuredBuckets.add(bucketId)
}
