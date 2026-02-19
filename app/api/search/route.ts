import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRequestId } from '@/lib/featureEvents'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { normalizeSearchQueryForTsquery } from '@/lib/utils/normalizeSearchQuery'

export const runtime = 'nodejs'

const ROUTE = '/api/search'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SearchType = 'jobs' | 'hazards' | 'clients' | 'all'

function isValidUUID(s: string): boolean {
  return UUID_REGEX.test(s)
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || getRequestId()

  try {
    const { searchParams } = new URL(request.url)
    const orgIdParam = searchParams.get('org_id')?.trim() ?? ''
    const qRaw = (searchParams.get('q') || '').trim()
    const q = qRaw ? normalizeSearchQueryForTsquery(qRaw) : '' // normalized for search RPCs (to_tsquery-safe)
    const type = (searchParams.get('type') || 'all') as SearchType
    const parsedLimit = parseInt(searchParams.get('limit') || '20', 10)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20
    const savedFilterIdParam = searchParams.get('saved_filter_id')?.trim() ?? ''

    if (!['jobs', 'hazards', 'clients', 'all'].includes(type)) {
      const { response, errorId } = createErrorResponse(
        'Invalid search type. Must be one of: jobs, hazards, clients, all',
        'INVALID_FORMAT',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'INVALID_FORMAT', errorId, requestId, undefined, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to search',
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

    const userOrgId = userData.organization_id
    let requestedOrgId: string
    if (orgIdParam) {
      if (!isValidUUID(orgIdParam)) {
        const { response, errorId } = createErrorResponse(
          'Invalid org_id: must be a valid UUID',
          'INVALID_FORMAT',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'INVALID_FORMAT', errorId, requestId, undefined, response.message, {
          category: 'validation', severity: 'warn', route: ROUTE,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      requestedOrgId = orgIdParam
    } else {
      requestedOrgId = userOrgId
    }

    const isOwnOrg = userOrgId === requestedOrgId
    let isMemberOfRequestedOrg = false
    if (!isOwnOrg) {
      const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
      const adminSupabase = createSupabaseAdminClient()
      const { data: member } = await adminSupabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', requestedOrgId)
        .maybeSingle()
      isMemberOfRequestedOrg = Boolean(member?.organization_id)
    }

    if (!isOwnOrg && !isMemberOfRequestedOrg) {
      const { response, errorId } = createErrorResponse(
        'Forbidden: You are not permitted to search this organization',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      logApiError(403, 'FORBIDDEN', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Use admin client when searching another org so RLS (get_user_organization_id) doesn't block results
    type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>
    let searchClient: SupabaseClient
    if (isOwnOrg) {
      searchClient = supabase
    } else {
      const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
      searchClient = createSupabaseAdminClient() as unknown as SupabaseClient
    }

    const organizationId = requestedOrgId
    const results: Array<{
      type: 'job' | 'hazard' | 'client'
      id: string
      title: string
      subtitle: string
      highlight: string
      score: number
    }> = []

    let total = 0
    let jobCount = 0
    let hazardCount = 0
    let clientCount = 0

    if (q) {
      if (type === 'jobs' || type === 'all') {
        const [{ data: jobRows, error: jobSearchError }, { data: jobCountData, error: jobCountError }] = await Promise.all([
          searchClient.rpc('search_jobs', {
            p_org_id: organizationId,
            p_query: q,
            p_limit: limit,
          }),
          searchClient.rpc('search_jobs_count', {
            p_org_id: organizationId,
            p_query: q,
          }),
        ])

        if (jobSearchError) {
          throw jobSearchError
        }
        if (jobCountError) {
          throw jobCountError
        }

        jobCount = Number(jobCountData ?? 0) || 0
        if (type === 'jobs') {
          total = jobCount
        }

        for (const row of jobRows || []) {
          results.push({
            type: 'job',
            id: row.id,
            title: (row.title || row.client_name || 'Untitled Job').trim() || 'Untitled Job',
            subtitle: [row.job_type, row.location].filter(Boolean).join(' • '),
            highlight: row.highlight || '',
            score: Number(row.score) || 0,
          })
        }
      }

      if (type === 'hazards' || type === 'all') {
        const [{ data: hazardRows, error: hazardSearchError }, { data: hazardCountData, error: hazardCountError }] = await Promise.all([
          searchClient.rpc('search_hazards', {
            p_org_id: organizationId,
            p_query: q,
            p_limit: limit,
          }),
          searchClient.rpc('search_hazards_count', {
            p_org_id: organizationId,
            p_query: q,
          }),
        ])

        if (hazardSearchError) {
          throw hazardSearchError
        }
        if (hazardCountError) {
          throw hazardCountError
        }

        hazardCount = Number(hazardCountData ?? 0) || 0
        if (type === 'hazards') {
          total = hazardCount
        } else if (type === 'all') {
          total = jobCount + hazardCount
        }

        for (const row of hazardRows || []) {
          const desc = row.description ?? ''
          const title = (row.hazard_type || desc.slice(0, 50) + (desc.length > 50 ? '...' : '')).trim() || 'Hazard'
          const subtitle = [row.severity].filter(Boolean).join(' • ')
          results.push({
            type: 'hazard',
            id: row.id,
            title,
            subtitle,
            highlight: row.highlight || '',
            score: Number(row.score) || 0,
          })
        }
      }

      if (type === 'clients' || type === 'all') {
        const [{ data: clientRows, error: clientSearchError }, { data: clientCountData, error: clientCountError }] = await Promise.all([
          searchClient.rpc('search_clients', {
            p_org_id: organizationId,
            p_query: q,
            p_limit: limit,
          }),
          searchClient.rpc('search_clients_count', {
            p_org_id: organizationId,
            p_query: q,
          }),
        ])

        if (clientSearchError) {
          throw clientSearchError
        }
        if (clientCountError) {
          throw clientCountError
        }

        clientCount = Number(clientCountData ?? 0) || 0
        if (type === 'clients') {
          total = clientCount
        } else if (type === 'all') {
          total = jobCount + hazardCount + clientCount
        }

        for (const row of clientRows || []) {
          results.push({
            type: 'client',
            id: row.id,
            title: (row.display_name || '').trim() || 'Client',
            subtitle: '',
            highlight: row.highlight || '',
            score: Number(row.rank) || 0,
          })
        }
      }

      results.sort((a, b) => b.score - a.score)

      if (type === 'all') {
        results.splice(limit)
      }
    }

    const seenSuggestions = new Set<string>()
    const suggestions: string[] = []

    if (qRaw) {
      const { data: suggestionRows } = await searchClient
        .from('jobs')
        .select('client_name')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .ilike('client_name', `%${qRaw}%`)
        .limit(10)

      for (const row of suggestionRows || []) {
        const value = row.client_name?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      const { data: clientNameRows } = await searchClient
        .from('clients')
        .select('name')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .ilike('name', `%${qRaw}%`)
        .limit(10)

      for (const row of clientNameRows || []) {
        const value = row.name?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      const { data: locationRows } = await searchClient
        .from('jobs')
        .select('location')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .not('location', 'is', null)
        .ilike('location', `%${qRaw}%`)
        .limit(10)

      for (const row of locationRows || []) {
        const value = row.location?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }
    } else {
      const { data: clientRows } = await searchClient
        .from('jobs')
        .select('client_name')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .not('client_name', 'is', null)
        .limit(50)

      for (const row of clientRows || []) {
        const value = row.client_name?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      const { data: clientsTableRows } = await searchClient
        .from('clients')
        .select('name')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .limit(50)

      for (const row of clientsTableRows || []) {
        const value = row.name?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      const { data: jobTypeRows } = await searchClient
        .from('jobs')
        .select('job_type')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .not('job_type', 'is', null)
        .limit(50)

      for (const row of jobTypeRows || []) {
        const value = row.job_type?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      const { data: locationRows } = await searchClient
        .from('jobs')
        .select('location')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .not('location', 'is', null)
        .limit(50)

      for (const row of locationRows || []) {
        const value = row.location?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      suggestions.splice(15)
    }

    // Optional: return applied saved filter when requested (for integration with jobs list / filter UI)
    let applied_filter: { id: string; name: string; filter_config: Record<string, unknown> } | null = null
    if (savedFilterIdParam && isValidUUID(savedFilterIdParam)) {
      const { data: savedFilter } = await searchClient
        .from('saved_filters')
        .select('id, name, filter_config')
        .eq('organization_id', organizationId)
        .eq('id', savedFilterIdParam)
        .or(`user_id.eq.${user.id},is_shared.eq.true`)
        .maybeSingle()
      if (savedFilter?.id && savedFilter?.name != null && savedFilter?.filter_config != null) {
        applied_filter = {
          id: savedFilter.id,
          name: savedFilter.name,
          filter_config: (savedFilter.filter_config as Record<string, unknown>) ?? {},
        }
      }
    }

    return NextResponse.json({
      results,
      total,
      suggestions,
      ...(applied_filter && { applied_filter }),
    })
  } catch (error: any) {
    console.error('Search failed:', error)
    const { response, errorId } = createErrorResponse(
      'Failed to search',
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
