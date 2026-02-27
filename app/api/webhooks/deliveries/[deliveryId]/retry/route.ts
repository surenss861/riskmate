import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

/** POST - Reschedule a failed delivery for retry (set next_retry_at = now) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deliveryId: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { organization_id } = await getOrganizationContext(request)
    const { deliveryId } = await params
    const supabase = await createSupabaseServerClient()

    const { data: delivery, error: delError } = await supabase
      .from('webhook_deliveries')
      .select('id, endpoint_id, delivered_at, event_type, payload')
      .eq('id', deliveryId)
      .single()

    if (delError || !delivery) {
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

    const { data: endpoint, error: epError } = await supabase
      .from('webhook_endpoints')
      .select('id, organization_id')
      .eq('id', delivery.endpoint_id)
      .single()

    if (epError || !endpoint || endpoint.organization_id !== organization_id) {
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

    const { data: newDelivery, error: insertError } = await supabase
      .from('webhook_deliveries')
      .insert({
        endpoint_id: delivery.endpoint_id,
        event_type: delivery.event_type,
        payload: delivery.payload,
        attempt_count: 1,
        next_retry_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      const { response, errorId } = createErrorResponse(
        insertError.message,
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    return NextResponse.json(
      { data: { message: 'Retry scheduled', delivery_id: newDelivery?.id } },
      { status: 201 }
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
