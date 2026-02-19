import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { extractMentionUserIds } from '@/lib/utils/mentionParser'

export const runtime = 'nodejs'

const ROUTE = '/api/comments/[id]/replies'

/** GET /api/comments/[id]/replies — list replies for a comment. Excludes soft-deleted by default. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id } = await getOrganizationContext(request)
    const { id: parentId } = await params

    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100)
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

    const { data: rows, error } = await supabase
      .from('comments')
      .select(
        'id, organization_id, entity_type, entity_id, parent_id, author_id, body, mentions, is_resolved, resolved_by, resolved_at, edited_at, deleted_at, created_at, updated_at'
      )
      .eq('organization_id', organization_id)
      .eq('parent_id', parentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const comments = (rows || []) as any[]
    if (comments.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const authorIds = [...new Set(comments.map((c) => c.author_id))]
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', authorIds)

    const userMap = new Map((users || []).map((u: any) => [u.id, u]))
    const data = comments.map((c) => ({
      ...c,
      author: userMap.get(c.author_id)
        ? {
            id: c.author_id,
            full_name: userMap.get(c.author_id)?.full_name ?? null,
            email: userMap.get(c.author_id)?.email ?? null,
          }
        : undefined,
      mentions: (c.mentions ?? []).map((user_id: string) => ({ user_id })),
    }))

    return NextResponse.json({ data })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to list replies',
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

/** POST /api/comments/[id]/replies — create a reply (with mention parsing and reply notification to parent author). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)
    const { id: parentId } = await params

    const supabase = await createSupabaseServerClient()
    const { data: parent } = await supabase
      .from('comments')
      .select('id, entity_type, entity_id, author_id, deleted_at')
      .eq('id', parentId)
      .eq('organization_id', organization_id)
      .single()

    if (!parent || (parent as any).deleted_at) {
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

    const body = await request.json().catch(() => ({}))
    const { body: commentBody, mention_user_ids: explicitMentions } = body
    const rawBody = typeof commentBody === 'string' ? commentBody : ''
    const trimmed = rawBody.trim()
    if (!trimmed) {
      const { response, errorId } = createErrorResponse(
        'body.body is required and must be non-empty',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const fromText = extractMentionUserIds(trimmed)
    const mentionUserIds = Array.isArray(explicitMentions)
      ? [...new Set([...explicitMentions, ...fromText])].filter((id) => id && id !== user_id)
      : fromText.filter((id) => id !== user_id)

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        organization_id,
        entity_type: (parent as any).entity_type,
        entity_id: (parent as any).entity_id,
        parent_id: parentId,
        author_id: user_id,
        body: trimmed,
        mentions: mentionUserIds,
      })
      .select()
      .single()

    if (error || !comment) throw error || new Error('Failed to create reply')

    const admin = createSupabaseAdminClient()
    const parentAuthorId = (parent as any).author_id
    if (parentAuthorId && parentAuthorId !== user_id) {
      await admin.from('notifications').insert({
        user_id: parentAuthorId,
        organization_id,
        type: 'reply',
        content: 'Someone replied to your comment.',
        is_read: false,
        deep_link: `riskmate://comments/${comment.id}`,
      })
    }
    for (const mentionedUserId of mentionUserIds) {
      await admin.from('notifications').insert({
        user_id: mentionedUserId,
        organization_id,
        type: 'mention',
        content: 'You were mentioned in a comment.',
        is_read: false,
        deep_link: `riskmate://comments/${comment.id}`,
      })
    }

    return NextResponse.json({ data: comment }, { status: 201 })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to create reply',
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
