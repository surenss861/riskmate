import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { calculateRiskScore, generateMitigationItems } from '@/lib/utils/riskScoring'
import { getOrgEntitlements } from '@/lib/entitlements'
import { logFeatureUsage } from '@/lib/featureLogging'
import { getRequestId } from '@/lib/featureEvents'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'

export const runtime = 'nodejs'

const ROUTE_JOBS = '/api/jobs'

type FilterCondition = {
  field?: string
  operator?: string
  value?: unknown
}

type FilterGroup = {
  operator?: string
  conditions?: Array<FilterCondition | FilterGroup>
}

const SORT_ALLOWLIST = new Set([
  'created_at',
  'updated_at',
  'risk_score',
  'end_date',
  'due_date', // URL state alias, mapped to end_date
  'client_name',
])

const FILTER_FIELD_ALLOWLIST = new Set([
  'status',
  'risk_level',
  'risk_score',
  'job_type',
  'client_name',
  'location',
  'assigned_to',
  'assigned_to_id',
  'end_date',
  'due_date',
  'created_at',
  'has_photos',
  'has_signatures',
  'needs_signatures',
])

function parseBooleanParam(value: string | null): boolean | null {
  if (value === null) return null
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function parseNumberParam(value: string | null): number | null {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeFilterConfig(raw: string | null): FilterGroup | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as FilterGroup
  } catch {
    return null
  }
}

function collectAndConditions(group: FilterGroup): FilterCondition[] {
  const operator = (group.operator || 'AND').toUpperCase()
  if (operator !== 'AND' || !Array.isArray(group.conditions)) return []

  const collected: FilterCondition[] = []
  for (const condition of group.conditions) {
    if (!condition || typeof condition !== 'object') continue
    if ('conditions' in condition) {
      const nested = collectAndConditions(condition as FilterGroup)
      for (const item of nested) {
        collected.push(item)
      }
      continue
    }
    collected.push(condition as FilterCondition)
  }
  return collected
}

function isFilterGroup(c: FilterCondition | FilterGroup): c is FilterGroup {
  return c != null && typeof c === 'object' && 'conditions' in c && Array.isArray((c as FilterGroup).conditions)
}

async function getJobIdsForBooleanFilter(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organization_id: string,
  includeArchived: boolean,
  field: 'has_photos' | 'has_signatures' | 'needs_signatures',
  value: boolean
): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_job_ids_for_boolean_filter', {
    p_org_id: organization_id,
    p_include_archived: includeArchived,
    p_field: field,
    p_value: value,
  })
  if (error) throw error
  return (data || []).filter(Boolean).map((id) => String(id))
}

async function getMatchingJobIdsFromFilterGroup(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organization_id: string,
  group: FilterGroup,
  includeArchived: boolean
): Promise<string[]> {
  const operator = (group.operator || 'AND').toUpperCase()
  const conditions = Array.isArray(group.conditions) ? group.conditions : []
  if (conditions.length === 0) return []

  const baseQuery = () => {
    let q = supabase
      .from('jobs')
      .select('id')
      .eq('organization_id', organization_id)
      .is('deleted_at', null)
    if (!includeArchived) {
      q = q.is('archived_at', null)
    }
    return q
  }

  const getIdsForCondition = async (condition: FilterCondition | FilterGroup): Promise<string[]> => {
    if (isFilterGroup(condition)) {
      return getMatchingJobIdsFromFilterGroup(supabase, organization_id, condition, includeArchived)
    }
    const c = condition as FilterCondition
    const field = typeof c.field === 'string' ? c.field : ''
    const op = typeof c.operator === 'string' ? c.operator.toLowerCase() : ''
    const value = c.value
    if (
      (field === 'has_photos' || field === 'has_signatures' || field === 'needs_signatures') &&
      op === 'eq' &&
      (value === true || value === false)
    ) {
      return getJobIdsForBooleanFilter(
        supabase,
        organization_id,
        includeArchived,
        field as 'has_photos' | 'has_signatures' | 'needs_signatures',
        value
      )
    }
    let q = baseQuery()
    q = applySingleFilter(q, c)
    const { data, error } = await q
    if (error) throw error
    return (data || []).map((row: { id: string }) => row.id).filter(Boolean)
  }

  if (operator === 'OR') {
    const idSets = await Promise.all(conditions.map(getIdsForCondition))
    const union = new Set<string>()
    for (const ids of idSets) {
      for (const id of ids) union.add(id)
    }
    return Array.from(union)
  }

  // AND: apply all conditions (and nested groups via ID filter)
  let q = baseQuery()
  for (const condition of conditions) {
    if (isFilterGroup(condition)) {
      const nestedIds = await getMatchingJobIdsFromFilterGroup(supabase, organization_id, condition, includeArchived)
      if (nestedIds.length === 0) return []
      q = q.in('id', nestedIds)
    } else {
      const c = condition as FilterCondition
      const field = typeof c.field === 'string' ? c.field : ''
      const op = typeof c.operator === 'string' ? c.operator.toLowerCase() : ''
      const value = c.value
      if (
        (field === 'has_photos' || field === 'has_signatures' || field === 'needs_signatures') &&
        op === 'eq' &&
        (value === true || value === false)
      ) {
        const ids = await getJobIdsForBooleanFilter(
          supabase,
          organization_id,
          includeArchived,
          field as 'has_photos' | 'has_signatures' | 'needs_signatures',
          value
        )
        if (ids.length === 0) return []
        q = q.in('id', ids)
      } else {
        q = applySingleFilter(q, c)
      }
    }
  }
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((row: { id: string }) => row.id).filter(Boolean)
}

