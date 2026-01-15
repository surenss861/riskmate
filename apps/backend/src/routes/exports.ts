import express, { type Router as ExpressRouter } from 'express'
import { supabase } from '../lib/supabaseClient'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'
import { RequestWithId } from '../middleware/requestId'
import { createErrorResponse, logErrorForSupport } from '../utils/errorResponse'
import { getIdempotencyKey } from '../utils/idempotency'
import { exportRateLimiter } from '../middleware/rateLimiter'
import { logWithRequest } from '../utils/structuredLog'
import crypto from 'crypto'

export const exportsRouter: ExpressRouter = express.Router()

// POST /api/jobs/:id/export/pdf
// Creates an async export job for a single PDF
exportsRouter.post(
  '/jobs/:id/export/pdf',
  authenticate as unknown as express.RequestHandler,
  exportRateLimiter,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest & RequestWithId
    const requestId = authReq.requestId || 'unknown'

    try {
      const { organization_id, id: userId } = authReq.user
      const { id: jobId } = req.params
      const { export_type = 'ledger', filters = {} } = req.body

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

      // Get idempotency key (optional but recommended)
      const idempotencyKey = getIdempotencyKey(req) || req.body?.idempotency_key || crypto.randomUUID()

      // Check idempotency
      if (idempotencyKey) {
        const { data: existingExport } = await supabase
          .from('exports')
          .select('*')
          .eq('organization_id', organization_id)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle()

        if (existingExport) {
          res.setHeader('X-Idempotency-Replayed', 'true')
          return res.status(200).json({
            data: {
              id: existingExport.id,
              export_type: existingExport.export_type,
              state: existingExport.state,
              progress: existingExport.progress,
              created_at: existingExport.created_at,
              started_at: existingExport.started_at,
              completed_at: existingExport.completed_at,
            },
          })
        }
      }

      // Generate verification token for public access
      const verificationToken = crypto.randomBytes(32).toString('hex')

      // Create export job
      const { data: exportJob, error: insertError } = await supabase
        .from('exports')
        .insert({
          organization_id,
          work_record_id: jobId,
          export_type,
          idempotency_key: idempotencyKey,
          request_id: requestId,
          verification_token: verificationToken,
          state: 'queued',
          progress: 0,
          filters,
          created_by: userId,
          requested_by: userId,
          requested_at: new Date().toISOString(),
        })
        .select()
        .single()

      logWithRequest('info', 'Export job created', requestId, {
        org_id: organization_id,
        user_id: userId,
        job_id: jobId,
        export_id: exportJob?.id,
        export_type,
      })

      if (insertError) {
        // Check for unique constraint violation (idempotency race condition)
        if (insertError.code === '23505') {
          const { data: existing } = await supabase
            .from('exports')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('idempotency_key', idempotencyKey)
            .single()

          if (existing) {
            res.setHeader('X-Idempotency-Replayed', 'true')
            return res.status(200).json({
              data: {
                id: existing.id,
                export_type: existing.export_type,
                state: existing.state,
                progress: existing.progress,
                created_at: existing.created_at,
                started_at: existing.started_at,
                completed_at: existing.completed_at,
              },
            })
          }
        }

        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Failed to create export job',
          internalMessage: insertError.message || String(insertError),
          code: 'DATABASE_ERROR',
          requestId,
          statusCode: 500,
        })
        res.setHeader('X-Error-ID', errorId)
        logErrorForSupport(500, 'DATABASE_ERROR', requestId, organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/jobs/:id/export/pdf')
        return res.status(500).json(errorResponse)
      }

      res.status(201).json({
        data: {
          id: exportJob.id,
          export_type: exportJob.export_type,
          state: exportJob.state,
          progress: exportJob.progress,
          created_at: exportJob.created_at,
        },
      })
    } catch (err: any) {
      console.error('[Export Request] Error:', err)
      const { response: errorResponse, errorId } = createErrorResponse({
        message: 'Failed to create export job',
        internalMessage: err?.message || String(err),
        code: 'EXPORT_REQUEST_ERROR',
        requestId,
        statusCode: 500,
      })
      res.setHeader('X-Error-ID', errorId)
      logErrorForSupport(500, 'EXPORT_REQUEST_ERROR', requestId, authReq.user?.organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/jobs/:id/export/pdf')
      res.status(500).json(errorResponse)
    }
  }
)

