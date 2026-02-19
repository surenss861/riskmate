'use client'

import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ProtectedRoute from '@/components/ProtectedRoute'
import { jobsApi } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [filterStatus, setFilterStatus] = useState<string>(() => searchParams?.get('status') ?? '')
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>(() => searchParams?.get('risk_level') ?? '')
  const [filterTemplateSource, setFilterTemplateSource] = useState<string>('')
  const [filterTemplateId, setFilterTemplateId] = useState<string>('')
  const [page, setPage] = useState(() => Math.max(1, parseInt(searchParams?.get('page') ?? '1', 10) || 1))
  const [totalPages, setTotalPages] = useState(1)
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member'>('member')

  // Advanced search state (URL-synced)
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams?.get('q') ?? '')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [filterTimeRange, setFilterTimeRange] = useState<JobsTimeRange>(() =>
    (searchParams?.get('time_range') as JobsTimeRange) || 'all'
  )
  const [includeArchived, setIncludeArchived] = useState<boolean>(() =>
    searchParams?.get('include_archived') === 'true'
  )
  const [hasPhotos, setHasPhotos] = useState<boolean | undefined>(() => {
    const v = searchParams?.get('has_photos')
    return v === 'true' ? true : v === 'false' ? false : undefined
  })
  const [hasSignatures, setHasSignatures] = useState<boolean | undefined>(() => {
    const v = searchParams?.get('has_signatures')
    return v === 'true' ? true : v === 'false' ? false : undefined
  })
  const [needsSignatures, setNeedsSignatures] = useState<boolean | undefined>(() => {
    const v = searchParams?.get('needs_signatures')
    return v === 'true' ? true : v === 'false' ? false : undefined
  })

  // Initialize filters from URL params (source, templateId)
  useEffect(() => {
    if (searchParams) {
      const source = searchParams.get('source') || ''
      const templateId = searchParams.get('templateId') || ''
      setFilterTemplateSource(source)
      setFilterTemplateId(templateId)
    }
  }, [searchParams])

  // Sync filters to URL (shareable links)
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (debouncedSearchQuery) params.set('q', debouncedSearchQuery)
    else params.delete('q')
    if (filterStatus) params.set('status', filterStatus)
    else params.delete('status')
    if (filterRiskLevel) params.set('risk_level', filterRiskLevel)
    else params.delete('risk_level')
    if (filterTimeRange && filterTimeRange !== 'all') params.set('time_range', filterTimeRange)
    else params.delete('time_range')
    if (includeArchived) params.set('include_archived', 'true')
    else params.delete('include_archived')
    if (hasPhotos === true) params.set('has_photos', 'true')
    else if (hasPhotos === false) params.set('has_photos', 'false')
    else params.delete('has_photos')
    if (hasSignatures === true) params.set('has_signatures', 'true')
    else if (hasSignatures === false) params.set('has_signatures', 'false')
    else params.delete('has_signatures')
    if (needsSignatures === true) params.set('needs_signatures', 'true')
    else if (needsSignatures === false) params.set('needs_signatures', 'false')
    else params.delete('needs_signatures')
    if (page > 1) params.set('page', String(page))
    else params.delete('page')
    const next = params.toString()
    const current = searchParams?.toString() ?? ''
    if (next !== current) {
      router.replace(next ? `/operations/jobs?${next}` : '/operations/jobs', { scroll: false })
    }
  }, [debouncedSearchQuery, filterStatus, filterRiskLevel, filterTimeRange, includeArchived, hasPhotos, hasSignatures, needsSignatures, page, router, searchParams])

  // Load templates for filter dropdown
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoadingTemplates(true)
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .single()

        if (!userRow?.organization_id) return

        // Load both hazard and job templates
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

  // Load user and role once
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
      const { data: userRow } = await supabase
        .from('users')
          .select('role')
        .eq('id', user.id)
        .single()

        if (userRow?.role) {
          setUserRole(userRow.role as 'owner' | 'admin' | 'member')
        }
      }
    }
    loadUser()
  }, [])

  // SWR fetcher function (stable reference)
  const fetcher = useCallback(async (key: string) => {
    const response = await jobsApi.list({
      page,
      limit: 50,
      status: filterStatus || undefined,
      risk_level: filterRiskLevel || undefined,
      q: debouncedSearchQuery || undefined,
      time_range: filterTimeRange !== 'all' ? filterTimeRange : undefined,
      include_archived: includeArchived || undefined,
      has_photos: hasPhotos,
      has_signatures: hasSignatures,
      needs_signatures: needsSignatures,
    })

    if (process.env.NODE_ENV === 'development' && response._meta) {
      console.log('[Jobs API] Source of truth:', response._meta)
    }
    if (response.data && response.data.length > 0) {
      (response as any).lastUpdated = new Date().toISOString()
    }
    return response
  }, [page, filterStatus, filterRiskLevel, debouncedSearchQuery, filterTimeRange, includeArchived, hasPhotos, hasSignatures, needsSignatures])

  // SWR key for caching
  const swrKey = `jobs-list-${page}-${filterStatus}-${filterRiskLevel}-${filterTemplateSource}-${filterTemplateId}-${debouncedSearchQuery}-${filterTimeRange}-${includeArchived}-${hasPhotos}-${hasSignatures}-${needsSignatures}`

  // Use SWR for caching and automatic revalidation
  const { data: response, error, isLoading, mutate } = useSWR(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
    }
  )

  // Track last updated time and source indicator
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [sourceIndicator, setSourceIndicator] = useState<string>('')

  // Process response data
  useEffect(() => {
    if (!response) return
    
    const jobsData = response.data || []
    
    // Ensure template fields are never undefined (always null if missing)
    // This is critical for UI assumptions - field must exist, null is valid
    jobsData.forEach((job: any) => {
      // Use nullish coalescing to ensure field exists
      job.applied_template_id = job.applied_template_id ?? null
      job.applied_template_type = job.applied_template_type ?? null
      
      // Verify field exists (defensive check)
      if (!('applied_template_id' in job)) {
        console.error('Job missing applied_template_id field after normalization:', job.id)
        job.applied_template_id = null
      }
      if (!('applied_template_type' in job)) {
        console.error('Job missing applied_template_type field after normalization:', job.id)
        job.applied_template_type = null
      }
    })
    
    // Apply template filters client-side (since API doesn't support them yet)
    let filteredJobs = jobsData

      if (filterTemplateSource === 'template') {
      filteredJobs = filteredJobs.filter(job => job.applied_template_id !== null)
      } else if (filterTemplateSource === 'manual') {
      filteredJobs = filteredJobs.filter(job => job.applied_template_id === null)
      }

      if (filterTemplateId) {
      filteredJobs = filteredJobs.filter(job => job.applied_template_id === filterTemplateId)
      }

      // Ensure jobsData is an array and set jobs
    if (Array.isArray(filteredJobs)) {
      setJobs(filteredJobs)
      } else {
      console.warn('Jobs query returned non-array data:', filteredJobs)
        setJobs([])
      }
      
    // Calculate total pages from API pagination or filtered count
    const totalCount = response.pagination?.total || filteredJobs.length
    setTotalPages(Math.ceil(totalCount / 50))
    
    // Track last updated time
    if ((response as any).lastUpdated) {
      setLastUpdated((response as any).lastUpdated)
    } else {
      setLastUpdated(new Date().toISOString())
    }
    
    // Set source indicator (dev only or subtle)
    if (process.env.NODE_ENV === 'development' && response._meta) {
      setSourceIndicator('API')
    } else {
      setSourceIndicator('')
    }
  }, [response, filterTemplateSource, filterTemplateId])

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error('Failed to load jobs:', error)
      setJobs([])
    }
  }, [error])

  // Sync loading state
  useEffect(() => {
    setLoading(isLoading)
  }, [isLoading])

  // Legacy loadJobs callback for archive/delete callbacks (triggers SWR revalidation)
  const loadJobs = useCallback(() => {
    mutate() // Trigger SWR revalidation
  }, [mutate])
  
  // Expose mutate and current response for optimistic updates
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

  const clearAllFilters = useCallback(() => {
    setSearchQuery('')
    setFilterStatus('')
    setFilterRiskLevel('')
    setFilterTimeRange('all')
    setIncludeArchived(false)
    setHasPhotos(undefined)
    setHasSignatures(undefined)
    setNeedsSignatures(undefined)
    setFilterTemplateSource('')
    setFilterTemplateId('')
    setPage(1)
  }, [])

  return (
    <JobsPageContentView
      user={user}
      loading={loading}
      jobs={jobs}
      filterStatus={filterStatus}
      filterRiskLevel={filterRiskLevel}
      filterTemplateSource={filterTemplateSource}
      filterTemplateId={filterTemplateId}
      templates={templates}
      loadingTemplates={loadingTemplates}
      page={page}
      totalPages={totalPages}
      onFilterStatusChange={(v) => { setFilterStatus(v); setPage(1) }}
      onFilterRiskLevelChange={(v) => { setFilterRiskLevel(v); setPage(1) }}
      onFilterTemplateSourceChange={setFilterTemplateSource}
      onFilterTemplateIdChange={setFilterTemplateId}
      onPageChange={setPage}
      getRiskColor={getRiskColor}
      getStatusColor={getStatusColor}
      formatDate={formatDate}
      userRole={userRole}
      onJobArchived={loadJobs}
      onJobDeleted={loadJobs}
      lastUpdated={lastUpdated || undefined}
      sourceIndicator={sourceIndicator}
      mutateData={getMutateData()}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      filterTimeRange={filterTimeRange}
      onFilterTimeRangeChange={(v) => { setFilterTimeRange(v as JobsTimeRange); setPage(1) }}
      includeArchived={includeArchived}
      onIncludeArchivedChange={setIncludeArchived}
      hasPhotos={hasPhotos}
      onHasPhotosChange={setHasPhotos}
      hasSignatures={hasSignatures}
      onHasSignaturesChange={setHasSignatures}
      needsSignatures={needsSignatures}
      onNeedsSignaturesChange={setNeedsSignatures}
      onClearAllFilters={clearAllFilters}
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

