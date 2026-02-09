import express, { type Router as ExpressRouter } from 'express'
import { supabase } from '../lib/supabaseClient'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'
import { RequestWithId } from '../middleware/requestId'
import { createErrorResponse, logErrorForSupport } from '../utils/errorResponse'
import { recordAuditLog, extractClientMetadata } from '../middleware/audit'
import { getIdempotencyKey } from '../utils/idempotency'
import { uploadRateLimiter } from '../middleware/rateLimiter'
import { logWithRequest } from '../utils/structuredLog'
import crypto from 'crypto'
import busboy, { type FileInfo } from 'busboy'
import type { Request, Response } from 'express'

export const evidenceRouter: ExpressRouter = express.Router()

// Helper: Ensure evidence bucket exists
const ensuredBuckets = new Set<string>()

async function ensureBucketExists(bucketId: string) {
  if (ensuredBuckets.has(bucketId)) {
    return
  }

  const { data, error } = await supabase.storage.getBucket(bucketId)

  if (error || !data) {
    const { error: createError } = await supabase.storage.createBucket(bucketId, {
      public: false,
      fileSizeLimit: 100 * 1024 * 1024, // 100MB max
    })

    if (createError) {
      throw createError
    }
  }

  ensuredBuckets.add(bucketId)
}

// Helper: Parse multipart form data using busboy
async function parseMultipartFormData(req: express.Request): Promise<{
  file: { data: Buffer; name: string; type: string; size: number }
  fields: Record<string, string>
}> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {}
    let fileData: Buffer | null = null
    let fileName: string = ''
    let fileType: string = 'application/octet-stream'
    let fileSize: number = 0

    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) {
      return reject(new Error('Content-Type must be multipart/form-data'))
    }

    const bb = busboy({ headers: req.headers })

    bb.on('file', (name: string, file: NodeJS.ReadableStream, info: FileInfo) => {
      const { filename, encoding, mimeType } = info
      fileName = filename || 'unknown'
      fileType = mimeType || 'application/octet-stream'
      
      const chunks: Buffer[] = []
      
      file.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
        fileSize += chunk.length
      })

      file.on('end', () => {
        fileData = Buffer.concat(chunks)
      })
    })

    bb.on('field', (name: string, value: string) => {
      fields[name] = value
    })

    bb.on('finish', () => {
      if (!fileData) {
        return reject(new Error('No file found in multipart data'))
      }
      resolve({
        file: {
          data: fileData,
          name: fileName,
          type: fileType,
          size: fileSize,
        },
        fields,
      })
    })

    bb.on('error', (err: Error) => {
      reject(err)
    })

    req.pipe(bb)
  })
}

