import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRequestId } from '@/lib/featureEvents'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'

export const runtime = 'nodejs'

const ROUTE = '/api/search'

type SearchType = 'jobs' | 'hazards' | 'all'

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || getRequestId()

  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const type = (searchParams.get('type') || 'all') as SearchType
    const parsedLimit = parseInt(searchParams.get('limit') || '20', 10)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20

    if (!['jobs', 'hazards', 'all'].includes(type)) {
      const { response, errorId } = createErrorResponse(
        'Invalid search type. Must be one of: jobs, hazards, all',
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

    const organizationId = userData.organization_id
    const results: Array<{
      type: 'job' | 'hazard'
      id: string
      title: string
      subtitle: string
      highlight: string
      score: number
    }> = []

    let total = 0
    let jobCount = 0
    let hazardCount = 0

    if (q) {
      if (type === 'jobs' || type === 'all') {
        const [{ data: jobRows, error: jobSearchError }, { data: jobCountData, error: jobCountError }] = await Promise.all([
          supabase.rpc('search_jobs', {
            p_org_id: organizationId,
            p_query: q,
            p_limit: limit,
          }),
          supabase.rpc('search_jobs_count', {
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
          supabase.rpc('search_hazards', {
            p_org_id: organizationId,
            p_query: q,
            p_limit: limit,
          }),
          supabase.rpc('search_hazards_count', {
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

      results.sort((a, b) => b.score - a.score)
    }

    const seenSuggestions = new Set<string>()
    const suggestions: string[] = []

    if (q) {
      const { data: suggestionRows } = await supabase
        .from('jobs')
        .select('client_name')
        .eq('organization_id', organizationId)
        .ilike('client_name', `%${q}%`)
        .limit(10)

      for (const row of suggestionRows || []) {
        const value = row.client_name?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }
    } else {
      const { data: clientRows } = await supabase
        .from('jobs')
        .select('client_name')
        .eq('organization_id', organizationId)
        .not('client_name', 'is', null)
        .limit(50)

      for (const row of clientRows || []) {
        const value = row.client_name?.trim()
        if (value && !seenSuggestions.has(value.toLowerCase())) {
          seenSuggestions.add(value.toLowerCase())
          suggestions.push(value)
        }
      }

      const { data: jobTypeRows } = await supabase
        .from('jobs')
        .select('job_type')
        .eq('organization_id', organizationId)
        .not('job_type', 'is', null)
        .limit(50)

      for (const row of jobTypeRows || []) {
        const value = row.job_type?.trim()
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
