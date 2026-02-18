import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'

/** Extract client metadata from request for audit logging (same shape as backend extractClientMetadata). */
export function getBulkClientMetadata(request: NextRequest): { client: string; appVersion: string; deviceId: string } {
  const client = request.headers.get('x-client') || request.headers.get('client') || 'web'
  const appVersion = request.headers.get('x-app-version') || request.headers.get('app-version') || 'unknown'
  const deviceId = request.headers.get('x-device-id') || request.headers.get('device-id') || 'unknown'
  return { client: client || 'web', appVersion: appVersion || 'unknown', deviceId: deviceId || 'unknown' }
}

export const BULK_CAP = 100
const ROUTE_BULK = '/api/jobs/bulk'

export type BulkFailedItem = { id: string; code: string; message: string }

/**
 * Parse and validate bulk request body: job_ids array and optional status/worker_id.
 * Enforces 100-item cap server-side.
 * Returns { jobIds, status?, workerId?, errorResponse }.
 */
export async function parseBulkJobIds(
  request: NextRequest,
  requireStatus?: boolean,
  requireWorkerId?: boolean
): Promise<
  | { jobIds: string[]; status?: string; workerId?: string }
  | { errorResponse: NextResponse }
> {
  const requestId = getRequestId(request)
  let body: any
  try {
    body = await request.json()
  } catch {
    const { response, errorId } = createErrorResponse(
      'Invalid JSON body',
      'VALIDATION_ERROR',
      { requestId, statusCode: 400 }
    )
    return {
      errorResponse: NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      }),
    }
  }

  const job_ids = body?.job_ids
  if (!Array.isArray(job_ids) || job_ids.length === 0) {
    const { response, errorId } = createErrorResponse(
      'job_ids (array) is required and must be non-empty',
      'VALIDATION_ERROR',
      { requestId, statusCode: 400 }
    )
    return {
      errorResponse: NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      }),
    }
  }

  if (job_ids.length > BULK_CAP) {
    const { response, errorId } = createErrorResponse(
      `Maximum ${BULK_CAP} jobs per bulk operation. Please select fewer jobs.`,
      'VALIDATION_ERROR',
      { requestId, statusCode: 400 }
    )
    return {
      errorResponse: NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      }),
    }
  }

  if (requireStatus) {
    const status = body?.status
    if (typeof status !== 'string' || !status.trim()) {
      const { response, errorId } = createErrorResponse(
        'status (string) is required',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return {
        errorResponse: NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        }),
      }
    }
    /** Accept canonical (active, on-hold) and DB values; normalize before use. */
    const canonicalToDb: Record<string, string> = {
      active: 'in_progress',
      'on-hold': 'on_hold',
      draft: 'draft',
      in_progress: 'in_progress',
      on_hold: 'on_hold',
      completed: 'completed',
      cancelled: 'cancelled',
    }
    const dbStatus = canonicalToDb[status] ?? status
    const allowedDbStatuses = ['draft', 'in_progress', 'on_hold', 'completed', 'cancelled']
    if (!allowedDbStatuses.includes(dbStatus)) {
      const { response, errorId } = createErrorResponse(
        'Invalid status',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return {
        errorResponse: NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        }),
      }
    }
    return { jobIds: job_ids as string[], status: dbStatus }
  }

  if (requireWorkerId) {
    const workerId = body?.worker_id ?? body?.user_id
    if (!workerId || typeof workerId !== 'string') {
      const { response, errorId } = createErrorResponse(
        'worker_id (string) is required',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return {
        errorResponse: NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        }),
      }
    }
    return { jobIds: job_ids as string[], workerId }
  }

  return { jobIds: job_ids as string[] }
}

/**
 * Get organization context or return 401/500 NextResponse.
 */
export async function getBulkAuth(
  request: NextRequest
): Promise<
  | { organization_id: string; user_id: string }
  | { errorResponse: NextResponse }
> {
  const requestId = getRequestId(request)
  try {
    const ctx = await getOrganizationContext(request)
    return { organization_id: ctx.organization_id, user_id: ctx.user_id }
  } catch (err: any) {
    const message = err?.message || 'Unauthorized'
    const statusCode = message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('authenticated') ? 401 : 500
    const { response, errorId } = createErrorResponse(
      message,
      statusCode === 401 ? 'UNAUTHORIZED' : 'QUERY_ERROR',
      { requestId, statusCode }
    )
    return {
      errorResponse: NextResponse.json(response, {
        status: statusCode,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      }),
    }
  }
}
