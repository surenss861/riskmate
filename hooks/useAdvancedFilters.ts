'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { FilterGroup } from '@/lib/jobs/filterConfig'
import { normalizeFilterConfig } from '@/lib/jobs/filterConfig'

export type JobsTimeRange = 'all' | '7d' | '30d' | '90d' | '1y'

const ALLOWED_TIME_RANGES: JobsTimeRange[] = ['all', '7d', '30d', '90d', '1y']
const ALLOWED_TIME_RANGE_SET = new Set<string>(ALLOWED_TIME_RANGES)

/** Current calendar year start (YYYY-MM-DD) and end of today (YYYY-MM-DD) for "This Year" scope. */
function getYearBounds(): { start: string; end: string } {
  const now = new Date()
  const year = now.getFullYear()
  const start = `${year}-01-01`
  const end = now.toISOString().slice(0, 10)
  return { start, end }
}

export interface AdvancedFiltersState {
  searchQuery: string
  filterStatus: string
  filterRiskLevel: string
  filterTimeRange: JobsTimeRange
  includeArchived: boolean
  hasPhotos: boolean | undefined
  hasSignatures: boolean | undefined
  needsSignatures: boolean | undefined
  page: number
  filterConfig: FilterGroup | null
  savedFilterId: string | null
  /** Drill-down: filter jobs to created in this range (from chart click). */
  createdAfter: string
  createdBefore: string
  /** Drill-down: filter jobs to completed in this range (from completion/status chart click). */
  completedAfter: string
  completedBefore: string
  /** Filter jobs that have this hazard category (from hazard chart click). */
  hazard: string
  /** Quick filter: my jobs (assigned to me) */
  myJobs: boolean
  /** Quick filter: high risk */
  highRisk: boolean
  /** Quick filter: overdue */
  overdue: boolean
  /** Quick filter: needs signatures (also set by pending_signatures URL param for insight links) */
  needsSignaturesQuick: boolean
  /** Quick filter: due soon (jobs due within 7 days, for deadline-risk insight links) */
  dueSoon: boolean
  /** Quick filter: unassigned */
  unassigned: boolean
  /** Quick filter: recent (e.g. last 7 days) */
  recent: boolean
  filterTemplateSource: string
  filterTemplateId: string
  /** Insight drill-down cohort (from analytics chart click). */
  insight: string
  /** Reference date for insight drill-down (ISO string). */
  reference_date: string
}

const DEFAULT_STATE: AdvancedFiltersState = {
  searchQuery: '',
  filterStatus: '',
  filterRiskLevel: '',
  filterTimeRange: 'all',
  includeArchived: false,
  hasPhotos: undefined,
  hasSignatures: undefined,
  needsSignatures: undefined,
  page: 1,
  filterConfig: null,
  savedFilterId: null,
  createdAfter: '',
  createdBefore: '',
  completedAfter: '',
  completedBefore: '',
  hazard: '',
  myJobs: false,
  highRisk: false,
  overdue: false,
  needsSignaturesQuick: false,
  dueSoon: false,
  unassigned: false,
  recent: false,
  filterTemplateSource: '',
  filterTemplateId: '',
  insight: '',
  reference_date: '',
}

function parseBoolParam(value: string | null): boolean | undefined {
  if (value === null) return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function parseStateFromSearchParams(searchParams: URLSearchParams | null): AdvancedFiltersState {
  if (!searchParams) return DEFAULT_STATE
  const filterConfigRaw = searchParams.get('filter_config')
  let filterConfig: FilterGroup | null = null
  if (filterConfigRaw) {
    try {
      // URLSearchParams already returns decoded values; parse raw JSON only
      const parsed = typeof filterConfigRaw === 'string' ? JSON.parse(filterConfigRaw) : filterConfigRaw
      filterConfig = normalizeFilterConfig(parsed)
    } catch {
      // ignore invalid JSON
    }
  }
  const savedFilterId = searchParams.get('saved_filter_id')?.trim() ?? null

  const timeRangeParam = searchParams.get('time_range')
  const filterTimeRange: JobsTimeRange =
    timeRangeParam && ALLOWED_TIME_RANGE_SET.has(timeRangeParam)
      ? (timeRangeParam as JobsTimeRange)
      : 'all'

  const urlCreatedAfter = searchParams.get('created_after') ?? ''
  const urlCreatedBefore = searchParams.get('created_before') ?? ''
  const rangeStart = searchParams.get('range_start')?.trim() ?? ''
  const rangeEnd = searchParams.get('range_end')?.trim() ?? ''

  let createdAfter = urlCreatedAfter
  let createdBefore = urlCreatedBefore
  if (rangeStart && rangeEnd) {
    createdAfter = rangeStart
    createdBefore = rangeEnd
  } else if (filterTimeRange === '1y' && !urlCreatedAfter && !urlCreatedBefore) {
    const bounds = getYearBounds()
    createdAfter = bounds.start
    createdBefore = bounds.end
  }

  return {
    searchQuery: searchParams.get('q') ?? '',
    filterStatus: searchParams.get('status') ?? '',
    filterRiskLevel: searchParams.get('risk_level') ?? '',
    filterTimeRange,
    includeArchived: searchParams.get('include_archived') === 'true',
    hasPhotos: parseBoolParam(searchParams.get('has_photos')),
    hasSignatures: parseBoolParam(searchParams.get('has_signatures')),
    needsSignatures:
      parseBoolParam(searchParams.get('needs_signatures')) ?? parseBoolParam(searchParams.get('pending_signatures')),
    page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1),
    filterConfig,
    savedFilterId,
    createdAfter,
    createdBefore,
    completedAfter: searchParams.get('completed_after') ?? '',
    completedBefore: searchParams.get('completed_before') ?? '',
    hazard: searchParams.get('hazard') ?? '',
    myJobs: searchParams.get('my_jobs') === 'true',
    highRisk: searchParams.get('high_risk') === 'true',
    overdue: searchParams.get('overdue') === 'true',
    needsSignaturesQuick:
      searchParams.get('needs_signatures') === 'true' || searchParams.get('pending_signatures') === 'true',
    dueSoon: searchParams.get('due_soon') === 'true',
    unassigned: searchParams.get('unassigned') === 'true',
    recent: searchParams.get('recent') === 'true',
    filterTemplateSource: searchParams.get('template_source') ?? '',
    filterTemplateId: searchParams.get('template_id') ?? '',
    insight: searchParams.get('insight') ?? '',
    reference_date: searchParams.get('reference_date') ?? '',
  }
}

