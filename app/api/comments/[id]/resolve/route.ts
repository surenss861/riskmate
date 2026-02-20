import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { getSessionToken, BACKEND_URL } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

const ROUTE = '/api/comments/[id]/resolve'

/** POST /api/comments/[id]/resolve — mark comment resolved. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id, user_role } = await getOrganizationContext(request)
    const { id: commentId } = await params

    const supabase = await createSupabaseServerClient()
    const { data: existing } = await supabase
      .from('comments')
      .select('id, author_id, deleted_at')
      .eq('id', commentId)
      .eq('organization_id', organization_id)
      .single()

    if (!existing || (existing as any).deleted_at) {
      const { response, errorId } = createErrorResponse(
        'Comment not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const isAuthor = (existing as any).author_id === user_id
    const isAdmin = user_role === 'owner' || user_role === 'admin'
    if (!isAuthor && !isAdmin) {
      const { response, errorId } = createErrorResponse(
        'Only the author or an admin can resolve this comment',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const now = new Date().toISOString()
    const { data: comment, error } = await supabase
      .from('comments')
      .update({
        is_resolved: true,
        resolved_by: user_id,
        resolved_at: now,
        updated_at: now,
      })
      .eq('id', commentId)
      .eq('organization_id', organization_id)
      .select()
      .single()

    if (error) throw error

    // Notify original author when someone else resolves their comment (gated by notification_preferences)
    const authorId = (existing as any).author_id
    if (authorId && authorId !== user_id) {
      const token = await getSessionToken(request)
      if (token && BACKEND_URL) {
        fetch(`${BACKEND_URL}/api/notifications/comment-resolved`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            organizationId: organization_id,
            commentId,
            resolverId: user_id,
          }),
        }).catch((err) =>
          console.error('[Comments] Comment resolved notification request failed:', err)
        )
      }
    }

    const { content: _c, ...rest } = comment as any
    return NextResponse.json({ data: { ...rest, content: _c } })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to resolve comment',
      'QUERY_ERROR',
      { requestId, statusCode: 500 }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal',
      severity: 'error',
      route: ROUTE,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}

/** DELETE /api/comments/[id]/resolve — unresolve comment. Kept for backward compatibility; prefer POST /api/comments/[id]/unresolve. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id, user_role } = await getOrganizationContext(request)
    const { id: commentId } = await params

    const supabase = await createSupabaseServerClient()
    const { data: existing } = await supabase
      .from('comments')
      .select('id, author_id, deleted_at')
      .eq('id', commentId)
      .eq('organization_id', organization_id)
      .single()

    if (!existing || (existing as any).deleted_at) {
      const { response, errorId } = createErrorResponse(
        'Comment not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const isAuthor = (existing as any).author_id === user_id
    const isAdmin = user_role === 'owner' || user_role === 'admin'
    if (!isAuthor && !isAdmin) {
      const { response, errorId } = createErrorResponse(
        'Only the author or an admin can unresolve this comment',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const now = new Date().toISOString()
    const { data: comment, error } = await supabase
      .from('comments')
      .update({
        is_resolved: false,
        resolved_by: null,
        resolved_at: null,
        updated_at: now,
      })
      .eq('id', commentId)
      .eq('organization_id', organization_id)
      .select()
      .single()

    if (error) throw error
    const { content: _c, ...rest } = comment as any
    return NextResponse.json({ data: { ...rest, content: _c } })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to unresolve comment',
      'QUERY_ERROR',
      { requestId, statusCode: 500 }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal',
      severity: 'error',
      route: ROUTE,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}
