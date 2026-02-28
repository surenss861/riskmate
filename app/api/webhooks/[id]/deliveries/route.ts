import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getWebhookOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/webhooks/[id]/deliveries'

async function getEndpointAndCheckOrg(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  endpointId: string,
  organizationIds: string[]
) {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, organization_id')
    .eq('id', endpointId)
    .single()
  if (error || !data) return null
  if (!organizationIds.includes(data.organization_id)) return null
  return data
}

/** GET - List delivery logs with status, response, timing */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { organization_id, organization_ids } = await getWebhookOrganizationContext(request)
    const { id: endpointId } = await params
    const supabase = await createSupabaseServerClient()

    const endpoint = await getEndpointAndCheckOrg(supabase, endpointId, organization_ids)
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

    const { searchParams } = request.nextUrl
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10)
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10)
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(100, Math.max(1, Math.floor(rawLimit)))
      : 50
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0
      ? Math.max(0, Math.floor(rawOffset))
      : 0

    const { data: deliveries, error } = await supabase
      .from('webhook_deliveries')
      .select('id, event_type, payload, response_status, response_body, duration_ms, attempt_count, delivered_at, next_retry_at, processing_since, created_at')
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
      const { data: attempts, error: attemptsError } = await supabase
        .from('webhook_delivery_attempts')
        .select('id, delivery_id, attempt_number, response_status, response_body, duration_ms, created_at')
        .in('delivery_id', deliveryIds)
        .order('created_at', { ascending: true })
        .order('attempt_number', { ascending: true })

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

      for (const a of attempts ?? []) {
        const row = a as { id: string; delivery_id: string; attempt_number: number; response_status: number | null; response_body: string | null; duration_ms: number | null; created_at: string }
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
    }

    const data = list.map((d: { id: string; [k: string]: unknown }) => ({
      ...d,
      attempts: attemptsByDelivery[d.id] ?? [],
    }))

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized'
    if (msg.includes('Unauthorized') || msg.includes('organization')) {
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
