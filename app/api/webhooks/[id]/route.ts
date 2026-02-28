import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getWebhookOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { validateWebhookUrl } from '@/lib/utils/webhookUrl'
import { getEndpointAndCheckOrg } from '@/lib/webhooks/endpointGuard'
import { WEBHOOK_EVENT_TYPES } from '@/lib/webhooks/trigger'
import { getUserRole } from '@/lib/utils/adminAuth'
import { requireAdminOrOwner } from '@/lib/utils/adminAuth'

export const runtime = 'nodejs'

const ROUTE = '/api/webhooks/[id]'

const EVENT_TYPES_SET = new Set(WEBHOOK_EVENT_TYPES)

/** PATCH - Update endpoint (URL, events, active status). Requires owner/admin. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { organization_ids, user_id } = await getWebhookOrganizationContext(request)
    const { id } = await params
    const supabase = await createSupabaseServerClient()

    const endpoint = await getEndpointAndCheckOrg(supabase, id, organization_ids)
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
    const admin = createSupabaseAdminClient()
    const role = await getUserRole(admin, user_id, endpoint.organization_id)
    requireAdminOrOwner(role)

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.url === 'string') {
      const url = body.url.trim()
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
      updates.url = url
    }
    if (Array.isArray(body.events)) {
      const invalid = body.events.filter(
        (e: unknown) => typeof e !== 'string' || !EVENT_TYPES_SET.has(e)
      )
      if (invalid.length > 0) {
        const { response, errorId } = createErrorResponse(
          `Unknown or invalid event type(s): ${invalid.join(', ')}`,
          'VALIDATION_ERROR',
          { requestId, statusCode: 400 }
        )
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      const valid = [...new Set(body.events as string[])]
      if (valid.length === 0) {
        const { response, errorId } = createErrorResponse(
          'At least one valid event type is required',
          'VALIDATION_ERROR',
          { requestId, statusCode: 400 }
        )
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      updates.events = valid
    }
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
    if (typeof body.description === 'string') updates.description = body.description.trim() || null

    const { data: updated, error } = await supabase
      .from('webhook_endpoints')
      .update(updates)
      .eq('id', id)
      .select('id, url, events, is_active, description, updated_at')
      .single()

    if (error) {
      const { response, errorId } = createErrorResponse(
        error.message,
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    return NextResponse.json({ data: updated })
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

/** DELETE - Delete endpoint. Requires owner/admin. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { organization_ids, user_id } = await getWebhookOrganizationContext(request)
    const { id } = await params
    const supabase = await createSupabaseServerClient()

    const endpoint = await getEndpointAndCheckOrg(supabase, id, organization_ids)
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
    const admin = createSupabaseAdminClient()
    const role = await getUserRole(admin, user_id, endpoint.organization_id)
    requireAdminOrOwner(role)

    const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id)

    if (error) {
      const { response, errorId } = createErrorResponse(
        error.message,
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    return new NextResponse(null, { status: 204 })
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
