import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRequestId } from '@/lib/featureEvents'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'

export const runtime = 'nodejs'

const ROUTE = '/api/filters'

export async function GET(request: NextRequest) {
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

    const { data: filters, error: filtersError } = await supabase
      .from('saved_filters')
      .select('id, organization_id, user_id, name, filter_config, is_shared, created_at, updated_at')
      .eq('organization_id', organizationId)
      .or(`user_id.eq.${user.id},is_shared.eq.true`)
      .order('created_at', { ascending: false })

    if (filtersError) {
      throw filtersError
    }

    return NextResponse.json({ data: filters || [] })
  } catch (error: any) {
    console.error('Filters fetch failed:', error)
    const { response, errorId } = createErrorResponse(
      'Failed to fetch filters',
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

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || getRequestId()

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to create filters',
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
    const body = await request.json()
    const { name, filter_config, is_shared = false } = body || {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      const { response, errorId } = createErrorResponse(
        'Filter name is required',
        'MISSING_REQUIRED_FIELD',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'MISSING_REQUIRED_FIELD', errorId, requestId, organizationId, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (!filter_config || typeof filter_config !== 'object' || Array.isArray(filter_config)) {
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

    const { data: newFilter, error: insertError } = await supabase
      .from('saved_filters')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        name: name.trim(),
        filter_config,
        is_shared: Boolean(is_shared),
      })
      .select('id, organization_id, user_id, name, filter_config, is_shared, created_at, updated_at')
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ data: newFilter }, { status: 201 })
  } catch (error: any) {
    console.error('Filter creation failed:', error)
    const { response, errorId } = createErrorResponse(
      'Failed to create filter',
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
