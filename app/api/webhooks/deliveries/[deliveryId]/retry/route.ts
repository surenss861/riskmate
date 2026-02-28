import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getWebhookOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'
import { getUserRole } from '@/lib/utils/adminAuth'
import { requireAdminOrOwner } from '@/lib/utils/adminAuth'

export const runtime = 'nodejs'

/** POST - Retry a terminally failed delivery by creating a new webhook_deliveries row (same endpoint/event/payload) and enqueueing it. The original delivery row is left immutable so delivery logs show all historical attempts. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deliveryId: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { organization_ids, user_id } = await getWebhookOrganizationContext(request)
    const { deliveryId } = await params
    const supabase = await createSupabaseServerClient()

    // Authorization-gated read: fetch delivery with endpoint ownership and payload for clone; return NOT_FOUND for unauthorized or missing
    const { data: deliveryRow, error: delError } = await supabase
      .from('webhook_deliveries')
      .select('id, endpoint_id, event_type, payload, delivered_at, next_retry_at, webhook_endpoints(organization_id)')
      .eq('id', deliveryId)
      .single()

    type DeliveryWithEndpoint = typeof deliveryRow & { webhook_endpoints?: { organization_id: string } | null }
    const delivery = deliveryRow as DeliveryWithEndpoint | null
    const endpointOrgId = delivery?.webhook_endpoints?.organization_id ?? null

    if (delError || !delivery || !endpointOrgId || !organization_ids.includes(endpointOrgId)) {
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
    const admin = createSupabaseAdminClient()
    const role = await getUserRole(admin, user_id, endpointOrgId)
    requireAdminOrOwner(role)

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
    const { data: inserted, error: insertError } = await supabase
      .from('webhook_deliveries')
      .insert({
        endpoint_id: delivery.endpoint_id,
        event_type: delivery.event_type,
        payload: delivery.payload,
        attempt_count: 1,
        next_retry_at: now,
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
    if (!inserted?.id) {
      const { response, errorId } = createErrorResponse(
        'Failed to create retry delivery',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    return NextResponse.json(
      { data: { message: 'Retry scheduled', delivery_id: inserted.id } },
      { status: 200 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized'
    if (msg.includes('Forbidden')) {
      const { response, errorId } = createErrorResponse(
        msg,
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
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
