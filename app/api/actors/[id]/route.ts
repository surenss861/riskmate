import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/actors/[id]'

function isValidUuid(s: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(s)
}

/**
 * GET /api/actors/[id]
 * Lightweight actor lookup for the current organization.
 * Returns actor_name, actor_email, actor_role for use in activity feeds.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id } = await getOrganizationContext(request)
    const { id: actorId } = await params

    if (!actorId || !isValidUuid(actorId)) {
      const { response, errorId } = createErrorResponse(
        'Invalid actor ID',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const supabase = await createSupabaseServerClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('id', actorId)
      .eq('organization_id', organization_id)
      .maybeSingle()

    if (error) {
      const { response, errorId } = createErrorResponse(
        'Failed to fetch actor',
        'QUERY_ERROR',
        { requestId, statusCode: 500, details: { databaseError: error.message } }
      )
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (!user) {
      const { response, errorId } = createErrorResponse(
        'Actor not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const payload = {
      actor_name: user.full_name ?? 'Unknown',
      actor_email: user.email ?? '',
      actor_role: user.role ?? 'member',
    }
    const successResponse = createSuccessResponse(payload, { requestId })
    return NextResponse.json(successResponse, {
      headers: { 'X-Request-ID': requestId },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to access this resource',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (error instanceof Error && error.message.includes('Access denied')) {
      const { response, errorId } = createErrorResponse(
        'You do not have permission to access this resource',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    throw error
  }
}