function applySingleFilter(query: any, condition: FilterCondition): any {
  const rawField = typeof condition.field === 'string' ? condition.field : ''
  // Normalize: due_date -> end_date; assigned_to -> assigned_to_id
  const field =
    rawField === 'due_date'
      ? 'end_date'
      : rawField === 'assigned_to'
      ? 'assigned_to_id'
      : rawField
  const operator = typeof condition.operator === 'string' ? condition.operator.toLowerCase() : ''
  const value = condition.value

  if (!FILTER_FIELD_ALLOWLIST.has(rawField) || value === undefined || value === null) {
    return query
  }

  // Derived boolean fields are handled in getMatchingJobIdsFromFilterGroup via subqueries
  if (field === 'has_photos' || field === 'has_signatures' || field === 'needs_signatures') {
    return query
  }

  if (operator === 'eq') return query.eq(field, value)
  if (operator === 'gte') return query.gte(field, value)
  if (operator === 'lte') return query.lte(field, value)
  if (operator === 'gt') return query.gt(field, value)
  if (operator === 'lt') return query.lt(field, value)
  if (operator === 'between' && Array.isArray(value) && value.length >= 2) {
    return query.gte(field, value[0]).lte(field, value[1])
  }
  if (operator === 'ilike' && typeof value === 'string') return query.ilike(field, `%${value}%`)
  if (operator === 'in' && Array.isArray(value)) return query.in(field, value)

  return query
}