// POST /api/jobs/:id/export/proof-pack
// Creates an async export job for a proof pack (ZIP)
exportsRouter.post(
  '/jobs/:id/export/proof-pack',
  authenticate as unknown as express.RequestHandler,
  exportRateLimiter,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest & RequestWithId
    const requestId = authReq.requestId || 'unknown'

    try {
      const { organization_id, id: userId } = authReq.user
      const { id: jobId } = req.params
      const { filters = {} } = req.body

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

      // Get idempotency key
      const idempotencyKey = getIdempotencyKey(req) || req.body?.idempotency_key || crypto.randomUUID()

      // Check idempotency
      if (idempotencyKey) {
        const { data: existingExport } = await supabase
          .from('exports')
          .select('*')
          .eq('organization_id', organization_id)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle()

        if (existingExport) {
          res.setHeader('X-Idempotency-Replayed', 'true')
          return res.status(200).json({
            data: {
              id: existingExport.id,
              export_type: existingExport.export_type,
              state: existingExport.state,
              progress: existingExport.progress,
              created_at: existingExport.created_at,
              started_at: existingExport.started_at,
              completed_at: existingExport.completed_at,
            },
          })
        }
      }

      // Create export job
      const { data: exportJob, error: insertError } = await supabase
        .from('exports')
        .insert({
          organization_id,
          work_record_id: jobId,
          export_type: 'proof_pack',
          idempotency_key: idempotencyKey,
          state: 'queued',
          progress: 0,
          filters,
          created_by: userId,
          requested_by: userId,
          requested_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          const { data: existing } = await supabase
            .from('exports')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('idempotency_key', idempotencyKey)
            .single()

          if (existing) {
            res.setHeader('X-Idempotency-Replayed', 'true')
            return res.status(200).json({
              data: {
                id: existing.id,
                export_type: existing.export_type,
                state: existing.state,
                progress: existing.progress,
                created_at: existing.created_at,
                started_at: existing.started_at,
                completed_at: existing.completed_at,
              },
            })
          }
        }

        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Failed to create export job',
          internalMessage: insertError.message || String(insertError),
          code: 'DATABASE_ERROR',
          requestId,
          statusCode: 500,
        })
        res.setHeader('X-Error-ID', errorId)
        logErrorForSupport(500, 'DATABASE_ERROR', requestId, organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/jobs/:id/export/proof-pack')
        return res.status(500).json(errorResponse)
      }

      res.status(201).json({
        data: {
          id: exportJob.id,
          export_type: exportJob.export_type,
          state: exportJob.state,
          progress: exportJob.progress,
          created_at: exportJob.created_at,
        },
      })
    } catch (err: any) {
      console.error('[Export Request] Error:', err)
      const { response: errorResponse, errorId } = createErrorResponse({
        message: 'Failed to create export job',
        internalMessage: err?.message || String(err),
        code: 'EXPORT_REQUEST_ERROR',
        requestId,
        statusCode: 500,
      })
      res.setHeader('X-Error-ID', errorId)
      logErrorForSupport(500, 'EXPORT_REQUEST_ERROR', requestId, authReq.user?.organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/jobs/:id/export/proof-pack')
      res.status(500).json(errorResponse)
    }
  }
)

