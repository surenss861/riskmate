/**
 * GET /api/me/context
 *
 * Returns the authenticated user's organization-scoped context: effective role,
 * default organization_id, and full memberships list (for session bootstrap and org switcher).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationContextWithMemberships } from '@/lib/utils/organizationGuard'
import { UnauthorizedError, ForbiddenError } from '@/lib/utils/adminAuth'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

function isOrgSelectionMessage(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('multiple organizations') || lower.includes('x-organization-id') || lower.includes('organization_id')
}

function isOrgNotAccessibleMessage(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('not one of your memberships') || lower.includes('specified organization')
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  try {
    const { user_role, organization_id, memberships } = await getOrganizationContextWithMemberships(request)
    return NextResponse.json({
      user_role,
      organization_id,
      memberships: memberships ?? [],
    })
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      const { response, errorId } = createErrorResponse(
        err.message || 'Unauthorized',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (err instanceof ForbiddenError) {
      const message = err?.message ?? 'Forbidden'
      const code = message.toLowerCase().includes('no organization')
        ? 'NO_ORGANIZATION'
        : isOrgSelectionMessage(message)
          ? 'ORGANIZATION_SELECTION_REQUIRED'
          : isOrgNotAccessibleMessage(message)
            ? 'ORGANIZATION_NOT_ACCESSIBLE'
            : 'FORBIDDEN'
      const { response, errorId } = createErrorResponse(message, code, {
        requestId,
        statusCode: 403,
      })
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const { response, errorId } = createErrorResponse(
      err?.message ?? 'Internal server error',
      'QUERY_ERROR',
      { requestId, statusCode: 500 }
    )
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}