function intersectIds(currentIds: string[] | null, nextIds: string[]): string[] {
  if (currentIds === null) return nextIds
  const nextSet = new Set(nextIds)
  return currentIds.filter((id) => nextSet.has(id))
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || getRequestId()

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to access jobs',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Get user's organization_id
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
        category: 'internal', severity: 'error', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const organization_id = userData.organization_id
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const parsedLimit = parseInt(searchParams.get('limit') || '20', 10)
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      const { response, errorId } = createErrorResponse(
        'Invalid limit: must be a number between 1 and 100',
        'INVALID_FORMAT',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'INVALID_FORMAT', errorId, requestId, organization_id, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const limit = parsedLimit
    const status = searchParams.get('status')
    const risk_level = searchParams.get('risk_level')
    const include_archived = searchParams.get('include_archived') === 'true'
    const q = (searchParams.get('q') || '').trim()
    const assignedToParam = searchParams.get('assigned_to') || searchParams.get('assigned')
    const riskScoreMin = parseNumberParam(searchParams.get('risk_score_min'))
    const riskScoreMax = parseNumberParam(searchParams.get('risk_score_max'))
    const hasPhotos = parseBooleanParam(searchParams.get('has_photos'))
    const hasSignatures = parseBooleanParam(searchParams.get('has_signatures'))
    const overdue = parseBooleanParam(searchParams.get('overdue'))
    const needsSignatures = parseBooleanParam(searchParams.get('needs_signatures'))
    const unassigned = parseBooleanParam(searchParams.get('unassigned'))
    const recent = parseBooleanParam(searchParams.get('recent'))
    const jobType = searchParams.get('job_type')
    const client = searchParams.get('client')
    const sort = searchParams.get('sort')
    const order = (searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
    const filterConfigRaw = searchParams.get('filter_config')
    const filterConfig = normalizeFilterConfig(filterConfigRaw)

    if (filterConfigRaw && !filterConfig) {
      const { response, errorId } = createErrorResponse(
        'Invalid filter_config. Expected a valid JSON object.',
        'INVALID_FORMAT',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'INVALID_FORMAT', errorId, requestId, organization_id, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const assigned_to =
      assignedToParam === 'me'
        ? user.id
        : assignedToParam && assignedToParam.trim()
        ? assignedToParam.trim()
        : null

    const offset = (page - 1) * limit
    const MAX_OFFSET = 10000
    if (offset > MAX_OFFSET || offset < 0 || !Number.isFinite(page) || page < 1) {
      const { response, errorId } = createErrorResponse(
        'Invalid page or offset: page must be >= 1 and resulting offset must not exceed 10000',
        'INVALID_FORMAT',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'INVALID_FORMAT', errorId, requestId, organization_id, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    let requiredJobIds: string[] | null = null
    const excludedJobIds = new Set<string>()

    // Boolean filters (has_photos, has_signatures, needs_signatures) are pushed into the main
    // query via EXISTS/NOT EXISTS in get_jobs_list and get_jobs_ranked RPCs - no separate scans.

    if (filterConfig) {
      const filterConfigJobIds = await getMatchingJobIdsFromFilterGroup(
        supabase,
        organization_id,
        filterConfig,
        include_archived
      )
      requiredJobIds = intersectIds(requiredJobIds, filterConfigJobIds)
      if (requiredJobIds !== null && requiredJobIds.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
      }
    }

    const sortColumn =
      sort && SORT_ALLOWLIST.has(sort)
        ? (sort === 'due_date' ? 'end_date' : sort)
        : 'created_at'

    const rpcBaseParams: Record<string, unknown> = {
      p_org_id: organization_id,
      p_limit: limit,
      p_offset: offset,
      p_include_archived: include_archived,
      p_sort_column: sortColumn,
      p_sort_order: order,
      p_status: status || null,
      p_risk_level: risk_level || null,
      p_assigned_to_id: assigned_to || null,
      p_risk_score_min: riskScoreMin,
      p_risk_score_max: riskScoreMax,
      p_job_type: jobType || null,
      p_client_ilike: client ? `%${client}%` : null,
      p_required_ids: requiredJobIds?.length ? requiredJobIds : null,
      p_excluded_ids: excludedJobIds.size ? Array.from(excludedJobIds) : null,
      p_overdue: overdue === true ? true : null,
      p_unassigned: unassigned === true ? true : null,
      p_recent_days: recent === true ? 7 : null,
      p_has_photos: hasPhotos ?? null,
      p_has_signatures: hasSignatures ?? null,
      p_needs_signatures: needsSignatures ?? null,
    }

    let jobs: Array<Record<string, unknown>> = []
    let totalCount = 0

    if (q) {
      const rankedRes = await supabase.rpc('get_jobs_ranked', {
        ...rpcBaseParams,
        p_query: q,
      })
      if (rankedRes.error) throw rankedRes.error
      const rows = (rankedRes.data || []) as Array<Record<string, unknown>>
      totalCount = (rows[0]?.total_count as number) ?? 0
      jobs = rows.map(({ total_count: _tc, ...rest }) => rest)
    } else {
      const listRes = await supabase.rpc('get_jobs_list', rpcBaseParams)
      if (listRes.error) throw listRes.error
      const rows = (listRes.data || []) as Array<Record<string, unknown>>
      totalCount = (rows[0]?.total_count as number) ?? 0
      jobs = rows.map(({ total_count: _tc, ...rest }) => rest)
    }

    return NextResponse.json({
      data: jobs,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error: any) {
    console.error('Jobs fetch failed:', error)
    const requestId = request.headers.get('x-request-id') || getRequestId()
    const { response, errorId } = createErrorResponse(
      'Failed to fetch jobs',
      'QUERY_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
      }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal', severity: 'error', route: ROUTE_JOBS,
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
        'Unauthorized: Please log in to create jobs',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Get user's organization_id
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
        category: 'internal', severity: 'error', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const organization_id = userData.organization_id
    const userId = user.id
    const body = await request.json()

    const {
      client_name,
      client_type,
      job_type,
      location,
      description,
      start_date,
      end_date,
      risk_factor_codes = [],
      has_subcontractors = false,
      subcontractor_count = 0,
      insurance_status = 'pending',
      applied_template_id,
      applied_template_type,
    } = body

    // Preflight validation: Required fields
    if (!client_name || !client_type || !job_type || !location) {
      const { response, errorId } = createErrorResponse(
        'Missing required fields: client_name, client_type, job_type, location',
        'MISSING_REQUIRED_FIELD',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'MISSING_REQUIRED_FIELD', errorId, requestId, organization_id, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Preflight validation: Verify user has permission to create jobs
    // Check if user is an active member with appropriate role
    const { data: membership, error: membershipError } = await supabase
      .from('users')
      .select('role, archived_at')
      .eq('id', userId)
      .eq('organization_id', organization_id)
      .is('archived_at', null)
      .single()

    if (membershipError || !membership) {
      const { response, errorId } = createErrorResponse(
        'Permission denied: You are not an active member of this organization.',
        'AUTH_ROLE_FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      logApiError(403, 'AUTH_ROLE_FORBIDDEN', errorId, requestId, organization_id, response.message, {
        category: 'auth', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Preflight validation: Normalize enum values (lowercase)
    const normalizedClientType = client_type?.toLowerCase().trim()
    const normalizedJobType = job_type?.toLowerCase().trim()
    const normalizedInsuranceStatus = insurance_status?.toLowerCase().trim()

    // Validate enum values (match UI options)
    const validClientTypes = ['residential', 'commercial', 'industrial', 'government', 'mixed']
    const validJobTypes = ['repair', 'maintenance', 'installation', 'inspection', 'renovation', 'new_construction', 'remodel', 'other']
    const validInsuranceStatuses = ['pending', 'approved', 'rejected', 'not_required']

    if (!validClientTypes.includes(normalizedClientType)) {
      const { response, errorId } = createErrorResponse(
        `Invalid client_type: "${client_type}". Must be one of: ${validClientTypes.join(', ')}`,
        'INVALID_FORMAT',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'INVALID_FORMAT', errorId, requestId, organization_id, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (!validJobTypes.includes(normalizedJobType)) {
      const { response, errorId } = createErrorResponse(
        `Invalid job_type: "${job_type}". Must be one of: ${validJobTypes.join(', ')}`,
        'INVALID_FORMAT',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'INVALID_FORMAT', errorId, requestId, organization_id, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (!validInsuranceStatuses.includes(normalizedInsuranceStatus)) {
      const { response, errorId } = createErrorResponse(
        `Invalid insurance_status: "${insurance_status}". Must be one of: ${validInsuranceStatuses.join(', ')}`,
        'INVALID_FORMAT',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'INVALID_FORMAT', errorId, requestId, organization_id, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Preflight validation: Validate template reference if provided
    if (applied_template_id) {
      if (!applied_template_type || !['job', 'hazard'].includes(applied_template_type)) {
        const { response, errorId } = createErrorResponse(
          'If applied_template_id is provided, applied_template_type must be "job" or "hazard"',
          'INVALID_FORMAT',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'INVALID_FORMAT', errorId, requestId, organization_id, response.message, {
          category: 'validation', severity: 'warn', route: ROUTE_JOBS,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }

      // Verify template exists and belongs to organization
      const templateTable = applied_template_type === 'job' ? 'job_templates' : 'hazard_templates'
      const { data: template, error: templateError } = await supabase
        .from(templateTable)
        .select('id, organization_id')
        .eq('id', applied_template_id)
        .eq('organization_id', organization_id)
        .single()

      if (templateError || !template) {
        const { response, errorId } = createErrorResponse(
          'Template not found or does not belong to your organization.',
          'NOT_FOUND',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'NOT_FOUND', errorId, requestId, organization_id, response.message, {
          category: 'validation', severity: 'warn', route: ROUTE_JOBS,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
    }

    // Preflight validation: Validate subcontractor count
    if (has_subcontractors && (subcontractor_count === undefined || subcontractor_count < 0)) {
      const { response, errorId } = createErrorResponse(
        'If has_subcontractors is true, subcontractor_count must be a non-negative number',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'VALIDATION_ERROR', errorId, requestId, organization_id, response.message, {
        category: 'validation', severity: 'warn', route: ROUTE_JOBS,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Get entitlements ONCE at request start (request-scoped snapshot)
    const entitlements = await getOrgEntitlements(organization_id)

    // Check job creation limit
    if (entitlements.jobs_monthly_limit !== null) {
      // Get period start from subscription or default to current month
      const periodStart = entitlements.period_end
        ? new Date(new Date(entitlements.period_end).getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days before period end
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1)

      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .gte('created_at', periodStart.toISOString())

      if ((count || 0) >= entitlements.jobs_monthly_limit) {
        // Log denied attempt with standardized schema
        await logFeatureUsage({
          feature: 'job_creation',
          action: 'limit_denied',
          allowed: false,
          organizationId: organization_id,
          actorId: userId,
          entitlements, // Pass snapshot (no re-fetch)
          source: 'api',
          requestId,
          denialCode: 'MONTHLY_LIMIT_REACHED',
          reason: `Job limit reached (${entitlements.jobs_monthly_limit} jobs/month on ${entitlements.tier} plan)`,
          additionalMetadata: {
            current_count: count || 0,
            limit: entitlements.jobs_monthly_limit,
          },
          logUsage: false,
        })

        const { response, errorId } = createErrorResponse(
          `${entitlements.tier === 'starter' ? 'Starter' : 'Plan'} limit reached (${entitlements.jobs_monthly_limit} jobs/month). Upgrade to Pro for unlimited jobs.`,
          'ENTITLEMENTS_JOB_LIMIT_REACHED',
          {
            requestId,
            statusCode: 403,
            details: {
              code: 'JOB_LIMIT',
              denial_code: 'MONTHLY_LIMIT_REACHED',
              current_count: count || 0,
              limit: entitlements.jobs_monthly_limit,
            },
          }
        )
        logApiError(403, 'ENTITLEMENTS_JOB_LIMIT_REACHED', errorId, requestId, organization_id, response.message, {
          category: 'entitlements', severity: 'warn', route: ROUTE_JOBS,
        })
        return NextResponse.json(response, {
          status: 403,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
    }

    // Allowlist of valid jobs table columns (prevent PGRST204 from unknown columns)
    // NOTE: Only include columns that actually exist in the jobs table
    const validJobColumns = new Set([
      'organization_id',
      'created_by',
      'client_name',
      'client_type',
      'job_type',
      'location',
      'description',
      'start_date',
      'end_date',
      'status',
      'has_subcontractors',
      'subcontractor_count',
      'insurance_status',
      // Removed: 'applied_template_id', 'applied_template_type' - these columns don't exist in the jobs table
      // Removed: 'site_id', 'site_name' - check if these exist before including
    ])

    // Build job row with only valid columns
    const jobRow: Record<string, any> = {
      organization_id,
      created_by: userId,
      client_name: client_name.trim(),
      client_type: normalizedClientType,
      job_type: normalizedJobType,
      location: location.trim(),
      description: description?.trim() || null,
      start_date: start_date || null,
      end_date: end_date || null,
      status: 'draft',
      has_subcontractors,
      subcontractor_count: has_subcontractors ? (subcontractor_count || 0) : 0,
      insurance_status: normalizedInsuranceStatus,
      // Note: applied_template_id and applied_template_type are not included because
      // these columns don't exist in the jobs table schema
      // Template tracking should be handled separately if needed
    }

    // Filter to only valid columns (strip any extra fields from request body)
    const filteredJobRow = Object.fromEntries(
      Object.entries(jobRow).filter(([key]) => validJobColumns.has(key))
    )

    // Log payload keys for debugging (helps identify bad columns)
    console.log('[jobs] insert keys:', Object.keys(filteredJobRow))
    console.log('[jobs] request body keys:', Object.keys(body))

    // Create job (using filtered, normalized values)
    // Use .maybeSingle() instead of .single() to handle RLS blocking gracefully
    // Select only 'id' to minimize chance of schema cache issues
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert(filteredJobRow)
      .select('id')
      .maybeSingle()

    if (jobError) {
      console.error('Job creation failed:', JSON.stringify(jobError, null, 2))
      console.error('Job error details:', {
        message: jobError.message,
        code: jobError.code,
        details: jobError.details,
        hint: jobError.hint,
      })
      
      // Return specific error messages based on error type
      let errorMessage = 'Failed to create job'
      let statusCode = 500
      
      // PGRST204 = Column doesn't exist (schema cache issue)
      if (jobError.code === 'PGRST204') {
        // Check if it's a schema cache error (message mentions "schema cache")
        if (jobError.message?.includes('schema cache') || jobError.details?.includes('schema cache')) {
          errorMessage = `PostgREST schema cache error: ${jobError.message || jobError.details || 'Column may not exist or schema cache is stale'}. Try reloading the schema cache or check if the column exists in the database.`
          statusCode = 400
        } else if (jobError.details?.includes('column') || jobError.hint?.includes('column')) {
          // Column name issue
          errorMessage = `Invalid column in request: ${jobError.message || jobError.details || 'Unknown column'}. Please check the request payload.`
          statusCode = 400
        } else {
          // Generic PGRST204
          errorMessage = `Database schema error: ${jobError.message || jobError.details || 'Unknown schema issue'}. Check that all columns exist.`
          statusCode = 400
        }
      }
      // PGRST116 = No rows returned (could be RLS blocking SELECT after INSERT)
      else if (jobError.code === 'PGRST116') {
        errorMessage = 'Permission denied: Job was created but cannot be retrieved. Row-level security policy may be blocking access. Check your team role and RLS policies.'
        statusCode = 403
      }
      // RLS policy violation / recursion
      else if (jobError.message?.includes('row-level security') || jobError.message?.includes('RLS') || jobError.message?.includes('infinite recursion') || jobError.code === '42501' || jobError.code === '42P17') {
        errorMessage = jobError.message?.includes('infinite recursion')
          ? 'Database policy recursion detected. This indicates a configuration issue with row-level security policies.'
          : 'Permission denied: You may not have permission to create jobs. Check your team role.'
        statusCode = jobError.message?.includes('infinite recursion') ? 500 : 403
      }
      // Foreign key constraint violation
      else if (jobError.message?.includes('foreign key') || jobError.code === '23503') {
        errorMessage = 'Invalid reference: One of the selected values (template, organization, etc.) is invalid.'
        statusCode = 400
      }
      // Not null constraint violation
      else if (jobError.message?.includes('null value') || jobError.code === '23502') {
        const fieldMatch = jobError.message?.match(/column "(\w+)"/)
        const field = fieldMatch ? fieldMatch[1] : 'required field'
        errorMessage = `Missing required field: ${field}`
        statusCode = 400
      }
      // Enum/invalid value
      else if (jobError.message?.includes('invalid input') || jobError.code === '22P02') {
        errorMessage = 'Invalid value: One of the field values is not allowed. Check job type, client type, or status.'
        statusCode = 400
      }
      // Unique constraint violation
      else if (jobError.code === '23505') {
        errorMessage = 'Duplicate entry: A job with these details already exists.'
        statusCode = 409
      }
      // Always include actual error details in response for debugging
      else {
        errorMessage = jobError.message || 'Failed to create job'
      }

      const errorCode =
        statusCode === 500 && errorMessage.includes('recursion')
          ? 'RLS_RECURSION_ERROR'
          : statusCode === 403
          ? 'AUTH_ROLE_FORBIDDEN'
          : statusCode === 400 && errorMessage.includes('required')
          ? 'MISSING_REQUIRED_FIELD'
          : statusCode === 400 || statusCode === 409
          ? 'VALIDATION_ERROR'
          : 'QUERY_ERROR'

      const { response, errorId } = createErrorResponse(errorMessage, errorCode, {
        requestId,
        statusCode,
        details: {
          databaseError: {
            code: jobError.code,
            hint: jobError.hint,
            ...(process.env.NODE_ENV === 'development' && { raw: jobError.details }),
          },
        },
      })
      logApiError(statusCode, errorCode, errorId, requestId, organization_id, response.message, {
        category: statusCode >= 500 ? 'internal' : statusCode === 403 ? 'auth' : 'validation',
        severity: statusCode >= 500 ? 'error' : 'warn',
        route: ROUTE_JOBS,
        details: { databaseError: { code: jobError.code, message: jobError.message } },
      })
      return NextResponse.json(response, {
        status: statusCode,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Handle case where insert succeeded but SELECT was blocked by RLS (no error, but no data)
    if (!job && !jobError) {
      console.warn('Job insert may have succeeded but could not be retrieved (likely RLS blocking SELECT)')
      // Return success but warn that we couldn't fetch the created job
      return NextResponse.json(
        { 
          message: 'Job created successfully, but could not retrieve it. This may be due to row-level security policies.',
          code: 'CREATED_BUT_UNREADABLE',
          warning: 'Job may have been created but is not immediately accessible. Check the jobs list to verify.'
        },
        { status: 201 }
      )
    }

    // If we have no job ID, we can't proceed (should have been handled above)
    if (!job?.id) {
      // This case should have been handled by the checks above, but safety check
      console.error('Job insert returned no ID - cannot proceed')
      return NextResponse.json(
        { message: 'Job creation may have failed. Please check the jobs list to verify.' },
        { status: 500 }
      )
    }

    // At this point, TypeScript knows job.id exists
    const jobId = job.id

    // Upsert client into clients table for search
    if (client_name?.trim()) {
      await supabase.rpc('upsert_client', {
        p_org_id: organization_id,
        p_name: client_name.trim(),
      })
    }

    // Log successful job creation with standardized schema
    await logFeatureUsage({
      feature: 'job_creation',
      action: 'created',
      allowed: true,
      organizationId: organization_id,
      actorId: userId,
      entitlements, // Pass snapshot (no re-fetch)
      source: 'api',
      requestId,
      resourceType: 'job',
      resourceId: jobId,
      additionalMetadata: {
        job_id: jobId,
        client_name,
        job_type,
        location,
        risk_factors_count: risk_factor_codes?.length || 0,
      },
      logUsage: true,
    })

    // Calculate risk score if risk factors provided
    let riskScoreResult = null
    if (risk_factor_codes && risk_factor_codes.length > 0) {
      try {
        riskScoreResult = await calculateRiskScore(risk_factor_codes)

        // Save risk score
        await supabase.from('job_risk_scores').insert({
          job_id: jobId,
          overall_score: riskScoreResult.overall_score,
          risk_level: riskScoreResult.risk_level,
          factors: riskScoreResult.factors,
        })

        // Update job with risk score
        await supabase
          .from('jobs')
          .update({
            risk_score: riskScoreResult.overall_score,
            risk_level: riskScoreResult.risk_level,
          })
          .eq('id', jobId)

        // Generate mitigation items
        await generateMitigationItems(jobId, risk_factor_codes)
      } catch (riskError: any) {
        console.error('Risk scoring failed:', riskError)
        // Continue without risk score - job is still created
      }
    }

    // Fetch complete job with risk details (use maybeSingle in case RLS blocks)
    const { data: completeJob } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle()
    
    // If we can't fetch the complete job, return what we have
    if (!completeJob) {
      console.warn('Could not fetch complete job details after creation (RLS may be blocking)')
      return NextResponse.json(
        {
          data: {
            id: jobId,
            message: 'Job created but full details are not immediately accessible. Check the jobs list.',
          },
        },
        { status: 201 }
      )
    }

    const { data: mitigationItems } = await supabase
      .from('mitigation_items')
      .select('id, title, description, done, is_completed')
      .eq('job_id', jobId)

    return NextResponse.json(
      {
        data: {
          ...completeJob,
          risk_score_detail: riskScoreResult,
          mitigation_items: mitigationItems || [],
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Job creation error:', error)
    const { response, errorId } = createErrorResponse(
      error.message || 'Failed to create job',
      'QUERY_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
      }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal', severity: 'error', route: ROUTE_JOBS,
      details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}
