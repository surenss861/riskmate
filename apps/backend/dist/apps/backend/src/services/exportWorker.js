"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startExportWorker = startExportWorker;
exports.triggerExportProcessing = triggerExportProcessing;
exports.stopExportWorker = stopExportWorker;
const supabaseClient_1 = require("../lib/supabaseClient");
const audit_1 = require("../middleware/audit");
const structuredLog_1 = require("../utils/structuredLog");
const archiver_1 = __importDefault(require("archiver"));
const crypto_1 = __importDefault(require("crypto"));
const ledgerExport_1 = require("../utils/pdf/ledgerExport");
const proofPack_1 = require("../utils/pdf/proofPack");
const bulkJobsExport_1 = require("../utils/bulkJobsExport");
const WORKER_INTERVAL_MS = 5000; // Check every 5 seconds
const MAX_CONCURRENT_EXPORTS = 3;
let workerRunning = false;
let workerInterval = null;
/**
 * Start the export worker
 */
function startExportWorker() {
    if (workerRunning) {
        console.log('[ExportWorker] Already running');
        return;
    }
    console.log('[ExportWorker] Starting...');
    workerRunning = true;
    // Process immediately, then on interval
    processExportQueue();
    workerInterval = setInterval(processExportQueue, WORKER_INTERVAL_MS);
}
/**
 * Trigger one cycle of export processing (for immediate wake after enqueue).
 * Called by API when a new export is inserted so processing starts without waiting for the poll interval.
 */
function triggerExportProcessing() {
    processExportQueue().catch((err) => {
        console.error('[ExportWorker] Trigger processing error:', err);
    });
}
/**
 * Stop the export worker
 */
function stopExportWorker() {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
    }
    workerRunning = false;
    console.log('[ExportWorker] Stopped');
}
/**
 * Process one export from the queue
 * Uses DB-atomic claiming to prevent race conditions with multiple workers
 */
async function processExportQueue() {
    try {
        // Try RPC function first (atomic claiming)
        const { data: claimedJob, error: rpcError } = await supabaseClient_1.supabase
            .rpc('claim_export_job', { p_max_concurrent: MAX_CONCURRENT_EXPORTS });
        if (!rpcError && claimedJob && claimedJob.length > 0) {
            // Successfully claimed a job via RPC
            const job = claimedJob[0];
            (0, structuredLog_1.logStructured)('info', 'Claimed export job via RPC', {
                export_id: job.id,
                org_id: job.organization_id,
                export_type: job.export_type,
                work_record_id: job.work_record_id,
            });
            await processExport(job);
            return;
        }
        // Fallback: Manual claim with optimistic locking
        // In production, RPC should always exist - fail fast if missing
        const requireRpc = process.env.EXPORT_WORKER_REQUIRE_RPC === 'true';
        if (rpcError) {
            if (rpcError.code === '42883') {
                // 42883 = function does not exist
                const errorMsg = 'RPC function claim_export_job not found. Apply migration 20251203000004_export_worker_atomic_claim.sql';
                if (requireRpc) {
                    // Production: Fail fast with loud error
                    console.error('[ExportWorker] ❌ CRITICAL: RPC function missing in production!');
                    console.error('[ExportWorker] This should never happen. Check Supabase migrations.');
                    console.error('[ExportWorker] Error:', errorMsg);
                    // Don't process exports if RPC is required but missing
                    return;
                }
                else {
                    // Development: Log warning once per minute
                    const lastWarning = global.__exportWorkerRpcWarningTime || 0;
                    const now = Date.now();
                    if (now - lastWarning > 60000) { // 1 minute
                        console.warn('[ExportWorker] ⚠️  RPC function not found. Using fallback. Apply migration 20251203000004_export_worker_atomic_claim.sql');
                        global.__exportWorkerRpcWarningTime = now;
                    }
                }
            }
            else {
                // Other errors (e.g. 500/HTML from Cloudflare when RPC is unreachable) — use fallback
                const msg = rpcError.message || String(rpcError);
                const shortMsg = msg.length > 200 ? msg.slice(0, 200) + '…' : msg;
                console.warn('[ExportWorker] RPC claim failed, using fallback:', shortMsg);
                if (requireRpc) {
                    console.error('[ExportWorker] ❌ CRITICAL: RPC call failed in production!');
                    return;
                }
            }
        }
        const { data: manualClaim, error: manualError } = await supabaseClient_1.supabase
            .from('exports')
            .select('*')
            .eq('state', 'queued')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        if (manualError || !manualClaim) {
            // No jobs in queue
            return;
        }
        // Update state to 'preparing' (claim it) with optimistic locking
        const { data: updated, error: updateError } = await supabaseClient_1.supabase
            .from('exports')
            .update({
            state: 'preparing',
            started_at: new Date().toISOString(),
        })
            .eq('id', manualClaim.id)
            .eq('state', 'queued') // Optimistic locking: only update if still 'queued'
            .select()
            .single();
        if (updateError || !updated) {
            // Another worker claimed it, skip
            return;
        }
        // Successfully claimed via fallback (optimistic locking)
        (0, structuredLog_1.logStructured)('info', 'Claimed export job via fallback (optimistic locking)', {
            export_id: updated.id,
            org_id: updated.organization_id,
            export_type: updated.export_type,
            work_record_id: updated.work_record_id,
        });
        await processExport(updated);
    }
    catch (err) {
        console.error('[ExportWorker] Error processing queue:', err);
    }
}
/**
 * Process a single export job
 */
