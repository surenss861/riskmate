import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/webhooks/[id]/deliveries'

async function getEndpointAndCheckOrg(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  endpointId: string,
  organizationId: string
) {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, organization_id')
    .eq('id', endpointId)
    .single()
  if (error || !data) return null
  if (data.organization_id !== organizationId) return null
  return data
}

/** GET - List delivery logs with status, response, timing */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { organization_id } = await getOrganizationContext(request)
    const { id: endpointId } = await params
    const supabase = await createSupabaseServerClient()

    const endpoint = await getEndpointAndCheckOrg(supabase, endpointId, organization_id)
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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))

    const { data: deliveries, error } = await supabase
      .from('webhook_deliveries')
      .select('id, event_type, payload, response_status, response_body, duration_ms, attempt_count, delivered_at, next_retry_at, created_at')
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
    const attemptsByDelivery: Record<string, Array<{ attempt_number: number; response_status: number | null; response_body: string | null; duration_ms: number | null; created_at: string }>> = {}

    if (deliveryIds.length > 0) {
      const { data: attempts } = await supabase
        .from('webhook_delivery_attempts')
        .select('delivery_id, attempt_number, response_status, response_body, duration_ms, created_at')
        .in('delivery_id', deliveryIds)
        .order('attempt_number', { ascending: true })
      for (const a of attempts ?? []) {
        const d = a as { delivery_id: string; attempt_number: number; response_status: number | null; response_body: string | null; duration_ms: number | null; created_at: string }
        if (!attemptsByDelivery[d.delivery_id]) attemptsByDelivery[d.delivery_id] = []
        attemptsByDelivery[d.delivery_id].push({
          attempt_number: d.attempt_number,
          response_status: d.response_status,
          response_body: d.response_body,
          duration_ms: d.duration_ms,
          created_at: d.created_at,
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
