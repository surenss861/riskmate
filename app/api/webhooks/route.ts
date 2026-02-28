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
    const roleResults = await Promise.all(
      organization_ids.map(async (orgId) => {
        const role = await getUserRole(admin, user_id, orgId)
        return { orgId, role } as const
      })
    )
    const adminOrgIds = roleResults
      .filter((r) => r.role === 'owner' || r.role === 'admin')
      .map((r) => r.orgId)
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

    return NextResponse.json({
      data: endpoints ?? [],
      organization_ids: adminOrgIds,
      default_organization_id: adminOrgIds[0] ?? null,
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

/** POST - Create endpoint (generate secret, validate URL). Requires owner/admin. Accepts explicit organization_id so multi-org admins create in the intended tenant. */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  try {
    const { organization_id: baseOrganizationId, organization_ids, user_id } = await getWebhookOrganizationContext(request)
    const body = await request.json().catch(() => ({}))
    const requestedOrgId = typeof body.organization_id === 'string' ? body.organization_id.trim() : null
    if (requestedOrgId && !organization_ids.includes(requestedOrgId)) {
      const { response, errorId } = createErrorResponse(
        'Organization not found or you do not have access to create webhooks for it',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const organization_id = requestedOrgId ?? baseOrganizationId
    const admin = createSupabaseAdminClient()
    const role = await getUserRole(admin, user_id, organization_id)
    requireAdminOrOwner(role)
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
      (e: unknown) => typeof e !== 'string' || !(EVENT_TYPES_SET as Set<string>).has(e)
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

    const { data: rows, error } = await admin.rpc('create_webhook_endpoint_with_secret', {
      p_organization_id: organization_id,
      p_url: url,
      p_events: validEvents,
      p_description: description || '',
      p_created_by: user_id,
      p_secret: secret,
    })

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

    const endpoint = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    if (!endpoint) {
      const { response, errorId } = createErrorResponse(
        'Webhook creation failed: no endpoint returned',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
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