async function processExport(exportJob) {
    const { id, organization_id, work_record_id, export_type, filters, created_by, request_id, failure_count } = exportJob;
    (0, structuredLog_1.logStructured)('info', 'Processing export', {
        export_id: id,
        org_id: organization_id,
        export_type,
        request_id,
        failure_count: failure_count || 0,
    });
    try {
        // Update state to 'generating'
        await supabaseClient_1.supabase
            .from('exports')
            .update({
            state: 'generating',
            progress: 10,
        })
            .eq('id', id);
        // Write ledger event: export.started
        await (0, audit_1.recordAuditLog)({
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
        });
        let storagePath;
        let manifestPath;
        let manifestHash;
        let manifest;
        if (export_type === 'proof_pack') {
            // Generate proof pack (ZIP with multiple PDFs)
            const result = await generateProofPack(organization_id, work_record_id, filters || {});
            storagePath = result.storagePath;
            manifestPath = result.manifestPath;
            manifestHash = result.manifestHash;
            manifest = result.manifest;
        }
        else if (export_type === 'ledger') {
            // Generate ledger export PDF
            const result = await generateLedgerExport(organization_id, filters || {});
            storagePath = result.storagePath;
            manifestPath = result.manifestPath;
            manifestHash = result.manifestHash;
            manifest = result.manifest;
        }
        else if (export_type === 'executive_brief') {
            // Generate executive brief PDF
            const result = await generateExecutiveBrief(organization_id, work_record_id);
            storagePath = result.storagePath;
            manifestPath = result.manifestPath;
            manifestHash = result.manifestHash;
            manifest = result.manifest;
        }
        else if (export_type === 'bulk_jobs') {
            const result = await generateBulkJobsExport(organization_id, id, filters || {});
            storagePath = result.storagePath;
            manifestPath = result.manifestPath;
            manifestHash = result.manifestHash;
            manifest = result.manifest;
        }
        else {
            throw new Error(`Unsupported export type: ${export_type}`);
        }
        // Update state to 'uploading'
        await supabaseClient_1.supabase
            .from('exports')
            .update({
            state: 'uploading',
            progress: 80,
        })
            .eq('id', id);
        // Upload to Supabase Storage
        await ensureBucketExists('exports');
        // Note: Files are already uploaded during generation
        // Just update the export record
        // Update state to 'ready'
        await supabaseClient_1.supabase
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
            .eq('id', id);
        // Write ledger event: export.completed
        await (0, audit_1.recordAuditLog)({
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
        });
        (0, structuredLog_1.logStructured)('info', 'Export completed successfully', {
            export_id: id,
            org_id: organization_id,
            export_type,
            request_id,
        });
    }
    catch (err) {
        const newFailureCount = (failure_count || 0) + 1;
        const isPoisonPill = newFailureCount >= 3;
        (0, structuredLog_1.logStructured)('error', 'Export failed', {
            export_id: id,
            org_id: organization_id,
            export_type,
            request_id,
            failure_count: newFailureCount,
            is_poison_pill: isPoisonPill,
            error: err?.message || String(err),
        });
        // Specific, actionable failure_reason for UI (trust moment)
        let failureReason;
        try {
            failureReason = await getFailureReason(exportJob, err);
        }
        catch (_) {
            failureReason = `Export failed. Tap retry or contact support with export ID: ${id}`;
        }
        const errorId = crypto_1.default.randomUUID();
        await supabaseClient_1.supabase
            .from('exports')
            .update({
            state: isPoisonPill ? 'failed' : 'queued', // Poison pill: stop retrying
            failure_count: newFailureCount,
            error_code: 'EXPORT_GENERATION_FAILED',
            error_id: errorId,
            error_message: err?.message || String(err),
            failure_reason: failureReason, // Human-readable for iOS/UI
        })
            .eq('id', id);
        // Write ledger event: export.failed
        await (0, audit_1.recordAuditLog)({
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
        });
    }
}
/**
 * Generate bulk jobs export (CSV/PDF/ZIP) and upload to storage.
 */
