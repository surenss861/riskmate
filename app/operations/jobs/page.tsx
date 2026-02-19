'use client'

import React, { useEffect, useState, useCallback, Suspense } from 'react'
import useSWR from 'swr'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ProtectedRoute from '@/components/ProtectedRoute'
import { jobsApi } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { useAdvancedFilters } from '@/hooks/useAdvancedFilters'
import { JobsPageContentView, type JobsTimeRange } from './JobsPageContent'

interface Job {
  id: string
  client_name: string
  job_type: string
  location: string
  status: string
  risk_score: number | null
  risk_level: string | null
  created_at: string
  updated_at: string
  applied_template_id?: string | null
  applied_template_type?: 'hazard' | 'job' | null
}

const JobsPageContent = () => {
  const adv = useAdvancedFilters()
  const { state } = adv
  const debouncedSearchQuery = useDebounce(state.searchQuery, 300)

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member'>('member')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [sourceIndicator, setSourceIndicator] = useState<string>('')

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user ?? null)
      if (user) {
        const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).single()
        if (userRow?.role) setUserRole(userRow.role as 'owner' | 'admin' | 'member')
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoadingTemplates(true)
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: userRow } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
        if (!userRow?.organization_id) return
        const { data: hazardTemplates } = await supabase
          .from('hazard_templates')
          .select('id, name')
          .eq('organization_id', userRow.organization_id)
          .eq('archived', false)
        const { data: jobTemplates } = await supabase
          .from('job_templates')
          .select('id, name')
          .eq('organization_id', userRow.organization_id)
          .eq('archived', false)
        setTemplates([...(hazardTemplates || []), ...(jobTemplates || [])])
      } catch (err) {
        console.error('Failed to load templates:', err)
      } finally {
        setLoadingTemplates(false)
      }
    }
    loadTemplates()
  }, [])

  // SWR fetcher: use URL-synced state from useAdvancedFilters
  const fetcher = useCallback(
    async (_key: string) => {
      const filterConfig =
        state.filterConfig && Object.keys(state.filterConfig).length > 0 ? state.filterConfig : undefined
      const response = await jobsApi.list({
        page: state.page,
        limit: 50,
        status: state.filterStatus || undefined,
        risk_level: state.highRisk ? 'high' : state.filterRiskLevel || undefined,
        q: debouncedSearchQuery || undefined,
        time_range: state.filterTimeRange !== 'all' ? state.filterTimeRange : undefined,
        include_archived: state.includeArchived || undefined,
        has_photos: state.hasPhotos,
        has_signatures: state.hasSignatures,
        needs_signatures: state.needsSignatures,
        overdue: state.overdue || undefined,
        unassigned: state.unassigned || undefined,
        recent: state.recent || undefined,
        assigned_to: state.myJobs ? 'me' : undefined,
        filter_config: filterConfig,
        saved_filter_id: state.savedFilterId || undefined,
        template_source: state.filterTemplateSource || undefined,
        template_id: state.filterTemplateId || undefined,
      })

      if (process.env.NODE_ENV === 'development' && response._meta) {
        console.log('[Jobs API] Source of truth:', response._meta)
      }
      if (response.data && response.data.length > 0) {
        ;(response as any).lastUpdated = new Date().toISOString()
      }
      return response
    },
    [
      state.page,
      state.filterStatus,
      state.filterRiskLevel,
      state.highRisk,
      debouncedSearchQuery,
      state.filterTimeRange,
      state.includeArchived,
      state.hasPhotos,
      state.hasSignatures,
      state.needsSignatures,
      state.overdue,
      state.unassigned,
      state.recent,
      state.myJobs,
      state.filterConfig,
      state.savedFilterId,
      state.filterTemplateSource,
      state.filterTemplateId,
    ]
  )

  const swrKey = `jobs-list-${state.page}-${state.filterStatus}-${state.filterRiskLevel}-${state.filterTemplateSource}-${state.filterTemplateId}-${debouncedSearchQuery}-${state.filterTimeRange}-${state.includeArchived}-${state.hasPhotos}-${state.hasSignatures}-${state.needsSignatures}-${state.filterConfig ? JSON.stringify(state.filterConfig) : ''}-${state.savedFilterId}-${state.myJobs}-${state.highRisk}-${state.overdue}-${state.unassigned}-${state.recent}`

  const { data: response, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  })

  useEffect(() => {
    if (!response) return

    const jobsData = response.data || []

    jobsData.forEach((job: any) => {
      job.applied_template_id = job.applied_template_id ?? null
      job.applied_template_type = job.applied_template_type ?? null
      if (!('applied_template_id' in job)) job.applied_template_id = null
      if (!('applied_template_type' in job)) job.applied_template_type = null
    })

    setJobs(Array.isArray(jobsData) ? jobsData : [])

    const totalCount = response.pagination?.total ?? 0
    setTotalPages(Math.max(1, Math.ceil(totalCount / 50)))

    if ((response as any).lastUpdated) {
      setLastUpdated((response as any).lastUpdated)
    } else {
      setLastUpdated(new Date().toISOString())
    }
    if (process.env.NODE_ENV === 'development' && response._meta) {
      setSourceIndicator('API')
    } else {
      setSourceIndicator('')
    }
  }, [response])

  useEffect(() => {
    if (error) {
      console.error('Failed to load jobs', error)
      setJobs([])
    }
  }, [error])

  useEffect(() => {
    setLoading(isLoading)
  }, [isLoading])

  const loadJobs = useCallback(() => mutate(), [mutate])
  const getMutateData = useCallback(() => ({ mutate, currentData: response }), [mutate, response])

  const getRiskColor = (riskLevel: string | null) => {
    if (!riskLevel) return 'text-white/40'
    switch (riskLevel.toLowerCase()) {
      case 'low':
        return 'text-green-400'
      case 'medium':
        return 'text-yellow-400'
      case 'high':
        return 'text-orange-400'
      case 'critical':
        return 'text-red-400'
      default:
        return 'text-white/40'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-white/10 text-white/60 border-white/10'
      case 'active':
      case 'in_progress':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'on-hold':
      case 'on_hold':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'archived':
        return 'bg-white/10 text-white/50 border-white/5'
      default:
        return 'bg-white/10 text-white/60 border-white/10'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <JobsPageContentView
      user={user}
      loading={loading}
      jobs={jobs}
      filterStatus={state.filterStatus}
      filterRiskLevel={state.filterRiskLevel}
      filterTemplateSource={state.filterTemplateSource}
      filterTemplateId={state.filterTemplateId}
      templates={templates}
      loadingTemplates={loadingTemplates}
      page={state.page}
      totalPages={totalPages}
      onFilterStatusChange={(v) => { adv.setFilterStatus(v) }}
      onFilterRiskLevelChange={(v) => { adv.setFilterRiskLevel(v) }}
      onFilterTemplateSourceChange={(v) => { adv.setFilterTemplateSource(v) }}
      onFilterTemplateIdChange={(v) => { adv.setFilterTemplateId(v) }}
      onPageChange={adv.setPage}
      getRiskColor={getRiskColor}
      getStatusColor={getStatusColor}
      formatDate={formatDate}
      userRole={userRole}
      onJobArchived={loadJobs}
      onJobDeleted={loadJobs}
      lastUpdated={lastUpdated || undefined}
      sourceIndicator={sourceIndicator}
      mutateData={getMutateData()}
      searchQuery={state.searchQuery}
      onSearchQueryChange={adv.setSearchQuery}
      filterTimeRange={state.filterTimeRange}
      onFilterTimeRangeChange={(v) => adv.setFilterTimeRange(v as JobsTimeRange)}
      includeArchived={state.includeArchived}
      onIncludeArchivedChange={adv.setIncludeArchived}
      hasPhotos={state.hasPhotos}
      onHasPhotosChange={adv.setHasPhotos}
      hasSignatures={state.hasSignatures}
      onHasSignaturesChange={adv.setHasSignatures}
      needsSignatures={state.needsSignatures}
      onNeedsSignaturesChange={adv.setNeedsSignatures}
      onClearAllFilters={adv.clearAllFilters}
      quickFilters={{
        myJobs: state.myJobs,
        highRisk: state.highRisk,
        overdue: state.overdue,
        needsSignatures: state.needsSignaturesQuick,
        unassigned: state.unassigned,
        recent: state.recent,
        onMyJobsChange: adv.setMyJobs,
        onHighRiskChange: adv.setHighRisk,
        onOverdueChange: adv.setOverdue,
        onNeedsSignaturesChange: adv.setNeedsSignaturesQuick,
        onUnassignedChange: adv.setUnassigned,
        onRecentChange: adv.setRecent,
      }}
      filterConfig={state.filterConfig}
      savedFilterId={state.savedFilterId}
      onFilterConfigChange={adv.setFilterConfig}
      onSavedFilterApply={adv.setSavedFilterId}
      getShareUrl={adv.getShareUrl}
    />
  )
}

export default function JobsPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316]" />
          </div>
        }
      >
        <JobsPageContent />
      </Suspense>
    </ProtectedRoute>
  )
}