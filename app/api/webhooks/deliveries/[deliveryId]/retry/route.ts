import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getWebhookOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { getUserRole } from '@/lib/utils/adminAuth'
import { requireAdminOrOwner, ForbiddenError, UnauthorizedError } from '@/lib/utils/adminAuth'
import { wakeBackendWebhookWorker } from '@/lib/webhooks/trigger'

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
    const admin = createSupabaseAdminClient()

    // Fetch delivery with admin client (bypass RLS) so join to webhook_endpoints always returns organization_id and is_active; enforce org membership in app code below.
    const { data: deliveryRow, error: delError } = await admin
      .from('webhook_deliveries')
      .select('id, endpoint_id, event_type, payload, delivered_at, next_retry_at, processing_since, terminal_outcome, webhook_endpoints(organization_id, is_active)')
      .eq('id', deliveryId)
      .single()

    type DeliveryWithEndpoint = typeof deliveryRow & { webhook_endpoints?: { organization_id: string; is_active: boolean } | null }
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
    const role = await getUserRole(admin, user_id, endpointOrgId)
    requireAdminOrOwner(role)

    // Only after authorization: evaluate retry state for this authorized record
    if (delivery.processing_since != null) {
      const { response, errorId } = createErrorResponse(
        'Delivery is currently being processed; wait for it to complete before retrying',
        'DELIVERY_IN_PROGRESS',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
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

    if (delivery.terminal_outcome === 'delivered') {
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

    if (delivery.terminal_outcome === 'cancelled_policy') {
      const { response, errorId } = createErrorResponse(
        'Delivery was cancelled due to a policy violation (blocked URL); update the endpoint URL before retrying.',
        'CANCELLED_POLICY',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (delivery.terminal_outcome === 'cancelled_paused') {
      const { response, errorId } = createErrorResponse(
        'Delivery was cancelled because the endpoint was paused; resume the endpoint first, then retry if needed.',
        'CANCELLED_PAUSED',
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

    // Block retry when endpoint is currently paused so we do not create a row that the worker will immediately cancel.
    if (delivery.webhook_endpoints?.is_active === false) {
      const { response, errorId } = createErrorResponse(
        'Endpoint is paused; resume the endpoint first, then retry.',
        'ENDPOINT_PAUSED',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const now = new Date().toISOString()
    const { data: inserted, error: insertError } = await admin
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
      logApiError(500, 'QUERY_ERROR', errorId, requestId, endpointOrgId, response.message, {
        category: 'internal', severity: 'error', route: '/api/webhooks/deliveries/[deliveryId]/retry',
      })
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
      logApiError(500, 'QUERY_ERROR', errorId, requestId, endpointOrgId, response.message, {
        category: 'internal', severity: 'error', route: '/api/webhooks/deliveries/[deliveryId]/retry',
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    wakeBackendWebhookWorker().catch((err: unknown) => {
      console.warn('[WebhookTrigger] Wake worker call failed (delivery will be picked up on next poll):', err instanceof Error ? err.message : err)
    })

    return NextResponse.json(
      { data: { message: 'Retry scheduled', delivery_id: inserted.id } },
      { status: 201 }
    )
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