function buildParams(state: AdvancedFiltersState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.searchQuery) params.set('q', state.searchQuery)
  if (state.filterStatus) params.set('status', state.filterStatus)
  if (state.filterRiskLevel) params.set('risk_level', state.filterRiskLevel)
  if (state.filterTimeRange && state.filterTimeRange !== 'all') params.set('time_range', state.filterTimeRange)
  if (state.includeArchived) params.set('include_archived', 'true')
  if (state.hasPhotos === true) params.set('has_photos', 'true')
  if (state.hasPhotos === false) params.set('has_photos', 'false')
  if (state.hasSignatures === true) params.set('has_signatures', 'true')
  if (state.hasSignatures === false) params.set('has_signatures', 'false')
  if (state.needsSignatures === true) params.set('needs_signatures', 'true')
  if (state.needsSignatures === false) params.set('needs_signatures', 'false')
  if (state.page > 1) params.set('page', String(state.page))
  if (state.savedFilterId) params.set('saved_filter_id', state.savedFilterId)
  if (state.createdAfter) params.set('created_after', state.createdAfter)
  if (state.createdBefore) params.set('created_before', state.createdBefore)
  if (state.completedAfter) params.set('completed_after', state.completedAfter)
  if (state.completedBefore) params.set('completed_before', state.completedBefore)
  if (state.hazard) params.set('hazard', state.hazard)
  if (state.filterConfig && Object.keys(state.filterConfig).length > 0) {
    params.set('filter_config', JSON.stringify(state.filterConfig))
  }
  if (state.myJobs) params.set('my_jobs', 'true')
  if (state.highRisk) params.set('high_risk', 'true')
  if (state.overdue) params.set('overdue', 'true')
  if (state.dueSoon) params.set('due_soon', 'true')
  if (state.unassigned) params.set('unassigned', 'true')
  if (state.recent) params.set('recent', 'true')
  if (state.filterTemplateSource) params.set('template_source', state.filterTemplateSource)
  if (state.filterTemplateId) params.set('template_id', state.filterTemplateId)
  if (state.insight) params.set('insight', state.insight)
  if (state.reference_date) params.set('reference_date', state.reference_date)
  return params
}

/**
 * Syncs jobs page filter state to the URL (parse on load, support back/forward, shareable links).
 */
