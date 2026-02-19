'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { FilterGroup } from '@/lib/jobs/filterConfig'
import { normalizeFilterConfig } from '@/lib/jobs/filterConfig'

export type JobsTimeRange = 'all' | '7d' | '30d' | '90d'

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
  /** Quick filter: my jobs (assigned to me) */
  myJobs: boolean
  /** Quick filter: high risk */
  highRisk: boolean
  /** Quick filter: overdue */
  overdue: boolean
  /** Quick filter: needs signatures */
  needsSignaturesQuick: boolean
  /** Quick filter: unassigned */
  unassigned: boolean
  /** Quick filter: recent (e.g. last 7 days) */
  recent: boolean
  filterTemplateSource: string
  filterTemplateId: string
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
  myJobs: false,
  highRisk: false,
  overdue: false,
  needsSignaturesQuick: false,
  unassigned: false,
  recent: false,
  filterTemplateSource: '',
  filterTemplateId: '',
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

  return {
    searchQuery: searchParams.get('q') ?? '',
    filterStatus: searchParams.get('status') ?? '',
    filterRiskLevel: searchParams.get('risk_level') ?? '',
    filterTimeRange: (searchParams.get('time_range') as JobsTimeRange) || 'all',
    includeArchived: searchParams.get('include_archived') === 'true',
    hasPhotos: parseBoolParam(searchParams.get('has_photos')),
    hasSignatures: parseBoolParam(searchParams.get('has_signatures')),
    needsSignatures: parseBoolParam(searchParams.get('needs_signatures')),
    page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1),
    filterConfig,
    savedFilterId,
    myJobs: searchParams.get('my_jobs') === 'true',
    highRisk: searchParams.get('high_risk') === 'true',
    overdue: searchParams.get('overdue') === 'true',
    needsSignaturesQuick: searchParams.get('needs_signatures') === 'true',
    unassigned: searchParams.get('unassigned') === 'true',
    recent: searchParams.get('recent') === 'true',
    filterTemplateSource: searchParams.get('source') ?? '',
    filterTemplateId: searchParams.get('templateId') ?? '',
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
  if (state.filterConfig && Object.keys(state.filterConfig).length > 0) {
    params.set('filter_config', JSON.stringify(state.filterConfig))
  }
  if (state.myJobs) params.set('my_jobs', 'true')
  if (state.highRisk) params.set('high_risk', 'true')
  if (state.overdue) params.set('overdue', 'true')
  if (state.unassigned) params.set('unassigned', 'true')
  if (state.recent) params.set('recent', 'true')
  if (state.filterTemplateSource) params.set('source', state.filterTemplateSource)
  if (state.filterTemplateId) params.set('templateId', state.filterTemplateId)
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
    (value: JobsTimeRange) => replaceUrl({ ...state, filterTimeRange: value, page: 1 }),
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
  const setUnassigned = useCallback(
    (value: boolean) => replaceUrl({ ...state, unassigned: value, page: 1 }),
    [state, replaceUrl]
  )
  const setRecent = useCallback(
    (value: boolean) => replaceUrl({ ...state, recent: value, page: 1 }),
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
    setUnassigned,
    setRecent,
    setFilterTemplateSource,
    setFilterTemplateId,
    clearAllFilters,
    getShareUrl,
  }
}