async function generateBulkJobsExport(organizationId, exportId, filters) {
    const jobIds = filters.job_ids ?? [];
    const formats = (filters.formats ?? ['csv']).filter((f) => f === 'csv' || f === 'pdf');
    if (jobIds.length === 0)
        throw new Error('bulk_jobs export has no job_ids');
    if (formats.length === 0)
        formats.push('csv');
    const { data: jobs, error: jobsError } = await supabaseClient_1.supabase
        .from('jobs')
        .select('id, client_name, status, assigned_to_name, assigned_to_email, end_date, created_at')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .in('id', jobIds);
    if (jobsError)
        throw jobsError;
    const jobRows = (jobs ?? []).map((j) => ({
        id: j.id,
        job_name: j.client_name ?? '',
        client_name: j.client_name ?? '',
        status: j.status ?? null,
        assigned_to_name: j.assigned_to_name ?? null,
        assigned_to_email: j.assigned_to_email ?? null,
        due_date: j.end_date ?? null,
        created_at: j.created_at ?? null,
    }));
    if (jobRows.length === 0) {
        throw new Error('No eligible jobs to export: all requested jobs are deleted or archived');
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const csvName = `work-records-export-${dateStr}.csv`;
    const pdfName = `work-records-export-${dateStr}.pdf`;
    const zipName = `work-records-export-${dateStr}.zip`;
    const prefix = `${organizationId}/bulk-jobs/${exportId}-${Date.now()}`;
    await ensureBucketExists('exports');
    let storagePath;
    const manifest = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        organization_id: organizationId,
        job_count: jobRows.length,
        files: [],
    };
    if (formats.length === 1) {
        if (formats[0] === 'csv') {
            const csv = (0, bulkJobsExport_1.buildCsvString)(jobRows);
            const csvBuffer = Buffer.from(csv, 'utf-8');
            storagePath = `${prefix}-${csvName}`;
            const { error: upErr } = await supabaseClient_1.supabase.storage.from('exports').upload(storagePath, csvBuffer, { contentType: 'text/csv; charset=utf-8', upsert: false });
            if (upErr)
                throw upErr;
            manifest.files.push({ name: csvName, type: 'csv', hash: crypto_1.default.createHash('sha256').update(csvBuffer).digest('hex') });
        }
        else {
            const pdfBuffer = await (0, bulkJobsExport_1.buildPdfBuffer)(jobRows);
            storagePath = `${prefix}-${pdfName}`;
            const { error: upErr } = await supabaseClient_1.supabase.storage.from('exports').upload(storagePath, Buffer.from(pdfBuffer), { contentType: 'application/pdf', upsert: false });
            if (upErr)
                throw upErr;
            manifest.files.push({ name: pdfName, type: 'pdf', hash: crypto_1.default.createHash('sha256').update(pdfBuffer).digest('hex') });
        }
    }
    else {
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        const chunks = [];
        archive.on('data', (chunk) => chunks.push(chunk));
        const zipEnd = new Promise((resolve, reject) => {
            archive.on('end', () => resolve(Buffer.concat(chunks)));
            archive.on('error', reject);
        });
        const csv = (0, bulkJobsExport_1.buildCsvString)(jobRows);
        archive.append(csv, { name: csvName });
        const pdfBuffer = await (0, bulkJobsExport_1.buildPdfBuffer)(jobRows);
        archive.append(Buffer.from(pdfBuffer), { name: pdfName });
        await archive.finalize();
        const zipBuffer = await zipEnd;
        storagePath = `${prefix}-${zipName}`;
        const { error: upErr } = await supabaseClient_1.supabase.storage.from('exports').upload(storagePath, zipBuffer, { contentType: 'application/zip', upsert: false });
        if (upErr)
            throw upErr;
        manifest.files.push({ name: csvName, type: 'csv' }, { name: pdfName, type: 'pdf' });
    }
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestBuffer = Buffer.from(manifestJson, 'utf-8');
    const manifestHash = crypto_1.default.createHash('sha256').update(manifestBuffer).digest('hex');
    const manifestPath = `${prefix}-manifest.json`;
    const { error: manifestUpErr } = await supabaseClient_1.supabase.storage.from('exports').upload(manifestPath, manifestBuffer, { contentType: 'application/json', upsert: false });
    if (manifestUpErr)
        throw manifestUpErr;
    return { storagePath, manifestPath, manifestHash, manifest };
}
/**
 * Generate proof pack (ZIP with Ledger + Controls + Attestations + Evidence Index)
 */