export function useAdvancedFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const state = useMemo(() => parseStateFromSearchParams(searchParams), [searchParams])

  const replaceUrl = useCallback(
    (next: AdvancedFiltersState) => {
      const params = buildParams(next)
      const path = '/operations/jobs'
      const url = params.toString() ? `${path}?${params.toString()}` : path
      router.replace(url, { scroll: false })
    },
    [router]
  )

  const setSearchQuery = useCallback(
    (value: string) => replaceUrl({ ...state, searchQuery: value, page: 1 }),
    [state, replaceUrl]
  )
  const setFilterStatus = useCallback(
    (value: string) => replaceUrl({ ...state, filterStatus: value, page: 1 }),
    [state, replaceUrl]
  )
  const setFilterRiskLevel = useCallback(
    (value: string) => replaceUrl({ ...state, filterRiskLevel: value, page: 1 }),
    [state, replaceUrl]
  )
  const setFilterTimeRange = useCallback(
    (value: JobsTimeRange) => {
      if (value === '1y') {
        const bounds = getYearBounds()
        return replaceUrl({ ...state, filterTimeRange: value, createdAfter: bounds.start, createdBefore: bounds.end, page: 1 })
      }
      return replaceUrl({ ...state, filterTimeRange: value, page: 1 })
    },
    [state, replaceUrl]
  )
  const setIncludeArchived = useCallback(
    (value: boolean) => replaceUrl({ ...state, includeArchived: value, page: 1 }),
    [state, replaceUrl]
  )
  const setHasPhotos = useCallback(
    (value: boolean | undefined) => replaceUrl({ ...state, hasPhotos: value, page: 1 }),
    [state, replaceUrl]
  )
  const setHasSignatures = useCallback(
    (value: boolean | undefined) => replaceUrl({ ...state, hasSignatures: value, page: 1 }),
    [state, replaceUrl]
  )
  const setNeedsSignatures = useCallback(
    (value: boolean | undefined) => replaceUrl({ ...state, needsSignatures: value, page: 1 }),
    [state, replaceUrl]
  )
  const setPage = useCallback((page: number) => replaceUrl({ ...state, page }), [state, replaceUrl])
  const setFilterConfig = useCallback(
    (value: FilterGroup | null) => replaceUrl({ ...state, filterConfig: value, savedFilterId: null, page: 1 }),
    [state, replaceUrl]
  )
  const setSavedFilterId = useCallback(
    (id: string | null, config: FilterGroup | null) => replaceUrl({ ...state, savedFilterId: id, filterConfig: config, page: 1 }),
    [state, replaceUrl]
  )

  const setMyJobs = useCallback(
    (value: boolean) => replaceUrl({ ...state, myJobs: value, page: 1 }),
    [state, replaceUrl]
  )
  const setHighRisk = useCallback(
    (value: boolean) => replaceUrl({ ...state, highRisk: value, page: 1 }),
    [state, replaceUrl]
  )
  const setOverdue = useCallback(
    (value: boolean) => replaceUrl({ ...state, overdue: value, page: 1 }),
    [state, replaceUrl]
  )
  const setNeedsSignaturesQuick = useCallback(
    (value: boolean) => replaceUrl({ ...state, needsSignaturesQuick: value, needsSignatures: value ? true : undefined, page: 1 }),
    [state, replaceUrl]
  )
  const setDueSoon = useCallback(
    (value: boolean) => replaceUrl({ ...state, dueSoon: value, page: 1 }),
    [state, replaceUrl]
  )
  const setUnassigned = useCallback(
    (value: boolean) => replaceUrl({ ...state, unassigned: value, page: 1 }),
    [state, replaceUrl]
  )
  const setRecent = useCallback(
    (value: boolean) => replaceUrl({ ...state, recent: value, page: 1 }),
    [state, replaceUrl]
  )
  const setCreatedRange = useCallback(
    (after: string, before: string) => replaceUrl({ ...state, createdAfter: after, createdBefore: before, page: 1 }),
    [state, replaceUrl]
  )
  const setCompletedRange = useCallback(
    (after: string, before: string) => replaceUrl({ ...state, completedAfter: after, completedBefore: before, page: 1 }),
    [state, replaceUrl]
  )
  const setHazard = useCallback(
    (value: string) => replaceUrl({ ...state, hazard: value, page: 1 }),
    [state, replaceUrl]
  )
  const setInsight = useCallback(
    (value: string) => replaceUrl({ ...state, insight: value, reference_date: value ? state.reference_date : '', page: 1 }),
    [state, replaceUrl]
  )
  const setReferenceDate = useCallback(
    (value: string) => replaceUrl({ ...state, reference_date: value, page: 1 }),
    [state, replaceUrl]
  )
  const setFilterTemplateSource = useCallback(
    (value: string) => replaceUrl({ ...state, filterTemplateSource: value, filterTemplateId: value ? state.filterTemplateId : '', page: 1 }),
    [state, replaceUrl]
  )
  const setFilterTemplateId = useCallback(
    (value: string) => replaceUrl({ ...state, filterTemplateId: value, page: 1 }),
    [state, replaceUrl]
  )

  const clearAllFilters = useCallback(() => replaceUrl(DEFAULT_STATE), [replaceUrl])

  const getShareUrl = useCallback(() => {
    if (typeof window === 'undefined') return ''
    const params = buildParams(state)
    const base = window.location.origin + '/operations/jobs'
    return params.toString() ? `${base}?${params.toString()}` : base
  }, [state])

  return {
    state,
    setSearchQuery,
    setFilterStatus,
    setFilterRiskLevel,
    setFilterTimeRange,
    setIncludeArchived,
    setHasPhotos,
    setHasSignatures,
    setNeedsSignatures,
    setPage,
    setFilterConfig,
    setSavedFilterId,
    setMyJobs,
    setHighRisk,
    setOverdue,
    setNeedsSignaturesQuick,
    setDueSoon,
    setUnassigned,
    setRecent,
    setCreatedRange,
    setCompletedRange,
    setHazard,
    setInsight,
    setReferenceDate,
    setFilterTemplateSource,
    setFilterTemplateId,
    clearAllFilters,
    getShareUrl,
  }
}
