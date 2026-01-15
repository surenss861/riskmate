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
import { recordAuditLog } from '../middleware/audit'
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
      await processExport(claimedJob[0])
      return
    }

    // Fallback: Manual claim with optimistic locking
    // (Use this if RPC function doesn't exist yet)
    if (rpcError && rpcError.code !== '42883') {
      // 42883 = function does not exist, which is OK (we'll use fallback)
      // Other errors are unexpected
      console.warn('[ExportWorker] RPC claim failed, using fallback:', rpcError.message)
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

    // Update state to 'failed' (or keep as 'queued' if not poison pill for retry)
    const errorId = crypto.randomUUID()
    await supabase
      .from('exports')
      .update({ 
        state: isPoisonPill ? 'failed' : 'queued', // Poison pill: stop retrying
        failure_count: newFailureCount,
        error_code: 'EXPORT_GENERATION_FAILED',
        error_id: errorId,
        error_message: err?.message || String(err),
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
  // Generate all PDFs
  const ledgerPdf = await generateLedgerExportPDF(organizationId, filters)
  const controlsPdf = await generateControlsPDF(organizationId, jobId, filters)
  const attestationsPdf = await generateAttestationsPDF(organizationId, jobId, filters)
  const evidenceIndexPdf = await generateEvidenceIndexPDF(organizationId, jobId, filters)

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
  const pdfBuffer = await generateLedgerExportPDF(organizationId, filters)
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
  
  const pdfBuffer = await generateExecutiveBriefPDF(organizationId, jobId)
  const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

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
