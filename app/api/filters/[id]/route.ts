import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRequestId } from '@/lib/featureEvents'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'

export const runtime = 'nodejs'

const ROUTE = '/api/filters/[id]'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = request.headers.get('x-request-id') || getRequestId()

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to update filters',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      const { response, errorId } = createErrorResponse(
        'Failed to get organization ID',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, userData?.organization_id, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const organizationId = userData.organization_id
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, any> = {}
    if (body?.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        const { response, errorId } = createErrorResponse(
          'name must be a non-empty string',
          'INVALID_FORMAT',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'INVALID_FORMAT', errorId, requestId, organizationId, response.message, {
          category: 'validation', severity: 'warn', route: ROUTE,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      updateData.name = body.name.trim()
    }

    if (body?.filter_config !== undefined) {
      if (!body.filter_config || typeof body.filter_config !== 'object' || Array.isArray(body.filter_config)) {
        const { response, errorId } = createErrorResponse(
          'filter_config must be a valid object',
          'INVALID_FORMAT',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'INVALID_FORMAT', errorId, requestId, organizationId, response.message, {
          category: 'validation', severity: 'warn', route: ROUTE,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      updateData.filter_config = body.filter_config
    }

    if (body?.is_shared !== undefined) {
      updateData.is_shared = Boolean(body.is_shared)
    }

    if (Object.keys(updateData).length === 0) {
      const { response, errorId } = createErrorResponse(
        'No valid fields provided to update',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'VALIDATION_ERROR', errorId, requestId, organizationId, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const { data: updatedFilter, error: updateError } = await supabase
      .from('saved_filters')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .select('id, organization_id, user_id, name, filter_config, is_shared, created_at, updated_at')
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    if (!updatedFilter) {
      const { response, errorId } = createErrorResponse(
        'Filter not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      logApiError(404, 'NOT_FOUND', errorId, requestId, organizationId, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    return NextResponse.json({ data: updatedFilter })
  } catch (error: any) {
    console.error('Filter update failed:', error)
    const { response, errorId } = createErrorResponse(
      'Failed to update filter',
      'QUERY_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
      }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal', severity: 'error', route: ROUTE,
      details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = request.headers.get('x-request-id') || getRequestId()

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to delete filters',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      const { response, errorId } = createErrorResponse(
        'Failed to get organization ID',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, userData?.organization_id, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const organizationId = userData.organization_id
    const { id } = await params

    const { data: deletedFilter, error: deleteError } = await supabase
      .from('saved_filters')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .select('id')
      .maybeSingle()

    if (deleteError) {
      throw deleteError
    }

    if (!deletedFilter) {
      const { response, errorId } = createErrorResponse(
        'Filter not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      logApiError(404, 'NOT_FOUND', errorId, requestId, organizationId, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error('Filter delete failed:', error)
    const { response, errorId } = createErrorResponse(
      'Failed to delete filter',
      'QUERY_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
      }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal', severity: 'error', route: ROUTE,
      details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}
