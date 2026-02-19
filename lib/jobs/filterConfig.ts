/**
 * Shared filter config types and helpers for applying saved_filters.filter_config
 * to job list and search (get_jobs_list, get_jobs_ranked).
 */

export type FilterCondition = {
  field?: string
  operator?: string
  value?: unknown
}

export type FilterGroup = {
  operator?: string
  conditions?: Array<FilterCondition | FilterGroup>
}

export const FILTER_FIELD_ALLOWLIST = new Set([
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

/** Chain type for Supabase query builder used in filter helpers. */
interface QueryBuilderLike {
  eq(col: string, val: unknown): QueryBuilderLike
  is(col: string, val: unknown): QueryBuilderLike
  in(col: string, val: string[]): QueryBuilderLike
  gte(col: string, val: unknown): QueryBuilderLike
  lte(col: string, val: unknown): QueryBuilderLike
  gt(col: string, val: unknown): QueryBuilderLike
  lt(col: string, val: unknown): QueryBuilderLike
  ilike(col: string, val: string): QueryBuilderLike
  then<T>(onfulfilled?: (value: { data: { id: string }[] | null; error: unknown }) => T): Promise<T>
}

/** Minimal Supabase-like client for filter helpers. Cast real Supabase client to this when calling. */
export type SupabaseClientLike = {
  from(t: string): { select(cols: string): QueryBuilderLike }
  rpc(name: string, params: Record<string, unknown>): Promise<{ data: string[] | null; error: unknown }>
}

export function normalizeFilterConfig(raw: string | null | Record<string, unknown>): FilterGroup | null {
  if (raw == null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return dropIncompleteBetweenConditions(raw as FilterGroup)
  }
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return dropIncompleteBetweenConditions(parsed as FilterGroup)
  } catch {
    return null
  }
}

function isFilterGroup(c: FilterCondition | FilterGroup): c is FilterGroup {
  return c != null && typeof c === 'object' && 'conditions' in c && Array.isArray((c as FilterGroup).conditions)
}

function isBetweenValueValid(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== ''
  return true
}

/** Drops conditions with operator 'between' and invalid/missing bounds so they are not applied. */
function dropIncompleteBetweenConditions(group: FilterGroup): FilterGroup {
  const conditions = Array.isArray(group.conditions) ? group.conditions : []
  const cleaned: Array<FilterCondition | FilterGroup> = []
  for (const c of conditions) {
    if (isFilterGroup(c)) {
      cleaned.push(dropIncompleteBetweenConditions(c))
    } else {
      const cond = c as FilterCondition
      if (
        typeof cond.operator === 'string' &&
        cond.operator.toLowerCase() === 'between' &&
        Array.isArray(cond.value) &&
        cond.value.length >= 2
      ) {
        const [lo, hi] = cond.value
        if (!isBetweenValueValid(lo) || !isBetweenValueValid(hi)) continue
      }
      cleaned.push(cond)
    }
  }
  return { ...group, conditions: cleaned }
}

function applySingleFilter(query: QueryBuilderLike, condition: FilterCondition): QueryBuilderLike {
  const rawField = typeof condition.field === 'string' ? condition.field : ''
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
  if (field === 'has_photos' || field === 'has_signatures' || field === 'needs_signatures') {
    return query
  }

  if (operator === 'eq') return query.eq(field, value)
  if (operator === 'gte') return query.gte(field, value)
  if (operator === 'lte') return query.lte(field, value)
  if (operator === 'gt') return query.gt(field, value)
  if (operator === 'lt') return query.lt(field, value)
  if (operator === 'between' && Array.isArray(value) && value.length >= 2) {
    const lo = value[0]
    const hi = value[1]
    const loValid =
      lo !== undefined &&
      lo !== null &&
      (typeof lo !== 'string' || (lo as string).trim() !== '')
    const hiValid =
      hi !== undefined &&
      hi !== null &&
      (typeof hi !== 'string' || (hi as string).trim() !== '')
    if (loValid && hiValid) {
      return query.gte(field, lo).lte(field, hi)
    }
  }
  if (operator === 'ilike' && typeof value === 'string') return query.ilike(field, `%${value}%`)
  if (operator === 'in' && Array.isArray(value)) return query.in(field, value)

  return query
}

export async function getJobIdsForBooleanFilter(
  supabase: SupabaseClientLike,
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
  const ids = (data as string[] | null) ?? []
  return ids.filter(Boolean).map((id) => String(id))
}

export async function getMatchingJobIdsFromFilterGroup(
  supabase: SupabaseClientLike,
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
