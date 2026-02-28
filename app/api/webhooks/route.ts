import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getWebhookOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { generateSecret } from '@/lib/utils/webhookSigning'
import { validateWebhookUrl } from '@/lib/utils/webhookUrl'
import { WEBHOOK_EVENT_TYPES } from '@/lib/webhooks/trigger'
import { getUserRole } from '@/lib/utils/adminAuth'
import { requireAdminOrOwner } from '@/lib/utils/adminAuth'

export const runtime = 'nodejs'

const ROUTE = '/api/webhooks'

const EVENT_TYPES_SET = new Set(WEBHOOK_EVENT_TYPES)


/** GET - List org webhook endpoints (only orgs where user is owner/admin) */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  try {
    const { organization_ids, user_id } = await getWebhookOrganizationContext(request)
    const admin = createSupabaseAdminClient()
    const adminOrgIds: string[] = []
    for (const orgId of organization_ids) {
      const role = await getUserRole(admin, user_id, orgId)
      if (role === 'owner' || role === 'admin') adminOrgIds.push(orgId)
    }
    if (adminOrgIds.length === 0) {
      const { response, errorId } = createErrorResponse(
        'Forbidden: Only owners and admins can manage webhooks',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const supabase = await createSupabaseServerClient()

    const { data: endpoints, error } = await supabase
      .from('webhook_endpoints')
      .select('id, url, events, is_active, description, created_at')
      .in('organization_id', adminOrgIds)
      .order('created_at', { ascending: false })

    if (error) {
      const { response, errorId } = createErrorResponse(
        error.message,
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, adminOrgIds[0], response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    return NextResponse.json({ data: endpoints ?? [] })
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

/** POST - Create endpoint (generate secret, validate URL). Requires owner/admin. */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  try {
    const { organization_id, user_id } = await getWebhookOrganizationContext(request)
    const admin = createSupabaseAdminClient()
    const role = await getUserRole(admin, user_id, organization_id)
    requireAdminOrOwner(role)
    const body = await request.json().catch(() => ({}))
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const events = Array.isArray(body.events) ? body.events : []
    const description = typeof body.description === 'string' ? body.description.trim() : null

    const urlValidation = url ? await validateWebhookUrl(url) : { valid: false as const, reason: 'URL is required', terminal: true as const }
    if (!url || !urlValidation.valid) {
      const { response, errorId } = createErrorResponse(
        urlValidation.valid ? 'Valid URL is required' : urlValidation.reason,
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const invalidEvents = events.filter(
      (e: unknown) => typeof e !== 'string' || !EVENT_TYPES_SET.has(e)
    )
    if (invalidEvents.length > 0) {
      const { response, errorId } = createErrorResponse(
        `Unknown or invalid event type(s): ${invalidEvents.join(', ')}`,
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const validEvents = [...new Set(events as string[])]
    if (validEvents.length === 0) {
      const { response, errorId } = createErrorResponse(
        'At least one event type is required',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const secret = generateSecret()
    const supabase = await createSupabaseServerClient()

    const { data: endpoint, error } = await supabase
      .from('webhook_endpoints')
      .insert({
        organization_id,
        url,
        events: validEvents,
        is_active: true,
        description: description || null,
        created_by: user_id,
      })
      .select('id, url, events, is_active, description, created_at')
      .single()

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

    const adminClient = createSupabaseAdminClient()
    const { error: secretError } = await adminClient
      .from('webhook_endpoint_secrets')
      .insert({ endpoint_id: endpoint.id, secret })

    if (secretError) {
      const { response, errorId } = createErrorResponse(
        'Failed to store webhook secret',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'SECRET_INSERT_ERROR', errorId, requestId, organization_id, secretError.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    return NextResponse.json({
      data: { ...endpoint, secret },
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
