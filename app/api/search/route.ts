import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRequestId } from '@/lib/featureEvents'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { normalizeSearchQueryForTsquery } from '@/lib/utils/normalizeSearchQuery'
import { normalizeFilterConfig, getMatchingJobIdsFromFilterGroup, type SupabaseClientLike } from '@/lib/jobs/filterConfig'

export const runtime = 'nodejs'

const ROUTE = '/api/search'

/**
 * GET /api/search
 *
 * Accepted query params:
 * - q: search text (normalized for full-text search)
 * - type: 'jobs' | 'hazards' | 'clients' | 'all'
 * - limit: 1–100, default 20
 * - org_id: optional org UUID (must be member)
 * - saved_filter_id: optional saved filter UUID; its filter_config is applied to job search
 * - has_photos: optional boolean; when set, filter jobs by presence of photos
 * - has_signatures: optional boolean; when set, filter jobs by presence of signatures
 * - needs_signatures: optional boolean; when set, filter jobs that have no signatures yet
 * - include_archived: optional boolean; when true, include archived jobs in results
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SearchType = 'jobs' | 'hazards' | 'clients' | 'all'

function isValidUUID(s: string): boolean {
  return UUID_REGEX.test(s)
}

function parseBooleanParam(value: string | null): boolean | null {
  if (value === null) return null
  if (value === 'true') return true
  if (value === 'false') return false
  return null
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
    const hasPhotos = parseBooleanParam(searchParams.get('has_photos'))
    const hasSignatures = parseBooleanParam(searchParams.get('has_signatures'))
    const needsSignatures = parseBooleanParam(searchParams.get('needs_signatures'))
    const includeArchived = searchParams.get('include_archived') === 'true'

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

    // Fetch saved filter and apply its filter_config to job search (required_ids + optional flat params)
    let applied_filter: { id: string; name: string; filter_config: Record<string, unknown> } | null = null
    let requiredJobIds: string[] | null = null
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
        const filterGroup = normalizeFilterConfig(savedFilter.filter_config as Record<string, unknown>)
        if (filterGroup) {
          const ids = await getMatchingJobIdsFromFilterGroup(
            searchClient as unknown as SupabaseClientLike,
            organizationId,
            filterGroup,
            includeArchived
          )
          requiredJobIds = ids // empty array = saved filter matched no jobs; we still apply it so count is 0
        }
      }
    }

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

    const useJobFilters =
      requiredJobIds !== null ||
      hasPhotos !== null ||
      hasSignatures !== null ||
      needsSignatures !== null ||
      includeArchived

    if (q || useJobFilters) {
      if (type === 'jobs' || type === 'all') {
        if (useJobFilters) {
          if (q) {
            // Apply saved filter (required_ids) and boolean params via get_jobs_ranked so data and count stay in sync
            const rankedRes = await searchClient.rpc('get_jobs_ranked', {
              p_org_id: organizationId,
              p_query: q,
              p_limit: limit,
              p_offset: 0,
              p_include_archived: includeArchived,
              p_sort_column: null,
              p_sort_order: 'desc',
              p_status: null,
              p_risk_level: null,
              p_assigned_to_id: null,
              p_risk_score_min: null,
              p_risk_score_max: null,
              p_job_type: null,
              p_client_ilike: null,
              p_required_ids: requiredJobIds,
              p_excluded_ids: null,
              p_overdue: null,
              p_unassigned: null,
              p_recent_days: null,
              p_has_photos: hasPhotos ?? null,
              p_has_signatures: hasSignatures ?? null,
              p_needs_signatures: needsSignatures ?? null,
            })
            if (rankedRes.error) throw rankedRes.error
            const jobRows = (rankedRes.data || []) as Array<{
              id: string
              title: string | null
              client_name: string | null
              job_type: string | null
              location: string | null
              total_count?: number
              score?: number
              highlight?: string | null
            }>
            jobCount = Number(jobRows[0]?.total_count ?? 0) || 0
            if (type === 'jobs') total = jobCount
            for (const row of jobRows) {
              if (row.id == null) continue
              results.push({
                type: 'job',
                id: row.id,
                title: (row.title || row.client_name || 'Untitled Job').trim() || 'Untitled Job',
                subtitle: [row.job_type, row.location].filter(Boolean).join(' • '),
                highlight: row.highlight ?? '',
                score: Number(row.score) || 0,
              })
            }
          } else {
            // Filters present but no query: use get_jobs_list with same filter params for filtered results and count
            const listRes = await searchClient.rpc('get_jobs_list', {
              p_org_id: organizationId,
              p_limit: limit,
              p_offset: 0,
              p_include_archived: includeArchived,
              p_sort_column: 'created_at',
              p_sort_order: 'desc',
              p_status: null,
              p_risk_level: null,
              p_assigned_to_id: null,
              p_risk_score_min: null,
              p_risk_score_max: null,
              p_job_type: null,
              p_client_ilike: null,
              p_required_ids: requiredJobIds,
              p_excluded_ids: null,
              p_overdue: null,
              p_unassigned: null,
              p_recent_days: null,
              p_has_photos: hasPhotos ?? null,
              p_has_signatures: hasSignatures ?? null,
              p_needs_signatures: needsSignatures ?? null,
            })
            if (listRes.error) throw listRes.error
            const jobRows = (listRes.data || []) as Array<{
              id: string
              title: string | null
              client_name: string | null
              job_type: string | null
              location: string | null
              total_count?: number
            }>
            jobCount = Number(jobRows[0]?.total_count ?? 0) || 0
            if (type === 'jobs') total = jobCount
            else if (type === 'all') total = jobCount
            for (const row of jobRows) {
              if (row.id == null) continue
              results.push({
                type: 'job',
                id: row.id,
                title: (row.title || row.client_name || 'Untitled Job').trim() || 'Untitled Job',
                subtitle: [row.job_type, row.location].filter(Boolean).join(' • '),
                highlight: '',
                score: 0,
              })
            }
          }
        } else if (q) {
          const [{ data: jobRows, error: jobSearchError }, { data: jobCountData, error: jobCountError }] = await Promise.all([
            searchClient.rpc('search_jobs', {
              p_org_id: organizationId,
              p_query: q,
              p_limit: limit,
              p_include_archived: includeArchived,
            }),
            searchClient.rpc('search_jobs_count', {
              p_org_id: organizationId,
              p_query: q,
              p_include_archived: includeArchived,
            }),
          ])

          if (jobSearchError) throw jobSearchError
          if (jobCountError) throw jobCountError

          jobCount = Number(jobCountData ?? 0) || 0
          if (type === 'jobs') total = jobCount

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
      }

      if ((type === 'hazards' || type === 'all') && q) {
        const [{ data: hazardRows, error: hazardSearchError }, { data: hazardCountData, error: hazardCountError }] = await Promise.all([
          searchClient.rpc('search_hazards', {
            p_org_id: organizationId,
            p_query: q,
            p_limit: limit,
            p_include_archived: includeArchived,
          }),
          searchClient.rpc('search_hazards_count', {
            p_org_id: organizationId,
            p_query: q,
            p_include_archived: includeArchived,
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

      if ((type === 'clients' || type === 'all') && q) {
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
      let jobsSuggestQuery = searchClient
        .from('jobs')
        .select('client_name')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
      if (!includeArchived) jobsSuggestQuery = jobsSuggestQuery.is('archived_at', null)
      const { data: suggestionRows } = await jobsSuggestQuery
        .ilike('client_name', `%${qRaw}%`)
        .limit(10)

      for (const row of suggestionRows || []) {
        const value = row.client_name?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      let clientsSuggestQuery = searchClient
        .from('clients')
        .select('name')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
      if (!includeArchived) clientsSuggestQuery = clientsSuggestQuery.is('archived_at', null)
      const { data: clientNameRows } = await clientsSuggestQuery
        .ilike('name', `%${qRaw}%`)
        .limit(10)

      for (const row of clientNameRows || []) {
        const value = row.name?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      let locationSuggestQuery = searchClient
        .from('jobs')
        .select('location')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
      if (!includeArchived) locationSuggestQuery = locationSuggestQuery.is('archived_at', null)
      const { data: locationRows } = await locationSuggestQuery
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
      let clientRowsQuery = searchClient
        .from('jobs')
        .select('client_name')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
      if (!includeArchived) clientRowsQuery = clientRowsQuery.is('archived_at', null)
      const { data: clientRows } = await clientRowsQuery
        .not('client_name', 'is', null)
        .limit(50)

      for (const row of clientRows || []) {
        const value = row.client_name?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      let clientsTableQuery = searchClient
        .from('clients')
        .select('name')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
      if (!includeArchived) clientsTableQuery = clientsTableQuery.is('archived_at', null)
      const { data: clientsTableRows } = await clientsTableQuery.limit(50)

      for (const row of clientsTableRows || []) {
        const value = row.name?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      let jobTypeRowsQuery = searchClient
        .from('jobs')
        .select('job_type')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
      if (!includeArchived) jobTypeRowsQuery = jobTypeRowsQuery.is('archived_at', null)
      const { data: jobTypeRows } = await jobTypeRowsQuery
        .not('job_type', 'is', null)
        .limit(50)

      for (const row of jobTypeRows || []) {
        const value = row.job_type?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      let locationRowsQuery = searchClient
        .from('jobs')
        .select('location')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
      if (!includeArchived) locationRowsQuery = locationRowsQuery.is('archived_at', null)
      const { data: locationRows } = await locationRowsQuery
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