// POST /api/jobs/:id/evidence/upload
// Uploads evidence file with idempotency, SHA256, and ledger entry
evidenceRouter.post(
  '/jobs/:id/evidence/upload',
  authenticate as unknown as express.RequestHandler,
  uploadRateLimiter,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest & RequestWithId
    const requestId = authReq.requestId || 'unknown'
    
    try {
      const { organization_id, id: userId } = authReq.user
      const { id: jobId } = req.params

      // Validate job belongs to organization
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id, organization_id')
        .eq('id', jobId)
        .eq('organization_id', organization_id)
        .single()

      if (jobError || !job) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Job not found',
          internalMessage: `Job ${jobId} not found for org ${organization_id}`,
          code: 'JOB_NOT_FOUND',
          requestId,
          statusCode: 404,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(404).json(errorResponse)
      }

      // Get idempotency key (required)
      const idempotencyKey = getIdempotencyKey(req) || req.body?.idempotency_key
      if (!idempotencyKey) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Idempotency-Key header is required',
          internalMessage: 'Missing idempotency key for evidence upload',
          code: 'VALIDATION_ERROR',
          requestId,
          statusCode: 400,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(400).json(errorResponse)
      }

      // Check idempotency first
      const { data: existingEvidence } = await supabase
        .from('evidence')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

      if (existingEvidence) {
        // Return existing evidence (idempotent)
        res.setHeader('X-Idempotency-Replayed', 'true')
        return res.status(200).json({
          data: {
            id: existingEvidence.id,
            evidence_id: existingEvidence.evidence_id,
            file_name: existingEvidence.file_name,
            file_sha256: existingEvidence.file_sha256,
            file_size: existingEvidence.file_size,
            mime_type: existingEvidence.mime_type,
            state: existingEvidence.state,
            storage_path: existingEvidence.storage_path,
            phase: existingEvidence.phase,
            evidence_type: existingEvidence.evidence_type,
            created_at: existingEvidence.created_at,
            sealed_at: existingEvidence.sealed_at,
            verified_at: existingEvidence.verified_at,
          },
        })
      }

      // Parse multipart form data
      let fileData: Buffer
      let fileName: string
      let mimeType: string
      let metadata: Record<string, string> = {}

      try {
        const parsed = await parseMultipartFormData(req)
        fileData = parsed.file.data
        fileName = parsed.file.name
        mimeType = parsed.file.type

        // Extract metadata fields (accept both phase and category for compatibility)
        metadata = {
          phase: parsed.fields.phase || parsed.fields.category || '',
          evidence_type: parsed.fields.evidence_type || parsed.fields.tag || '',
          captured_at: parsed.fields.captured_at || '',
        }
      } catch (parseError: any) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Failed to parse multipart form data',
          internalMessage: parseError?.message || String(parseError),
          code: 'VALIDATION_ERROR',
          requestId,
          statusCode: 400,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(400).json(errorResponse)
      }

      // Validate file
      if (!fileData || fileData.length === 0) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'File is required',
          internalMessage: 'No file data received',
          code: 'VALIDATION_ERROR',
          requestId,
          statusCode: 400,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(400).json(errorResponse)
      }

      // File size limit: 50MB
      const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
      if (fileData.length > MAX_FILE_SIZE) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'File too large',
          internalMessage: `File size ${fileData.length} exceeds limit ${MAX_FILE_SIZE}`,
          code: 'VALIDATION_ERROR',
          requestId,
          statusCode: 400,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(400).json(errorResponse)
      }

      // Content type allowlist
      const ALLOWED_CONTENT_TYPES = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'video/mp4',
        'video/quicktime',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]
      
      if (!ALLOWED_CONTENT_TYPES.includes(mimeType.toLowerCase())) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'File type not allowed',
          internalMessage: `Content type ${mimeType} is not in allowlist`,
          code: 'VALIDATION_ERROR',
          requestId,
          statusCode: 400,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(400).json(errorResponse)
      }

      // Compute SHA256
      const fileSha256 = crypto.createHash('sha256').update(fileData).digest('hex')

      // Validate SHA256 format (64 hex chars)
      if (!/^[0-9a-f]{64}$/.test(fileSha256)) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Invalid file hash',
          internalMessage: 'SHA256 computation failed',
          code: 'VALIDATION_ERROR',
          requestId,
          statusCode: 500,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(500).json(errorResponse)
      }

      // Generate evidence_id (client-provided or auto-generated)
      const evidenceId = metadata.evidence_id || `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

      // Determine file extension from mime type or filename
      const ext = fileName.split('.').pop()?.toLowerCase() || 'bin'
      const storagePath = `${organization_id}/jobs/${jobId}/evidence/${fileSha256}.${ext}`

      // Ensure bucket exists
      await ensureBucketExists('evidence')

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(storagePath, fileData, {
          contentType: mimeType,
          upsert: false, // Don't overwrite (idempotency handled by DB)
        })

      if (uploadError) {
        // Check if file already exists (race condition)
        if (uploadError.message?.includes('already exists')) {
          // File exists, proceed with DB insert
        } else {
          const { response: errorResponse, errorId } = createErrorResponse({
            message: 'Failed to upload file to storage',
            internalMessage: uploadError.message || String(uploadError),
            code: 'STORAGE_ERROR',
            requestId,
            statusCode: 500,
          })
          res.setHeader('X-Error-ID', errorId)
          logErrorForSupport(500, 'STORAGE_ERROR', requestId, organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/jobs/:id/evidence/upload')
          return res.status(500).json(errorResponse)
        }
      }

      // Insert evidence row (state='sealed' since storage succeeded)
      const { data: insertedEvidence, error: insertError } = await supabase
        .from('evidence')
        .insert({
          organization_id,
          work_record_id: jobId,
          evidence_id: evidenceId,
          idempotency_key: idempotencyKey,
          file_sha256: fileSha256,
          file_name: fileName,
          file_size: fileData.length,
          bytes: fileData.length,
          mime_type: mimeType,
          content_type: mimeType,
          storage_path: storagePath,
          state: 'sealed',
          phase: metadata.phase || null,
          evidence_type: metadata.evidence_type || null,
          tag: metadata.evidence_type || null,
          captured_at: metadata.captured_at ? new Date(metadata.captured_at).toISOString() : null,
          uploaded_by: userId,
          sealed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        // Check for unique constraint violation (idempotency)
        if (insertError.code === '23505') {
          // Race condition: another request already inserted
          const { data: existing } = await supabase
            .from('evidence')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('idempotency_key', idempotencyKey)
            .single()

          if (existing) {
            res.setHeader('X-Idempotency-Replayed', 'true')
            return res.status(200).json({
              data: {
                id: existing.id,
                evidence_id: existing.evidence_id,
                file_name: existing.file_name,
                file_sha256: existing.file_sha256,
                file_size: existing.file_size,
                mime_type: existing.mime_type,
                state: existing.state,
                storage_path: existing.storage_path,
                phase: existing.phase,
                evidence_type: existing.evidence_type,
                created_at: existing.created_at,
                sealed_at: existing.sealed_at,
                verified_at: existing.verified_at,
              },
            })
          }
        }

        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Failed to save evidence record',
          internalMessage: insertError.message || String(insertError),
          code: 'DATABASE_ERROR',
          requestId,
          statusCode: 500,
        })
        res.setHeader('X-Error-ID', errorId)
          logErrorForSupport(500, 'DATABASE_ERROR', requestId, organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/jobs/:id/evidence/upload')
        return res.status(500).json(errorResponse)
      }

      // Set ledger_written flag to prevent trigger double-logging
      await supabase.rpc('set_ledger_written')

      // Extract client metadata from request
      const clientMetadata = extractClientMetadata(req);
      
      // Write ledger entry (evidence.sealed)
      await recordAuditLog({
        organizationId: organization_id,
        actorId: userId,
        eventName: 'evidence.sealed',
        targetType: 'evidence',
        targetId: insertedEvidence.id,
        metadata: {
          evidence_id: evidenceId, // evidenceId is the variable name
          job_id: jobId,
          file_sha256: fileSha256,
          file_name: fileName,
          file_size: fileData.length,
          bytes: fileData.length,
          mime_type: mimeType,
          storage_path: storagePath,
          phase: metadata.phase,
          evidence_type: metadata.evidence_type,
          tag: metadata.evidence_type,
          captured_at: metadata.captured_at,
        },
        ...clientMetadata,
      })

      // Create signed URL for download
      const { data: signedUrlData } = await supabase.storage
        .from('evidence')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7) // 7 days

      res.status(201).json({
        data: {
          id: insertedEvidence.id,
          evidence_id: evidenceId,
          file_name: fileName,
          file_sha256: fileSha256,
          file_size: fileData.length,
          bytes: fileData.length,
          mime_type: mimeType,
          content_type: mimeType,
          state: 'sealed',
          storage_path: storagePath,
          phase: metadata.phase || null,
          evidence_type: metadata.evidence_type || null,
          tag: metadata.evidence_type || null,
          captured_at: metadata.captured_at || null,
          created_at: insertedEvidence.created_at,
          sealed_at: insertedEvidence.sealed_at,
          url: signedUrlData?.signedUrl || null,
        },
      })
    } catch (err: any) {
      console.error('[Evidence Upload] Error:', err)
      const { response: errorResponse, errorId } = createErrorResponse({
        message: 'Failed to upload evidence',
        internalMessage: err?.message || String(err),
        code: 'EVIDENCE_UPLOAD_ERROR',
        requestId,
        statusCode: 500,
      })
      res.setHeader('X-Error-ID', errorId)
      logErrorForSupport(500, 'EVIDENCE_UPLOAD_ERROR', requestId, authReq.user?.organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/jobs/:id/evidence/upload')
      res.status(500).json(errorResponse)
    }
  }
)

// GET /api/jobs/:id/evidence
// Returns all evidence for a job
evidenceRouter.get(
  '/jobs/:id/evidence',
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest & RequestWithId
    const requestId = authReq.requestId || 'unknown'

    try {
      const { organization_id } = authReq.user
      const { id: jobId } = req.params

      // Validate job belongs to organization
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id')
        .eq('id', jobId)
        .eq('organization_id', organization_id)
        .single()

      if (jobError || !job) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Job not found',
          internalMessage: `Job ${jobId} not found for org ${organization_id}`,
          code: 'JOB_NOT_FOUND',
          requestId,
          statusCode: 404,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(404).json(errorResponse)
      }

      // Fetch evidence
      const { data: evidence, error: evidenceError } = await supabase
        .from('evidence')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('work_record_id', jobId)
        .order('created_at', { ascending: false })

      if (evidenceError) {
        throw evidenceError
      }

      // Generate signed URLs
      const evidenceWithUrls = await Promise.all(
        (evidence || []).map(async (ev) => {
          const { data: signedUrlData } = await supabase.storage
            .from('evidence')
            .createSignedUrl(ev.storage_path, 60 * 60 * 24 * 7) // 7 days

          return {
            id: ev.id,
            evidence_id: ev.evidence_id,
            file_name: ev.file_name,
            file_sha256: ev.file_sha256,
            file_size: ev.file_size,
            bytes: ev.bytes,
            mime_type: ev.mime_type,
            content_type: ev.content_type,
            state: ev.state,
            storage_path: ev.storage_path,
            phase: ev.phase,
            evidence_type: ev.evidence_type,
            tag: ev.tag,
            captured_at: ev.captured_at,
            created_at: ev.created_at,
            sealed_at: ev.sealed_at,
            verified_at: ev.verified_at,
            url: signedUrlData?.signedUrl || null,
          }
        })
      )

      res.json({
        data: evidenceWithUrls,
      })
    } catch (err: any) {
      console.error('[Evidence List] Error:', err)
      const { response: errorResponse, errorId } = createErrorResponse({
        message: 'Failed to fetch evidence',
        internalMessage: err?.message || String(err),
        code: 'EVIDENCE_FETCH_ERROR',
        requestId,
        statusCode: 500,
      })
      res.setHeader('X-Error-ID', errorId)
      logErrorForSupport(500, 'EVIDENCE_FETCH_ERROR', requestId, authReq.user?.organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/jobs/:id/evidence')
      res.status(500).json(errorResponse)
    }
  }
)
