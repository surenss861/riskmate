import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyEntityOwnership, COMMENT_ENTITY_TYPES, type CommentEntityType } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { extractMentionUserIds } from '@/lib/utils/mentionParser'
import { getSessionToken, BACKEND_URL } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

const ROUTE = '/api/comments'

function parseEntityType(value: string | null): CommentEntityType | null {
  if (!value || typeof value !== 'string') return null
  return COMMENT_ENTITY_TYPES.includes(value as CommentEntityType) ? (value as CommentEntityType) : null
}

/** GET /api/comments — list comments for an entity (entity_type + entity_id). Same selection, author enrichment, reply count as job comments. */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const { organization_id } = await getOrganizationContext(request)

    const url = new URL(request.url)
    const entityType = parseEntityType(url.searchParams.get('entity_type'))
    const entityId = url.searchParams.get('entity_id')

    if (!entityType || !entityId) {
      const { response, errorId } = createErrorResponse(
        'entity_type and entity_id are required and must be valid',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    await verifyEntityOwnership(entityType, entityId, organization_id)

    const supabase = await createSupabaseServerClient()
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100)
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
    const includeReplies = url.searchParams.get('include_replies') !== 'false'

    let query = supabase
      .from('comments')
      .select(
        'id, organization_id, entity_type, entity_id, parent_id, author_id, body, mentions, is_resolved, resolved_by, resolved_at, edited_at, deleted_at, created_at, updated_at'
      )
      .eq('organization_id', organization_id)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (!includeReplies) {
      query = query.is('parent_id', null)
    }

    const { data: rows, error } = await query.range(offset, offset + limit - 1)

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

    const commentIds = comments.map((c) => c.id)
    const { data: replyRows } = await supabase
      .from('comments')
      .select('parent_id')
      .in('parent_id', commentIds)
      .is('deleted_at', null)

    const replyCountByParent: Record<string, number> = {}
    for (const r of replyRows || []) {
      const pid = r.parent_id
      if (pid) replyCountByParent[pid] = (replyCountByParent[pid] ?? 0) + 1
    }

    const userMap = new Map((users || []).map((u: any) => [u.id, u]))
    const data = comments.map((c) => {
      const { body: bodyText, ...rest } = c
      return {
        ...rest,
        content: bodyText,
        author: userMap.get(c.author_id)
          ? {
              id: c.author_id,
              full_name: userMap.get(c.author_id)?.full_name ?? null,
              email: userMap.get(c.author_id)?.email ?? null,
            }
          : undefined,
        mentions: (c.mentions ?? []).map((user_id: string) => ({ user_id })),
        reply_count: replyCountByParent[c.id] ?? 0,
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to list comments',
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

/** POST /api/comments — create a comment for an entity (entity_type + entity_id). Same mention parsing and notification wiring as job comments. */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)

    const body = await request.json().catch(() => ({}))
    const rawContent = body?.content ?? body?.body
    const entityType = parseEntityType(body?.entity_type ?? null)
    const entityId = typeof body?.entity_id === 'string' ? body.entity_id.trim() : null
    const { parent_id, mention_user_ids: explicitMentions } = body

    const trimmed = typeof rawContent === 'string' ? rawContent.trim() : ''
    if (!trimmed) {
      const { response, errorId } = createErrorResponse(
        'content is required and must be non-empty',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (!entityType || !entityId) {
      const { response, errorId } = createErrorResponse(
        'entity_type and entity_id are required and must be valid',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    await verifyEntityOwnership(entityType, entityId, organization_id)

    const supabase = await createSupabaseServerClient()

    if (parent_id != null && parent_id !== '') {
      const { data: parentRow, error: parentError } = await supabase
        .from('comments')
        .select('id, organization_id, entity_type, entity_id, deleted_at')
        .eq('id', parent_id)
        .eq('organization_id', organization_id)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .is('deleted_at', null)
        .maybeSingle()

      if (parentError) throw parentError
      if (!parentRow) {
        const { response: errResp, errorId: errId } = createErrorResponse(
          'Parent comment not found or not valid for this entity',
          'NOT_FOUND',
          { requestId, statusCode: 404 }
        )
        return NextResponse.json(errResp, {
          status: 404,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errId },
        })
      }
    }

    const fromText = extractMentionUserIds(trimmed)
    const rawMentionIds = Array.isArray(explicitMentions)
      ? [...new Set([...explicitMentions, ...fromText])].filter((id) => id && id !== user_id)
      : fromText.filter((id) => id !== user_id)

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

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        organization_id,
        entity_type: entityType,
        entity_id: entityId,
        parent_id: parent_id ?? null,
        author_id: user_id,
        body: trimmed,
        mentions: mentionUserIds,
      })
      .select()
      .single()

    if (error || !comment) {
      throw error || new Error('Failed to create comment')
    }

    const token = await getSessionToken(request)
    const contextLabel = 'You were mentioned in a comment.'
    if (token && BACKEND_URL && mentionUserIds.length > 0) {
      for (const mentionedUserId of mentionUserIds) {
        fetch(`${BACKEND_URL}/api/notifications/mention`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: mentionedUserId,
            commentId: (comment as any).id,
            contextLabel,
          }),
        }).catch((err) => console.error('[Comments] Mention notification request failed:', err))
      }
    }

    const { body: _b, ...commentRest } = comment as any
    return NextResponse.json({ data: { ...commentRest, content: _b } }, { status: 201 })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to create comment',
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
