import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getWebhookOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

/** POST - Reschedule a terminally failed delivery for retry. Sets next_retry_at = now and resets attempt_count to 1 so the worker (which selects attempt_count <= MAX_ATTEMPTS) can process it again. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deliveryId: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { organization_ids } = await getWebhookOrganizationContext(request)
    const { deliveryId } = await params
    const supabase = await createSupabaseServerClient()

    // Authorization-gated read: fetch delivery with endpoint ownership; return NOT_FOUND for unauthorized or missing
    const { data: deliveryRow, error: delError } = await supabase
      .from('webhook_deliveries')
      .select('id, endpoint_id, delivered_at, next_retry_at, webhook_endpoints(organization_id)')
      .eq('id', deliveryId)
      .single()

    type DeliveryWithEndpoint = typeof deliveryRow & { webhook_endpoints?: { organization_id: string } | null }
    const delivery = deliveryRow as DeliveryWithEndpoint | null
    const endpointOrgId = delivery?.webhook_endpoints?.organization_id ?? null

    if (delError || !delivery || (endpointOrgId != null && !organization_ids.includes(endpointOrgId))) {
      const { response, errorId } = createErrorResponse(
        'Delivery not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Only after authorization: evaluate retry state for this authorized record
    if (delivery.delivered_at != null) {
      const { response, errorId } = createErrorResponse(
        'Delivery already succeeded; retry not allowed for successful deliveries',
        'ALREADY_DELIVERED',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (delivery.next_retry_at != null) {
      const { response, errorId } = createErrorResponse(
        'Delivery is already scheduled for retry; wait for it to run or fail before rescheduling',
        'ALREADY_SCHEDULED',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('webhook_deliveries')
      .update({
        next_retry_at: now,
        processing_since: null,
        attempt_count: 1,
      })
      .eq('id', deliveryId)
      .is('delivered_at', null)
      .is('next_retry_at', null)
      .select('id')
      .maybeSingle()

    if (updateError) {
      const { response, errorId } = createErrorResponse(
        updateError.message,
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (!updated) {
      const { response, errorId } = createErrorResponse(
        'Delivery is no longer in a terminal state; it may have been rescheduled or delivered',
        'ALREADY_SCHEDULED',
        { requestId, statusCode: 409 }
      )
      return NextResponse.json(response, {
        status: 409,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    return NextResponse.json(
      { data: { message: 'Retry scheduled', delivery_id: deliveryId } },
      { status: 200 }
    )
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
