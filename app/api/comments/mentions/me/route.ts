import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/comments/mentions/me'

/** GET /api/comments/mentions/me — list comments where the current user is mentioned. */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)

    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100)
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

    const { data: rows, error, count } = await supabase
      .from('comments')
      .select(
        'id, organization_id, entity_type, entity_id, parent_id, author_id, content, mentions, is_resolved, resolved_by, resolved_at, edited_at, deleted_at, created_at, updated_at',
        { count: 'exact' }
      )
      .eq('organization_id', organization_id)
      .is('deleted_at', null)
      .contains('mentions', [user_id])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const comments = (rows || []) as any[]
    const total = count ?? 0
    const has_more = total > offset + comments.length
    if (comments.length === 0) {
      return NextResponse.json({ data: [], count: total, has_more: false })
    }

    const authorIds = [...new Set(comments.map((c) => c.author_id))]
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', authorIds)

    const userMap = new Map((users || []).map((u: any) => [u.id, u]))
    const data = comments.map((c) => {
      const { content: contentText, ...rest } = c
      return {
        ...rest,
        content: contentText,
        author: userMap.get(c.author_id)
          ? {
              id: c.author_id,
              full_name: userMap.get(c.author_id)?.full_name ?? null,
              email: userMap.get(c.author_id)?.email ?? null,
            }
          : undefined,
        mentions: (c.mentions ?? []).map((uid: string) => ({ user_id: uid })),
      }
    })

    return NextResponse.json({ data, count: total, has_more })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to list mentions',
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
