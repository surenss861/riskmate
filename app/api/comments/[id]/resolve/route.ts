import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/comments/[id]/resolve'

/** POST /api/comments/[id]/resolve — mark comment resolved. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)
    const { id: commentId } = await params

    const supabase = await createSupabaseServerClient()
    const { data: existing } = await supabase
      .from('comments')
      .select('id, deleted_at')
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
    return NextResponse.json({ data: comment })
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

/** DELETE /api/comments/[id]/resolve — unresolve comment. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id } = await getOrganizationContext(request)
    const { id: commentId } = await params

    const supabase = await createSupabaseServerClient()
    const { data: existing } = await supabase
      .from('comments')
      .select('id, deleted_at')
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
    return NextResponse.json({ data: comment })
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
