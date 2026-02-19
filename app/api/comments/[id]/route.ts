import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/comments/[id]'

/** PATCH /api/comments/[id] — update comment body (sets edited_at). Author only. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)
    const { id: commentId } = await params

    const body = await request.json().catch(() => ({}))
    const commentBody = body?.body
    if (typeof commentBody !== 'string' || !commentBody.trim()) {
      const { response, errorId } = createErrorResponse(
        'body.body must be a non-empty string',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const supabase = await createSupabaseServerClient()
    const { data: existing } = await supabase
      .from('comments')
      .select('id, author_id, deleted_at')
      .eq('id', commentId)
      .eq('organization_id', organization_id)
      .single()

    if (!existing) {
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
    if ((existing as any).deleted_at) {
      const { response, errorId } = createErrorResponse(
        'Comment is deleted',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if ((existing as any).author_id !== user_id) {
      const { response, errorId } = createErrorResponse(
        'Only the author can update this comment',
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
        body: commentBody.trim(),
        edited_at: now,
        updated_at: now,
      })
      .eq('id', commentId)
      .eq('organization_id', organization_id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data: comment })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to update comment',
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

/** DELETE /api/comments/[id] — soft-delete comment (sets deleted_at). Author or org admin. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id, user_role } = await getOrganizationContext(request)
    const { id: commentId } = await params

    const supabase = await createSupabaseServerClient()
    const { data: comment } = await supabase
      .from('comments')
      .select('id, author_id, deleted_at')
      .eq('id', commentId)
      .eq('organization_id', organization_id)
      .single()

    if (!comment) {
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
    if ((comment as any).deleted_at) {
      return new NextResponse(null, { status: 204 })
    }

    const isAuthor = (comment as any).author_id === user_id
    const isAdmin = user_role === 'owner' || user_role === 'admin'
    if (!isAuthor && !isAdmin) {
      const { response, errorId } = createErrorResponse(
        'Only the author or an admin can delete this comment',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const now = new Date().toISOString()
    await supabase
      .from('comments')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', commentId)
      .eq('organization_id', organization_id)

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to delete comment',
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
