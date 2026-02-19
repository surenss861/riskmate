import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRequestId } from '@/lib/featureEvents'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'

export const runtime = 'nodejs'

const ROUTE = '/api/filters/[id]'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(s: string): boolean {
  return UUID_REGEX.test(s)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = request.headers.get('x-request-id') || getRequestId()

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to view filters',
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

    if (!isValidUUID(id)) {
      const { response, errorId } = createErrorResponse(
        'Invalid filter id: must be a valid UUID',
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

    // RLS-compatible: organization_id and visibility (owner or is_shared)
    const { data: filter, error: fetchError } = await supabase
      .from('saved_filters')
      .select('id, organization_id, user_id, name, filter_config, is_shared, created_at, updated_at')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .or(`user_id.eq.${user.id},is_shared.eq.true`)
      .maybeSingle()

    if (fetchError) {
      const { response, errorId } = createErrorResponse(
        'Failed to fetch filter',
        'QUERY_ERROR',
        {
          requestId,
          statusCode: 500,
          details: process.env.NODE_ENV === 'development' ? { detail: fetchError?.message } : undefined,
        }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, organizationId, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
        details: process.env.NODE_ENV === 'development' ? { detail: fetchError?.message } : undefined,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (!filter) {
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

    return NextResponse.json({ data: filter })
  } catch (error: any) {
    console.error('Filter fetch failed:', error)
    const { response, errorId } = createErrorResponse(
      'Failed to fetch filter',
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

    if (!isValidUUID(id)) {
      const { response, errorId } = createErrorResponse(
        'Invalid filter id: must be a valid UUID',
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

    // RLS-compatible: organization_id and ownership (only owner can update)
    const { data: updatedFilter, error: updateError } = await supabase
      .from('saved_filters')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .select('id, organization_id, user_id, name, filter_config, is_shared, created_at, updated_at')
      .maybeSingle()

    if (updateError) {
      const statusCode =
        updateError.code === '23502' || updateError.code === '23503' || updateError.code === '23505'
          ? 400
          : 500
      const errorCode =
        updateError.code === '23502'
          ? 'MISSING_REQUIRED_FIELD'
          : updateError.code === '23503'
          ? 'INVALID_FORMAT'
          : updateError.code === '23505'
          ? 'VALIDATION_ERROR'
          : 'QUERY_ERROR'
      const { response, errorId } = createErrorResponse(
        updateError.message || 'Failed to update filter',
        errorCode,
        {
          requestId,
          statusCode,
          details: process.env.NODE_ENV === 'development' ? { detail: updateError?.message } : undefined,
        }
      )
      logApiError(statusCode, errorCode, errorId, requestId, organizationId, response.message, {
        category: statusCode >= 500 ? 'internal' : 'validation',
        severity: statusCode >= 500 ? 'error' : 'warn',
        route: ROUTE,
        details: process.env.NODE_ENV === 'development' ? { detail: updateError?.message } : undefined,
      })
      return NextResponse.json(response, {
        status: statusCode,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
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

    if (!isValidUUID(id)) {
      const { response, errorId } = createErrorResponse(
        'Invalid filter id: must be a valid UUID',
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

    // RLS-compatible: organization_id and ownership (only owner can delete)
    const { data: deletedFilter, error: deleteError } = await supabase
      .from('saved_filters')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .select('id')
      .maybeSingle()

    if (deleteError) {
      const { response, errorId } = createErrorResponse(
        deleteError.message || 'Failed to delete filter',
        'QUERY_ERROR',
        {
          requestId,
          statusCode: 500,
          details: process.env.NODE_ENV === 'development' ? { detail: deleteError?.message } : undefined,
        }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, organizationId, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
        details: process.env.NODE_ENV === 'development' ? { detail: deleteError?.message } : undefined,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
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
