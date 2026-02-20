import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { extractMentionUserIds } from '@/lib/utils/mentionParser'
import { getSessionToken, BACKEND_URL } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

const ROUTE = '/api/comments/[id]'

/** PATCH /api/comments/[id] — update comment content (sets edited_at). Re-parses mentions, sends notifications for newly added. Author only. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)
    const { id: commentId } = await params

    const body = await request.json().catch(() => ({}))
    const rawContent = body?.content ?? body?.body
    const commentBody = typeof rawContent === 'string' ? rawContent.trim() : ''
    if (!commentBody) {
      const { response, errorId } = createErrorResponse(
        'content must be a non-empty string',
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
      .select('id, author_id, deleted_at, mentions')
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
    const isAuthor = (existing as any).author_id === user_id
    if (!isAuthor) {
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

    const fromText = extractMentionUserIds(commentBody)
    const rawMentionIds = fromText.filter((id) => id && id !== user_id)

    let mentionUserIds: string[]
    if (rawMentionIds.length === 0) {
      mentionUserIds = []
    } else {
      const { data: orgUsers } = await supabase
        .from('users')
        .select('id')
        .eq('organization_id', organization_id)
      const orgIds = new Set((orgUsers ?? []).map((r: { id: string }) => r.id))
      mentionUserIds = rawMentionIds.filter((id) => orgIds.has(id))
    }

    const existingMentions: string[] = (existing as any).mentions ?? []
    const existingSet = new Set(existingMentions)
    const addedMentionIds = mentionUserIds.filter((id) => !existingSet.has(id))

    const now = new Date().toISOString()
    const { data: comment, error } = await supabase
      .from('comments')
      .update({
        content: commentBody,
        mentions: mentionUserIds,
        edited_at: now,
        updated_at: now,
      })
      .eq('id', commentId)
      .eq('organization_id', organization_id)
      .select()
      .single()

    if (error) throw error

    const token = await getSessionToken(request)
    if (token && BACKEND_URL && addedMentionIds.length > 0) {
      const contextLabel = 'You were mentioned in a comment.'
      for (const mentionedUserId of addedMentionIds) {
        fetch(`${BACKEND_URL}/api/notifications/mention`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            organizationId: organization_id,
            userId: mentionedUserId,
            commentId,
            contextLabel,
          }),
        }).catch((err) => console.error('[Comments] Mention notification (edit) failed:', err))
      }
    }

    const { content: _c, ...rest } = comment as any
    return NextResponse.json({ data: { ...rest, content: _c } })
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

/** DELETE /api/comments/[id] — soft-delete comment (sets deleted_at). Author or org owner/admin. */
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
    const { error: updateError } = await supabase
      .from('comments')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', commentId)
      .eq('organization_id', organization_id)

    if (updateError) {
      const { response, errorId } = createErrorResponse(
        updateError.message || 'Failed to delete comment',
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
