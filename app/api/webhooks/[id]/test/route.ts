import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/webhooks/[id]/test'

async function getEndpointAndCheckOrg(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  endpointId: string,
  organizationId: string
) {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, organization_id, events')
    .eq('id', endpointId)
    .single()
  if (error || !data) return null
  if (data.organization_id !== organizationId) return null
  return data
}

/** POST - Send test event to this endpoint only (enqueues one delivery) */
export async function POST(
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

    // Use the endpoint's subscribed events so the test matches what they receive in production
    const events = Array.isArray((endpoint as { events?: string[] }).events)
      ? (endpoint as { events: string[] }).events
      : []
    const eventType =
      events.length > 0
        ? events.includes('job.created')
          ? 'job.created'
          : events[0]
        : 'job.created'
    const payload = {
      id: `evt_test_${Date.now()}`,
      type: eventType,
      created: new Date().toISOString(),
      organization_id,
      data: {
        object: {
          id: endpointId,
          title: 'Test webhook from RiskMate',
          status: 'draft',
          test: true,
          created_at: new Date().toISOString(),
        },
      },
    }

    const admin = createSupabaseAdminClient()
    const { error: insertError } = await admin.from('webhook_deliveries').insert({
      endpoint_id: endpointId,
      event_type: eventType,
      payload,
      attempt_count: 1,
      next_retry_at: new Date().toISOString(),
    })

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

    return NextResponse.json({
      data: { message: 'Test event queued for delivery', event_type: eventType },
    })
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
