import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getWebhookOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { getEndpointAndCheckOrg } from '@/lib/webhooks/endpointGuard'
import { getUserRole } from '@/lib/utils/adminAuth'
import { requireAdminOrOwner, ForbiddenError, UnauthorizedError } from '@/lib/utils/adminAuth'

export const runtime = 'nodejs'

const ROUTE = '/api/webhooks/[id]/deliveries'
const MAX_ATTEMPTS_PER_DELIVERY = 5

/** GET - List delivery logs with status, response, timing. Requires owner/admin. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { organization_id, organization_ids, user_id } = await getWebhookOrganizationContext(request)
    const { id: endpointId } = await params
    const admin = createSupabaseAdminClient()

    const endpoint = await getEndpointAndCheckOrg(admin, endpointId, organization_ids)
    if (!endpoint) {
      const { response, errorId } = createErrorResponse(
        'Webhook endpoint not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const role = await getUserRole(admin, user_id, endpoint.organization_id)
    requireAdminOrOwner(role)

    const { searchParams } = request.nextUrl
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10)
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10)
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(100, Math.max(1, Math.floor(rawLimit)))
      : 50
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0
      ? Math.max(0, Math.floor(rawOffset))
      : 0

    const { data: deliveries, error } = await admin
      .from('webhook_deliveries')
      .select('id, event_type, payload, response_status, response_body, duration_ms, attempt_count, delivered_at, next_retry_at, processing_since, terminal_outcome, created_at')
      .eq('endpoint_id', endpointId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      const { response, errorId } = createErrorResponse(
        error.message,
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, organization_id, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const list = deliveries ?? []
    const deliveryIds = list.map((d: { id: string }) => d.id)
    const attemptsByDelivery: Record<string, Array<{ id: string; attempt_number: number; response_status: number | null; response_body: string | null; duration_ms: number | null; created_at: string }>> = {}

    if (deliveryIds.length > 0) {
      const attemptsLimit = limit * MAX_ATTEMPTS_PER_DELIVERY
      const { data: attempts, error: attemptsError } = await admin
        .from('webhook_delivery_attempts')
        .select('id, delivery_id, attempt_number, response_status, response_body, duration_ms, created_at')
        .in('delivery_id', deliveryIds)
        .order('delivery_id', { ascending: true })
        .order('attempt_number', { ascending: true })
        .limit(attemptsLimit)

      if (attemptsError) {
        const { response, errorId } = createErrorResponse(
          'Failed to load delivery attempt history',
          'QUERY_ERROR',
          { requestId, statusCode: 500, details: attemptsError.message }
        )
        logApiError(500, 'QUERY_ERROR', errorId, requestId, organization_id, response.message, {
          category: 'internal',
          severity: 'error',
          route: ROUTE,
          details: { attemptsError: attemptsError.message },
        })
        return NextResponse.json(response, {
          status: 500,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }

      const attemptRows = (attempts ?? []) as Array<{ id: string; delivery_id: string; attempt_number: number; response_status: number | null; response_body: string | null; duration_ms: number | null; created_at: string }>
      for (const row of attemptRows) {
        if (!attemptsByDelivery[row.delivery_id]) attemptsByDelivery[row.delivery_id] = []
        attemptsByDelivery[row.delivery_id].push({
          id: row.id,
          attempt_number: row.attempt_number,
          response_status: row.response_status,
          response_body: row.response_body,
          duration_ms: row.duration_ms,
          created_at: row.created_at,
        })
      }
      for (const deliveryId of Object.keys(attemptsByDelivery)) {
        attemptsByDelivery[deliveryId].sort((a, b) => a.attempt_number - b.attempt_number)
      }
    }

    const data = list.map((d: { id: string; delivered_at: string | null; next_retry_at: string | null; terminal_outcome: string | null; [k: string]: unknown }) => {
      const undelivered = d.delivered_at == null
      const unscheduled = d.next_retry_at == null
      const can_retry =
        undelivered &&
        unscheduled &&
        d.terminal_outcome !== 'cancelled_paused' &&
        d.terminal_outcome !== 'cancelled_policy'
      return {
        ...d,
        attempts: attemptsByDelivery[d.id] ?? [],
        can_retry,
      }
    })

    return NextResponse.json({ data })
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) {
      const { response, errorId } = createErrorResponse(
        err.message,
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (err instanceof UnauthorizedError) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const msg = err instanceof Error ? err.message : 'Unauthorized'
    const { response, errorId } = createErrorResponse(
      msg,
      'INTERNAL_ERROR',
      { requestId, statusCode: 500 }
    )
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}