// GET /api/exports/:id
// Poll export status
exportsRouter.get(
  '/exports/:id',
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest & RequestWithId
    const requestId = authReq.requestId || 'unknown'

    try {
      const { organization_id } = authReq.user
      const { id: exportId } = req.params

      const { data: exportJob, error: fetchError } = await supabase
        .from('exports')
        .select('*')
        .eq('id', exportId)
        .eq('organization_id', organization_id)
        .single()

      if (fetchError || !exportJob) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Export not found',
          internalMessage: `Export ${exportId} not found for org ${organization_id}`,
          code: 'EXPORT_NOT_FOUND',
          requestId,
          statusCode: 404,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(404).json(errorResponse)
      }

      // Generate signed URL if ready
      let downloadUrl: string | null = null
      if (exportJob.state === 'ready' && exportJob.storage_path) {
        const { data: signedUrlData } = await supabase.storage
          .from('exports')
          .createSignedUrl(exportJob.storage_path, 60 * 60 * 24 * 7) // 7 days

        downloadUrl = signedUrlData?.signedUrl || null
      }

      res.json({
        data: {
          id: exportJob.id,
          export_type: exportJob.export_type,
          state: exportJob.state,
          progress: exportJob.progress,
          storage_path: exportJob.storage_path,
          manifest_path: exportJob.manifest_path,
          manifest_hash: exportJob.manifest_hash,
          manifest: exportJob.manifest,
          error_code: exportJob.error_code,
          error_id: exportJob.error_id,
          error_message: exportJob.error_message,
          created_at: exportJob.created_at,
          started_at: exportJob.started_at,
          completed_at: exportJob.completed_at,
          download_url: downloadUrl,
          verification_token: exportJob.verification_token,
          verification_url: exportJob.verification_token 
            ? `${req.protocol}://${req.get('host')}/api/public/verify/${exportJob.verification_token}`
            : null,
        },
      })
    } catch (err: any) {
      console.error('[Export Status] Error:', err)
      const { response: errorResponse, errorId } = createErrorResponse({
        message: 'Failed to fetch export status',
        internalMessage: err?.message || String(err),
        code: 'EXPORT_FETCH_ERROR',
        requestId,
        statusCode: 500,
      })
      res.setHeader('X-Error-ID', errorId)
      logErrorForSupport(500, 'EXPORT_FETCH_ERROR', requestId, authReq.user?.organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/exports/:id')
      res.status(500).json(errorResponse)
    }
  }
)

// GET /api/exports/:id/download
// Stream export file
exportsRouter.get(
  '/exports/:id/download',
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest & RequestWithId
    const requestId = authReq.requestId || 'unknown'

    try {
      const { organization_id } = authReq.user
      const { id: exportId } = req.params

      const { data: exportJob, error: fetchError } = await supabase
        .from('exports')
        .select('*')
        .eq('id', exportId)
        .eq('organization_id', organization_id)
        .single()

      if (fetchError || !exportJob) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Export not found',
          internalMessage: `Export ${exportId} not found for org ${organization_id}`,
          code: 'EXPORT_NOT_FOUND',
          requestId,
          statusCode: 404,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(404).json(errorResponse)
      }

      if (exportJob.state !== 'ready') {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Export not ready',
          internalMessage: `Export ${exportId} is in state ${exportJob.state}`,
          code: 'EXPORT_NOT_READY',
          requestId,
          statusCode: 400,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(400).json(errorResponse)
      }

      if (!exportJob.storage_path) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Export file not found',
          internalMessage: `Export ${exportId} has no storage_path`,
          code: 'EXPORT_FILE_MISSING',
          requestId,
          statusCode: 500,
        })
        res.setHeader('X-Error-ID', errorId)
        return res.status(500).json(errorResponse)
      }

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('exports')
        .download(exportJob.storage_path)

      if (downloadError || !fileData) {
        const { response: errorResponse, errorId } = createErrorResponse({
          message: 'Failed to download export file',
          internalMessage: downloadError?.message || 'File not found in storage',
          code: 'STORAGE_ERROR',
          requestId,
          statusCode: 500,
        })
        res.setHeader('X-Error-ID', errorId)
        logErrorForSupport(500, 'STORAGE_ERROR', requestId, organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/exports/:id/download')
        return res.status(500).json(errorResponse)
      }

      // Determine content type
      const contentType = exportJob.export_type === 'proof_pack' 
        ? 'application/zip' 
        : 'application/pdf'

      // Set headers
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${exportJob.export_type}-${exportId}.${exportJob.export_type === 'proof_pack' ? 'zip' : 'pdf'}"`)
      res.setHeader('X-Export-ID', exportId)
      if (exportJob.manifest_hash) {
        res.setHeader('X-Manifest-Hash', exportJob.manifest_hash)
      }

      // Stream file
      const arrayBuffer = await fileData.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      res.send(buffer)
    } catch (err: any) {
      console.error('[Export Download] Error:', err)
      const { response: errorResponse, errorId } = createErrorResponse({
        message: 'Failed to download export',
        internalMessage: err?.message || String(err),
        code: 'EXPORT_DOWNLOAD_ERROR',
        requestId,
        statusCode: 500,
      })
      res.setHeader('X-Error-ID', errorId)
      logErrorForSupport(500, 'EXPORT_DOWNLOAD_ERROR', requestId, authReq.user?.organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/exports/:id/download')
      res.status(500).json(errorResponse)
    }
  }
)
