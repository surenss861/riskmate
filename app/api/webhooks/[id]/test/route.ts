import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getWebhookOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'
import { WEBHOOK_EVENT_TYPES } from '@/lib/webhooks/trigger'
import { buildWebhookEventObject } from '@/lib/webhooks/payloads'
import { getEndpointAndCheckOrg } from '@/lib/webhooks/endpointGuard'
import { getUserRole } from '@/lib/utils/adminAuth'
import { requireAdminOrOwner } from '@/lib/utils/adminAuth'

export const runtime = 'nodejs'

const ROUTE = '/api/webhooks/[id]/test'

/** Build event-specific sample object so test payload matches real contract for each event type. */
function buildTestObjectForEventType(eventType: string): Record<string, unknown> {
  const ts = new Date().toISOString()
  const testId = `test_${Date.now()}`
  switch (eventType) {
    case 'job.created':
    case 'job.updated':
    case 'job.completed':
      return {
        id: testId,
        title: 'Test webhook from RiskMate',
        status: eventType === 'job.completed' ? 'completed' : 'draft',
        test: true,
        created_at: ts,
        updated_at: ts,
        ...(eventType === 'job.completed' ? { completed_at: ts } : {}),
      }
    case 'job.deleted':
      return {
        id: testId,
        deleted_at: ts,
        status: 'draft',
        bulk: false,
        test: true,
      }
    case 'hazard.created':
    case 'hazard.updated':
      return {
        id: testId,
        job_id: testId,
        title: 'Test hazard',
        description: 'Sample for webhook test',
        done: false,
        is_completed: false,
        completed_at: null,
        created_at: ts,
        updated_at: ts,
        test: true,
      }
    case 'signature.added':
      return {
        signoff_id: testId,
        job_id: testId,
        signer_id: testId,
        signoff_type: 'approval',
        created_at: ts,
        test: true,
      }
    case 'team.member_added':
      return {
        user_id: testId,
        email: 'test@example.com',
        role: 'member',
        invited_by: testId,
        invite_id: testId,
        test: true,
      }
    case 'report.generated':
      return {
        report_run_id: testId,
        job_id: testId,
        packet_type: 'standard',
        status: 'completed',
        data_hash: 'test_hash',
        generated_at: ts,
        test: true,
      }
    case 'evidence.uploaded':
      return {
        document_id: testId,
        job_id: testId,
        name: 'test-document.pdf',
        type: 'application/pdf',
        file_path: 'uploads/test.pdf',
        uploaded_by: testId,
        created_at: ts,
        test: true,
      }
    default:
      return {
        id: testId,
        title: 'Test webhook from RiskMate',
        status: 'draft',
        test: true,
        created_at: ts,
      }
  }
}

/** POST - Send test event to this endpoint only (enqueues one delivery) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { organization_ids, user_id } = await getWebhookOrganizationContext(request)
    const { id: endpointId } = await params
    const supabase = await createSupabaseServerClient()

    const endpoint = await getEndpointAndCheckOrg(supabase, endpointId, organization_ids, 'id, organization_id, events, is_active')
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
    const adminClient = createSupabaseAdminClient()
    const role = await getUserRole(adminClient, user_id, (endpoint as { organization_id: string }).organization_id)
    requireAdminOrOwner(role)

    if ((endpoint as { is_active?: boolean }).is_active === false) {
      const { response, errorId } = createErrorResponse(
        'Cannot send test: endpoint is paused. Resume the endpoint to send test events.',
        'ENDPOINT_PAUSED',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const events = Array.isArray((endpoint as { events?: string[] }).events)
      ? (endpoint as { events: string[] }).events
      : []

    // Optional: accept requested test event type in body; validate against subscribed events
    let eventType: string
    try {
      const body = await request.json().catch(() => ({}))
      const requested = typeof (body as { event_type?: string }).event_type === 'string'
        ? (body as { event_type: string }).event_type.trim()
        : null
      if (requested) {
        if (!WEBHOOK_EVENT_TYPES.includes(requested as (typeof WEBHOOK_EVENT_TYPES)[number])) {
          const { response, errorId } = createErrorResponse(
            'Invalid event_type for test',
            'VALIDATION_ERROR',
            { requestId, statusCode: 400 }
          )
          return NextResponse.json(response, {
            status: 400,
            headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
          })
        }
        if (!events.includes(requested)) {
          const { response, errorId } = createErrorResponse(
            'Requested event_type is not subscribed for this endpoint',
            'VALIDATION_ERROR',
            { requestId, statusCode: 400 }
          )
          return NextResponse.json(response, {
            status: 400,
            headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
          })
        }
        eventType = requested
      } else {
        eventType =
          events.length > 0
            ? events.includes('job.created')
              ? 'job.created'
              : events[0]
            : 'job.created'
      }
    } catch {
      eventType =
        events.length > 0
          ? events.includes('job.created')
            ? 'job.created'
            : events[0]
          : 'job.created'
    }

    const rawObject = buildTestObjectForEventType(eventType)
    const normalizedObject = buildWebhookEventObject(eventType, rawObject)
    const payload = {
      id: `evt_test_${Date.now()}`,
      type: eventType,
      created: new Date().toISOString(),
      organization_id: (endpoint as { organization_id: string }).organization_id,
      data: {
        object: normalizedObject,
      },
    }

    const { error: insertError } = await adminClient.from('webhook_deliveries').insert({
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