async function generateProofPack(organizationId, jobId, filters) {
    // Fetch data for PDFs
    const { data: orgData } = await supabaseClient_1.supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();
    const { data: userData } = await supabaseClient_1.supabase
        .from('users')
        .select('full_name, role')
        .eq('organization_id', organizationId)
        .limit(1)
        .single();
    const exportId = `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    // Fetch ledger events
    let eventsQuery = supabaseClient_1.supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1000);
    if (filters.time_range) {
        // Apply time range filter
        const now = new Date();
        const daysAgo = parseInt(filters.time_range) || 30;
        const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        eventsQuery = eventsQuery.gte('created_at', startDate.toISOString());
    }
    const { data: events } = await eventsQuery;
    const auditEntries = (events || []).map((e) => ({
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
    }));
    // Generate ledger PDF
    const ledgerPdf = await (0, ledgerExport_1.generateLedgerExportPDF)({
        organizationName: orgData?.name || 'Unknown',
        generatedBy: userData?.full_name || 'Unknown',
        generatedByRole: userData?.role || 'Unknown',
        exportId,
        timeRange: filters.time_range || 'All',
        filters,
        events: auditEntries,
    });
    // Generate other PDFs (stub for now - these need proper data fetching)
    const controlsPdf = await (0, proofPack_1.generateControlsPDF)([], {
        packId: exportId,
        organizationName: orgData?.name || 'Unknown',
        generatedBy: userData?.full_name || 'Unknown',
        generatedByRole: userData?.role || 'Unknown',
        generatedAt: new Date().toISOString(),
        timeRange: filters.time_range || 'All',
    });
    const attestationsPdf = await (0, proofPack_1.generateAttestationsPDF)([], {
        packId: exportId,
        organizationName: orgData?.name || 'Unknown',
        generatedBy: userData?.full_name || 'Unknown',
        generatedByRole: userData?.role || 'Unknown',
        generatedAt: new Date().toISOString(),
        timeRange: filters.time_range || 'All',
    });
    const evidenceIndexPdf = await (0, proofPack_1.generateEvidenceIndexPDF)([], {
        packId: exportId,
        organizationName: orgData?.name || 'Unknown',
        generatedBy: userData?.full_name || 'Unknown',
        generatedByRole: userData?.role || 'Unknown',
        generatedAt: new Date().toISOString(),
        timeRange: filters.time_range || 'All',
    });
    // Create ZIP archive
    const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
    const chunks = [];
    archive.on('data', (chunk) => {
        chunks.push(chunk);
    });
    // Add PDFs to archive
    archive.append(ledgerPdf, { name: 'ledger-export.pdf' });
    archive.append(controlsPdf, { name: 'controls.pdf' });
    archive.append(attestationsPdf, { name: 'attestations.pdf' });
    archive.append(evidenceIndexPdf, { name: 'evidence-index.pdf' });
    // Generate manifest
    const manifest = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        organization_id: organizationId,
        work_record_id: jobId,
        filters,
        files: [
            { name: 'ledger-export.pdf', type: 'pdf', hash: crypto_1.default.createHash('sha256').update(ledgerPdf).digest('hex') },
            { name: 'controls.pdf', type: 'pdf', hash: crypto_1.default.createHash('sha256').update(controlsPdf).digest('hex') },
            { name: 'attestations.pdf', type: 'pdf', hash: crypto_1.default.createHash('sha256').update(attestationsPdf).digest('hex') },
            { name: 'evidence-index.pdf', type: 'pdf', hash: crypto_1.default.createHash('sha256').update(evidenceIndexPdf).digest('hex') },
        ],
    };
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestBuffer = Buffer.from(manifestJson, 'utf-8');
    archive.append(manifestBuffer, { name: 'manifest.json' });
    await archive.finalize();
    // Wait for archive to finish
    await new Promise((resolve) => {
        archive.on('end', resolve);
    });
    const zipBuffer = Buffer.concat(chunks);
    const zipHash = crypto_1.default.createHash('sha256').update(zipBuffer).digest('hex');
    const manifestHash = crypto_1.default.createHash('sha256').update(manifestBuffer).digest('hex');
    // Upload ZIP
    const zipPath = `${organizationId}/proof-packs/${jobId || 'all'}-${Date.now()}.zip`;
    const { error: zipError } = await supabaseClient_1.supabase.storage
        .from('exports')
        .upload(zipPath, zipBuffer, {
        contentType: 'application/zip',
        upsert: false,
    });
    if (zipError)
        throw zipError;
    // Upload manifest
    const manifestPath = `${organizationId}/proof-packs/${jobId || 'all'}-${Date.now()}-manifest.json`;
    const { error: manifestError } = await supabaseClient_1.supabase.storage
        .from('exports')
        .upload(manifestPath, manifestBuffer, {
        contentType: 'application/json',
        upsert: false,
    });
    if (manifestError)
        throw manifestError;
    return {
        storagePath: zipPath,
        manifestPath,
        manifestHash,
        manifest,
    };
}
/**
 * Generate ledger export PDF
 */
async function generateLedgerExport(organizationId, filters) {
    // Fetch data for ledger export
    const { data: orgData } = await supabaseClient_1.supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();
    const { data: userData } = await supabaseClient_1.supabase
        .from('users')
        .select('full_name, role')
        .eq('organization_id', organizationId)
        .limit(1)
        .single();
    const exportId = `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    // Fetch ledger events
    let eventsQuery = supabaseClient_1.supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1000);
    if (filters.time_range) {
        const now = new Date();
        const daysAgo = parseInt(filters.time_range) || 30;
        const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        eventsQuery = eventsQuery.gte('created_at', startDate.toISOString());
    }
    const { data: events } = await eventsQuery;
    const auditEntries = (events || []).map((e) => ({
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
    }));
    const pdfBuffer = await (0, ledgerExport_1.generateLedgerExportPDF)({
        organizationName: orgData?.name || 'Unknown',
        generatedBy: userData?.full_name || 'Unknown',
        generatedByRole: userData?.role || 'Unknown',
        exportId,
        timeRange: filters.time_range || 'All',
        filters,
        events: auditEntries,
    });
    const pdfHash = crypto_1.default.createHash('sha256').update(pdfBuffer).digest('hex');
    const storagePath = `${organizationId}/ledger-exports/${Date.now()}.pdf`;
    const { error: uploadError } = await supabaseClient_1.supabase.storage
        .from('exports')
        .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
    });
    if (uploadError)
        throw uploadError;
    const manifest = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        organization_id: organizationId,
        filters,
        files: [
            { name: 'ledger-export.pdf', type: 'pdf', hash: pdfHash },
        ],
    };
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestBuffer = Buffer.from(manifestJson, 'utf-8');
    const manifestHash = crypto_1.default.createHash('sha256').update(manifestBuffer).digest('hex');
    const manifestPath = `${organizationId}/ledger-exports/${Date.now()}-manifest.json`;
    const { error: manifestError } = await supabaseClient_1.supabase.storage
        .from('exports')
        .upload(manifestPath, manifestBuffer, {
        contentType: 'application/json',
        upsert: false,
    });
    if (manifestError)
        throw manifestError;
    return {
        storagePath,
        manifestPath,
        manifestHash,
        manifest,
    };
}
/**
 * Generate executive brief PDF
 */
async function generateExecutiveBrief(organizationId, jobId) {
    // Import executive brief generator
    const { generateExecutiveBriefPDF } = await Promise.resolve().then(() => __importStar(require('../utils/pdf/executiveBrief')));
    // TODO: Fetch executive brief data from database
    // For now, use placeholder data
    const now = new Date().toISOString();
    const briefData = {
        generated_at: now,
        time_range: 'Last 30 days',
        summary: {
            exposure_level: 'low',
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
    };
    // Get organization name
    const { data: orgData } = await supabaseClient_1.supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();
    const { buffer: pdfBuffer, hash: pdfHash } = await generateExecutiveBriefPDF(briefData, orgData?.name || 'Organization', 'System');
    const storagePath = `${organizationId}/executive-briefs/${jobId || 'all'}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabaseClient_1.supabase.storage
        .from('exports')
        .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
    });
    if (uploadError)
        throw uploadError;
    const manifest = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        organization_id: organizationId,
        work_record_id: jobId,
        files: [
            { name: 'executive-brief.pdf', type: 'pdf', hash: pdfHash },
        ],
    };
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestBuffer = Buffer.from(manifestJson, 'utf-8');
    const manifestHash = crypto_1.default.createHash('sha256').update(manifestBuffer).digest('hex');
    const manifestPath = `${organizationId}/executive-briefs/${jobId || 'all'}-${Date.now()}-manifest.json`;
    const { error: manifestError } = await supabaseClient_1.supabase.storage
        .from('exports')
        .upload(manifestPath, manifestBuffer, {
        contentType: 'application/json',
        upsert: false,
    });
    if (manifestError)
        throw manifestError;
    return {
        storagePath,
        manifestPath,
        manifestHash,
        manifest,
    };
}
/**
 * Build a specific, actionable failure_reason for the UI (trust moment).
 * Rule order: user-fixable blockers first, then infra errors, then default.
 */
async function getFailureReason(exportJob, err) {
    const { id, work_record_id: jobId, export_type, organization_id } = exportJob;
    const msg = (err?.message || String(err)).toLowerCase();
    // 1. User-fixable blockers FIRST (proof_pack)
    if (export_type === 'proof_pack' && jobId) {
        try {
            const evidenceRequired = 5;
            const actual = await countEvidence(organization_id, jobId);
            if (actual < evidenceRequired) {
                const missing = evidenceRequired - actual;
                return `Missing ${missing} evidence item${missing === 1 ? '' : 's'}. Upload photos before generating proof pack.`;
            }
            const hazardsCount = await countHazards(organization_id, jobId);
            if (hazardsCount === 0) {
                return 'No hazards configured. Add hazards in web app before generating report.';
            }
            const incompleteControls = await countIncompleteControls(jobId);
            if (incompleteControls > 0) {
                return `${incompleteControls} control${incompleteControls === 1 ? '' : 's'} not completed. Mark them complete or skip them.`;
            }
        }
        catch (_) {
            // Ignore; fall through to infra/default
        }
    }
    // 2. Infrastructure errors (actionable but not user-fixable)
    if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnreset')) {
        return 'Upload timed out. Check your internet connection and retry.';
    }
    if (msg.includes('pdf') || msg.includes('generation') || msg.includes('enotype')) {
        return `Report generation failed. Contact support with export ID: ${id}`;
    }
    if (msg.includes('storage') || msg.includes('upload')) {
        return 'Storage upload failed. Retry or contact support.';
    }
    return `Export failed. Tap retry or contact support with export ID: ${id}`;
}
async function countEvidence(orgId, workRecordId) {
    const { count } = await supabaseClient_1.supabase
        .from('evidence')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('work_record_id', workRecordId);
    return count ?? 0;
}
async function countHazards(organizationId, jobId) {
    try {
        const { count } = await supabaseClient_1.supabase
            .from('mitigation_items')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', jobId)
            .eq('organization_id', organizationId)
            .is('hazard_id', null);
        return count ?? 0;
    }
    catch {
        return 0;
    }
}
async function countIncompleteControls(jobId) {
    const { count } = await supabaseClient_1.supabase
        .from('mitigation_items')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('is_completed', false)
        .is('deleted_at', null);
    return count ?? 0;
}
/**
 * Ensure exports bucket exists
 */
const ensuredBuckets = new Set();
async function ensureBucketExists(bucketId) {
    if (ensuredBuckets.has(bucketId)) {
        return;
    }
    const { data, error } = await supabaseClient_1.supabase.storage.getBucket(bucketId);
    if (error || !data) {
        const { error: createError } = await supabaseClient_1.supabase.storage.createBucket(bucketId, {
            public: false,
            fileSizeLimit: 500 * 1024 * 1024, // 500MB max
        });
        if (createError) {
            throw createError;
        }
    }
    ensuredBuckets.add(bucketId);
}
//# sourceMappingURL=exportWorker.js.map