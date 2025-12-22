'use client'
// NOTE: This page was moved from /dashboard to /operations
// for enterprise language consistency (Operations Control Center)


import { useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ProtectedRoute from '@/components/ProtectedRoute'
import { motion } from 'framer-motion'
import { jobsApi, subscriptionsApi, riskApi } from '@/lib/api'
import UpgradeBanner from '@/components/UpgradeBanner'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useDebounce } from '@/hooks/useDebounce'
import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { TrendChart } from '@/components/dashboard/TrendChart'
import EvidenceWidget from '@/components/dashboard/EvidenceWidget'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { DashboardSkeleton, JobListSkeleton } from '@/components/dashboard/SkeletonLoader'
import { DashboardOverview } from '@/components/dashboard/DashboardOverview'
import { Changelog } from '@/components/dashboard/Changelog'
import { FirstRunSetupWizard } from '@/components/setup/FirstRunSetupWizard'
import Link from 'next/link'
import { getRiskBadgeClass, getStatusBadgeClass } from '@/lib/styles/design-system'
import { AppBackground, AppShell, PageHeader, Button as SharedButton, GlassCard } from '@/components/shared'
import clsx from 'clsx'

type TimeRange = '7d' | '30d' | '90d' | 'all'

interface Job {
  id: string
  client_name: string
  job_type: string
  location: string
  status: string
  risk_score: number | null
  risk_level: string | null
  created_at: string
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/60">Loading...</div>}>
      <DashboardPageInner />
    </Suspense>
  )
}

function DashboardPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [subscription, setSubscription] = useState<any>(null)
  const [hazards, setHazards] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('')
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  
  // Time range from query params, default to 30d
  const timeRangeParam = searchParams.get('time_range') as TimeRange | null
  const [timeRange, setTimeRange] = useState<TimeRange>(timeRangeParam || '30d')
  const analyticsRange = timeRange === 'all' ? 365 : parseInt(timeRange.replace('d', ''))
  
  // Job Roster filters from URL params
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') || '')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [sortBy, setSortBy] = useState<string>(searchParams.get('sort') || 'blockers_desc')
  const [currentPage, setCurrentPage] = useState<number>(parseInt(searchParams.get('page') || '1', 10))
  const [pageSize, setPageSize] = useState<number>(parseInt(searchParams.get('page_size') || '50', 10))
  const [jobsPagination, setJobsPagination] = useState<{
    page?: number
    page_size?: number
    total: number
    total_pages?: number
    totalPages?: number
  } | null>(null)

  const isMember = userRole === 'member'
  const roleLoaded = userRole !== null

  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
    isFeatureLocked: analyticsLocked,
    refetch: refetchAnalytics,
  } = useAnalytics({
    range: `${analyticsRange}d`,
    refreshIntervalMs: 5 * 60 * 1000,
    enabled: roleLoaded && !isMember, // Disable analytics for members, but wait for role to load
  })

  const loadData = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      // Variables for subscription and organization
      let subscriptionData: any = null
      let organizationId: string | null = null

      // Load user role and setup status
      let role = 'member'
      if (user) {
        const { data: userRow } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        role = userRow?.role ?? 'member'
        setUserRole(role)
        // Don't show onboarding wizard for now (columns don't exist yet)
        setShowOnboarding(false)
      }

      // Load subscription first (needed for permit pack hints)
      if (role !== 'member') {
        try {
          const subResponse = await subscriptionsApi.get()
          subscriptionData = subResponse.data
          setSubscription(subResponse.data)
        } catch (err) {
          // Subscription might not exist yet
        }
      }
      
      // Get organization_id for jobs query
      if (user) {
        const { data: userRow } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle()
        organizationId = userRow?.organization_id || null
      }

      // Load jobs from database for Job Roster
      try {
        const jobsResponse = await jobsApi.list({
          status: filterStatus || undefined,
          risk_level: filterRiskLevel || undefined,
          time_range: timeRange, // Use global time range
          q: debouncedSearchQuery || undefined, // Search query
          sort: sortBy || undefined, // Sort mode
          page: currentPage,
          page_size: pageSize,
        })
        
        if (jobsResponse?.data && Array.isArray(jobsResponse.data)) {
          // Store pagination info
          if (jobsResponse.pagination) {
            setJobsPagination(jobsResponse.pagination)
          }
          
          // Jobs now come with readiness metrics from backend, no need for extra fetches
          // Just merge with permit pack hint if needed
          const jobsWithHints = jobsResponse.data.map((job: Job) => ({
            ...job,
            permitPacksAvailable: subscriptionData?.tier === 'business',
          }))
          setJobs(jobsWithHints)
        } else {
          console.warn('Jobs API returned invalid data format:', jobsResponse)
          setJobs([])
          setJobsPagination(null)
        }
      } catch (jobsError: any) {
        console.error('Failed to load jobs for Job Roster:', jobsError)
        setJobs([]) // Set empty array on error to show empty state
      }

      // Load hazards (only for owners/admins)
      if (role !== 'member') {
        try {
          const hazardsResponse = await riskApi.getSummary()
          setHazards(hazardsResponse.hazards || [])
        } catch (err) {
          // Ignore errors
        }
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err)
      if (err.message?.includes('JOB_LIMIT')) {
        setShowUpgradeBanner(true)
      }
      setLoading(false)
    }
  }, [filterStatus, filterRiskLevel, timeRange, debouncedSearchQuery, sortBy, currentPage, pageSize])
  
  // Update URL params when filters change (preserve time_range)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    
    // Preserve time_range
    if (timeRange && timeRange !== '30d') {
      params.set('time_range', timeRange)
    } else {
      params.delete('time_range')
    }
    
    // Update search
    if (debouncedSearchQuery) {
      params.set('q', debouncedSearchQuery)
    } else {
      params.delete('q')
    }
    
    // Update sort (only if not default)
    if (sortBy && sortBy !== 'blockers_desc') {
      params.set('sort', sortBy)
    } else {
      params.delete('sort')
    }
    
    // Update pagination
    if (currentPage > 1) {
      params.set('page', currentPage.toString())
    } else {
      params.delete('page')
    }
    if (pageSize !== 50) {
      params.set('page_size', pageSize.toString())
    } else {
      params.delete('page_size')
    }
    
    // Preserve status and risk_level filters
    if (filterStatus) {
      params.set('status', filterStatus)
    } else {
      params.delete('status')
    }
    if (filterRiskLevel) {
      params.set('risk_level', filterRiskLevel)
    } else {
      params.delete('risk_level')
    }
    
    // Update URL without triggering navigation
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState({}, '', newUrl)
  }, [debouncedSearchQuery, sortBy, currentPage, pageSize, timeRange, filterStatus, filterRiskLevel, searchParams])
  
  // Initialize filters from URL on mount (for shareable links)
  useEffect(() => {
    const statusParam = searchParams.get('status')
    const riskParam = searchParams.get('risk_level')
    if (statusParam && !filterStatus) setFilterStatus(statusParam)
    if (riskParam && !filterRiskLevel) setFilterRiskLevel(riskParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount - intentionally empty deps to run once

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient()
    // Clear cache on logout
    const { cacheInvalidation } = await import('@/lib/cache')
    cacheInvalidation.clearAll()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400'
      case 'in_progress':
        return 'text-blue-400'
      case 'cancelled':
        return 'text-red-400'
      default:
        return 'text-[#A1A1A1]'
    }
  }

  // Default analytics object to prevent null errors
  const defaultAnalytics = {
    jobs_with_evidence: 0,
    jobs_without_evidence: 0,
    completion_rate: 0,
    avg_time_to_close_hours: 0,
    high_risk_jobs: 0,
    total_jobs: 0,
    evidence_count: 0,
    avg_time_to_first_evidence_hours: 0,
    trend_data: [],
    trend: [],
    // New fields (optional, used in Sprint 2)
    jobs_total: 0,
    jobs_scored: 0,
    jobs_with_any_evidence: 0,
    jobs_with_photo_evidence: 0,
    jobs_missing_required_evidence: 0,
    required_evidence_policy: '',
    avg_time_to_first_photo_minutes: null as number | null,
    trend_empty_reason: null as 'no_jobs' | 'no_events' | null,
  }

  const analyticsData = analytics || defaultAnalytics

  const jobsWithEvidence = analyticsData.jobs_with_evidence
  const totalJobsForRange =
    analyticsData.jobs_with_evidence + analyticsData.jobs_without_evidence

  const kpiItems = useMemo(
    () => [
      {
        id: 'compliance',
        title: 'Compliance Rate',
        value: Math.round(analyticsData.completion_rate * 100),
        suffix: '%',
        description: 'Mitigation items marked complete in this window.',
        highlightColor:
          analyticsData.completion_rate >= 0.9
            ? '#29E673'
            : analyticsData.completion_rate >= 0.7
            ? '#FACC15'
            : '#FB7185',
        trend: (
          analyticsData.completion_rate >= 0.9
            ? 'up'
            : analyticsData.completion_rate <= 0.5
            ? 'down'
            : 'flat'
        ) as 'up' | 'down' | 'flat',
        trendLabel: analyticsError ? 'Using cached data' : 'Live field data',
        isLoading: analyticsLoading,
        href: `/operations/audit/readiness?status=open&time_range=${timeRange}`,
      },
      {
        id: 'close-time',
        title: 'Avg. Time to Close',
        value: Number(analyticsData.avg_time_to_close_hours.toFixed(1)),
        suffix: 'h',
        description: 'From mitigation created → completed.',
        highlightColor: '#38BDF8',
        trend: (analyticsData.avg_time_to_close_hours <= 24 ? 'up' : 'down') as 'up' | 'down',
        trendLabel:
          analyticsData.avg_time_to_close_hours <= 24
            ? 'Under 24h target'
            : 'Investigate slow mitigations',
        isLoading: analyticsLoading,
        href: `/operations/audit?tab=operations&event_name=mitigation.resolved&time_range=${timeRange}`,
      },
      {
        id: 'high-risk',
        title: 'High-Risk Jobs',
        value: analyticsData.high_risk_jobs,
        description: 'Jobs scoring above 75 risk.',
        highlightColor: '#FB7185',
        trend: (analyticsData.high_risk_jobs === 0 ? 'up' : 'down') as 'up' | 'down',
        trendLabel:
          analyticsData.high_risk_jobs === 0
            ? 'All jobs in safe zone'
            : 'Needs immediate mitigation',
        isLoading: analyticsLoading,
        href: `/operations/jobs?risk_level=high&time_range=${timeRange}`,
      },
      {
        id: 'evidence-files',
        title: 'Evidence Files',
        value: analyticsData.evidence_count,
        description: 'Photos captured within the selected window.',
        highlightColor: '#F97316',
        trend: (analyticsData.evidence_count > 0 ? 'up' : 'flat') as 'up' | 'flat',
        trendLabel:
          analyticsData.evidence_count > 0
            ? 'Evidence trail building'
            : 'Add site photos',
        isLoading: analyticsLoading,
        href: `/operations/jobs?missing_evidence=true&time_range=${timeRange}`,
      },
    ],
    [
      analyticsData.completion_rate,
      analyticsData.avg_time_to_close_hours,
      analyticsData.high_risk_jobs,
      analyticsData.evidence_count,
      analyticsError,
      analyticsLoading,
      timeRange,
    ]
  )

  // Sync time range with URL query params
  useEffect(() => {
    const param = searchParams.get('time_range') as TimeRange | null
    if (param && ['7d', '30d', '90d', 'all'].includes(param)) {
      setTimeRange(param)
    }
  }, [searchParams])

  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange)
    const params = new URLSearchParams(searchParams.toString())
    params.set('time_range', newRange)
    router.push(`/operations?${params.toString()}`, { scroll: false })
    refetchAnalytics()
  }

  const handleRangeChange = (nextRange: number) => {
    // Convert number to TimeRange
    const rangeMap: Record<number, TimeRange> = { 7: '7d', 30: '30d', 90: '90d', 365: 'all' }
    const newTimeRange = rangeMap[nextRange] || '30d'
    handleTimeRangeChange(newTimeRange)
  }

  // Compute DashboardOverview data
  const todaysJobs = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return jobs.filter((job) => {
      const jobDate = new Date(job.created_at)
      jobDate.setHours(0, 0, 0, 0)
      return jobDate.getTime() === today.getTime()
    }).map((job) => ({
      id: job.id,
      client_name: job.client_name,
      risk_score: job.risk_score,
      status: job.status,
    }))
  }, [jobs])

  const jobsAtRisk = useMemo(() => {
    return jobs
      .filter((job) => job.risk_score !== null && job.risk_score > 75)
      .map((job) => ({
        id: job.id,
        client_name: job.client_name,
        risk_score: job.risk_score!,
        risk_level: job.risk_level || 'high',
      }))
  }, [jobs])

  const recentEvidence = useMemo(() => {
    // Placeholder - would need to fetch from documents/photos API
    return []
  }, [])

  const incompleteMitigations = useMemo(() => {
    // Placeholder - would need to fetch from mitigation_items API
    return []
  }, [])

  const workforceActivity = useMemo(() => {
    // Placeholder - would need to fetch from users/team API
    return []
  }, [])

  const complianceTrend = useMemo(() => {
    return (analyticsData.trend || []).map((item: any) => ({
      date: item.date || item.period || '',
      rate: item.completion_rate || item.rate || 0,
    }))
  }, [analyticsData.trend])

  // Calculate KPI metrics for hero card (scoped to time range)
  const kpiMetrics = useMemo(() => {
    // Calculate date cutoff based on time range
    const now = new Date()
    let dateCutoff: Date | null = null
    if (timeRange === '7d') {
      dateCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (timeRange === '30d') {
      dateCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else if (timeRange === '90d') {
      dateCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    }
    // 'all' means no cutoff
    
    // Filter jobs by time range
    const jobsInRange = dateCutoff 
      ? jobs.filter(j => new Date(j.created_at) >= dateCutoff!)
      : jobs
    
    const activeJobs = jobsInRange.filter(j => j.status === 'active' || j.status === 'in_progress').length
    const openRisks = jobsInRange.filter(j => j.risk_score !== null && j.risk_score > 75).length
    const avgRiskScore = jobsInRange.length > 0 && jobsInRange.some(j => j.risk_score !== null)
      ? Math.round(jobsInRange.filter(j => j.risk_score !== null).reduce((sum, j) => sum + (j.risk_score || 0), 0) / jobsInRange.filter(j => j.risk_score !== null).length)
      : null
    
    return {
      activeJobs,
      openRisks,
      avgRiskScore,
      auditEvents30d: null as number | null, // Will be loaded separately
    }
  }, [jobs, timeRange])
  
  // Load audit events count
  const [auditEventsCount, setAuditEventsCount] = useState<number | null>(null)
  useEffect(() => {
    const loadAuditEventsCount = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        const { data: userRow } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .single()
        
        if (!userRow?.organization_id) return
        
        // Calculate date cutoff
        const now = new Date()
        let dateCutoff: Date | null = null
        if (timeRange === '7d') {
          dateCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        } else if (timeRange === '30d') {
          dateCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        } else if (timeRange === '90d') {
          dateCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        }
        
        let query = supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', userRow.organization_id)
        
        if (dateCutoff) {
          query = query.gte('created_at', dateCutoff.toISOString())
        }
        
        const { count, error } = await query
        
        if (error) throw error
        setAuditEventsCount(count ?? 0)
      } catch (err) {
        console.error('Failed to load audit events count:', err)
        setAuditEventsCount(null)
      }
    }
    
    loadAuditEventsCount()
  }, [timeRange])
  
  // Update kpiMetrics with audit events count
  const kpiMetricsWithAudit = useMemo(() => ({
    ...kpiMetrics,
    auditEvents30d: auditEventsCount,
  }), [kpiMetrics, auditEventsCount])

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardSkeleton />
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppBackground>
        <DashboardNavbar email={user?.email} onLogout={handleLogout} />

        <AppShell>
          {/* Mini-Hero Header - Editorial style matching landing page */}
          <div className="mb-16">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between md:gap-8 mb-12">
              <div className="flex-1">
                <PageHeader
                  title="Operations"
                  subtitle="Audit-defensible live health across jobs, mitigations, evidence."
                  showDivider={true}
                  className="mb-0"
                />
              </div>
              <div className="flex items-center gap-4 mt-6 md:mt-0">
                {/* Time Range Segmented Control */}
                <div className="inline-flex bg-white/5 border border-white/10 rounded-lg p-1 backdrop-blur-sm">
                  {(['30d', '90d', 'all'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={clsx(
                        'px-4 py-2.5 text-sm font-medium rounded-md transition-all',
                        timeRange === range
                          ? 'bg-[#F97316] text-black shadow-sm'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                      )}
                    >
                      {range === 'all' ? 'All' : range.toUpperCase()}
                    </button>
                  ))}
                </div>
                <SharedButton
                  variant="primary"
                  onClick={() => router.push('/operations/jobs/new')}
                >
                  + New Job
                </SharedButton>
              </div>
            </div>

            {/* KPI Row - Editorial, flat, no dots */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <GlassCard className="p-6">
                <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Active Jobs</div>
                <div className="text-3xl font-bold font-display text-white mb-2">{kpiMetrics.activeJobs}</div>
                <div className="text-sm text-white/60">Currently tracked</div>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Open Risks</div>
                <div className="text-3xl font-bold font-display text-white mb-2">{kpiMetrics.openRisks}</div>
                <div className="text-sm text-white/60">
                  {kpiMetrics.openRisks === 0 ? 'All quiet' : 'Requiring attention'}
                </div>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Avg Risk Score</div>
                <div className="text-3xl font-bold font-display text-white mb-2">
                  {kpiMetrics.avgRiskScore !== null ? kpiMetrics.avgRiskScore : '—'}
                </div>
                <div className="text-sm text-white/60">Across all jobs</div>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Audit Events</div>
                <div className="text-3xl font-bold font-display text-white mb-2">
                  {kpiMetricsWithAudit.auditEvents30d !== null ? kpiMetricsWithAudit.auditEvents30d : '—'}
                </div>
                <div className="text-sm text-white/60">Last 30 days</div>
              </GlassCard>
            </div>
          </div>

          {!isMember && showUpgradeBanner && (
            <UpgradeBanner
              message="You've reached your Starter plan limit. Upgrade to Pro for unlimited jobs."
              onDismiss={() => setShowUpgradeBanner(false)}
            />
          )}

          {/* KPI Tiles - Only for owners/admins */}
          {!isMember && (analyticsLocked ? (
            <GlassCard className="p-10 text-center mb-16">
              <p className="text-xs uppercase tracking-wider text-white/50 mb-3">Analytics</p>
              <h2 className="text-3xl font-bold font-display text-white mb-4">Upgrade to unlock live analytics</h2>
              <p className="mt-4 text-sm text-white/65 max-w-2xl mx-auto">
                The Business plan includes real-time mitigation metrics, evidence reporting, and compliance insights. Upgrade your plan to see live analytics here.
              </p>
              <div className="mt-6 flex flex-col gap-3 items-center">
                <SharedButton
                  variant="primary"
                  onClick={() => router.push('/pricing#business')}
                >
                  Explore Business Plan
                </SharedButton>
                <SharedButton
                  variant="secondary"
                  onClick={() => router.push('/pricing')}
                >
                  View all plans →
                </SharedButton>
              </div>
            </GlassCard>
          ) : (
            <div className="mb-16 space-y-16">
              <div>
                <h2 className="text-2xl font-bold font-display mb-6">Performance Metrics</h2>
                <KpiGrid items={kpiItems} />
              </div>
              <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                <GlassCard className="p-8">
                  <TrendChart
                    data={analyticsData.trend}
                    rangeDays={analyticsRange}
                    onRangeChange={handleRangeChange}
                    isLoading={analyticsLoading}
                    emptyReason={analyticsData.trend_empty_reason}
                    onCreateJob={() => router.push('/operations/jobs/new')}
                    onViewMitigations={() => router.push('/operations/audit/readiness?status=open')}
                  />
                </GlassCard>
                <GlassCard className="p-8">
                  <EvidenceWidget
                    totalJobs={totalJobsForRange}
                    jobsWithEvidence={jobsWithEvidence}
                    evidenceCount={analyticsData.evidence_count}
                    avgTimeToFirstEvidenceHours={analyticsData.avg_time_to_first_evidence_hours}
                    isLoading={analyticsLoading}
                    jobs_total={analyticsData.jobs_total}
                    jobs_with_photo_evidence={analyticsData.jobs_with_photo_evidence}
                    jobs_missing_required_evidence={analyticsData.jobs_missing_required_evidence}
                    required_evidence_policy={analyticsData.required_evidence_policy}
                    avg_time_to_first_photo_minutes={analyticsData.avg_time_to_first_photo_minutes}
                    timeRange={timeRange}
                  />
                </GlassCard>
              </div>
            </div>
          ))}

          {/* Enhanced Dashboard Overview - Only for owners/admins */}
          {!isMember && (
            <div className="mb-16">
              <div className="mb-4">
                <p className="text-sm text-white/60">
                  Your centralized job hub — track progress, hazards, documents, and generate audit-ready reports.
                </p>
              </div>
              <DashboardOverview
                todaysJobs={todaysJobs}
                jobsAtRisk={jobsAtRisk}
                recentEvidence={recentEvidence}
                incompleteMitigations={incompleteMitigations}
                workforceActivity={workforceActivity}
                complianceTrend={complianceTrend}
                timeRange={timeRange}
              />
            </div>
          )}

          {/* Changelog - Only for owners/admins */}
          {!isMember && (
            <div className="mb-16">
              <Changelog />
            </div>
          )}

          {/* Top Hazards - Only for owners/admins */}
          {!isMember && hazards.length > 0 && (
            <GlassCard className="p-6 mb-16">
              <h2 className="text-2xl font-bold font-display mb-2">Top Hazards</h2>
              <div className="h-[1px] w-24 bg-gradient-to-r from-[#F97316] via-[#FFC857] to-transparent mb-4" />
              <p className="text-base text-white/70 mt-4">
                The most frequent risk signatures across your active jobs.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {hazards.map((hazard) => (
                  <div
                    key={hazard.code}
                    className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-sm text-white transition hover:border-white/20 backdrop-blur-sm"
                  >
                    <span className="font-medium">{hazard.name}</span>
                    <span className="ml-2 text-xs text-white/55">({hazard.count}x)</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Job List */}
          <GlassCard className="mb-16">
            <div className="border-b border-white/5 px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <Link href="/operations/jobs">
                    <h2 className="text-2xl font-bold font-display hover:text-[#F97316] transition-colors cursor-pointer">Job Roster</h2>
                  </Link>
                </div>
                <div className="flex items-center gap-4">
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search jobs..."
                      className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-2 pl-10 text-sm text-white/90 placeholder-white/40 transition focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 w-64"
                    />
                    <svg
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  
                  {/* Sort Dropdown */}
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value)
                      setCurrentPage(1) // Reset to first page when sorting changes
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-2 text-sm text-white/90 transition focus:outline-none focus:ring-1 focus:ring-white/20"
                  >
                    <option value="blockers_desc">Most Blockers</option>
                    <option value="blockers_asc">Fewest Blockers</option>
                    <option value="readiness_asc">Readiness (Low to High)</option>
                    <option value="readiness_desc">Readiness (High to Low)</option>
                    <option value="risk_desc">Highest Risk</option>
                    <option value="risk_asc">Lowest Risk</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>
              
              {/* Filters Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-white/40 uppercase tracking-wide">FILTERS</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-3 py-1.5 text-sm text-white/80 transition focus:outline-none focus:ring-1 focus:ring-white/20"
                  >
                    <option value="">Status (All)</option>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <select
                    value={filterRiskLevel}
                    onChange={(e) => {
                      setFilterRiskLevel(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-3 py-1.5 text-sm text-white/80 transition focus:outline-none focus:ring-1 focus:ring-white/20"
                  >
                    <option value="">Risk (All)</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                
                {/* Results count */}
                {jobsPagination && (
                  <div className="text-sm text-white/60">
                    {jobsPagination.total > 0 ? (
                      <>
                        Showing {((currentPage - 1) * pageSize) + 1}-
                        {Math.min(currentPage * pageSize, jobsPagination.total)} of {jobsPagination.total}
                      </>
                    ) : (
                      'No jobs found'
                    )}
                  </div>
                )}
              </div>
            </div>

            {jobs.length === 0 && !loading ? (
              <div className="px-12 py-16 text-center">
                {debouncedSearchQuery || filterStatus || filterRiskLevel ? (
                  <>
                    <p className="mb-2 text-white font-medium">No jobs match your filters</p>
                    <p className="mb-6 text-sm text-white/60">
                      Try adjusting your search, filters, or time range.
                    </p>
                    <SharedButton
                      variant="secondary"
                      onClick={() => {
                        setSearchQuery('')
                        setFilterStatus('')
                        setFilterRiskLevel('')
                        setCurrentPage(1)
                      }}
                    >
                      Clear Filters
                    </SharedButton>
                  </>
                ) : (
                  <>
                    <p className="mb-2 text-lg font-semibold text-white">No active jobs</p>
                    <p className="mb-6 text-sm text-white/60">
                      Create a job to begin compliance tracking and audit logging.
                    </p>
                    <SharedButton
                      variant="primary"
                      size="lg"
                      onClick={() => router.push('/operations/jobs/new')}
                      onMouseEnter={() => router.prefetch('/operations/jobs/new')}
                    >
                      Create Job
                    </SharedButton>
                  </>
                )}
              </div>
            ) : loading ? (
              <JobListSkeleton />
            ) : (
              <div className="divide-y divide-white/5/50">
                {jobs.map((job, index) => (
                  <div
                    key={job.id}
                    className="group relative px-6 py-3.5 transition duration-200 hover:bg-white/5"
                  >
                    {/* Visual separator - subtle left border */}
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/5" />
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          <Link
                            href={`/operations/jobs/${job.id}`}
                            className="text-lg font-extrabold text-white hover:text-[#F97316] transition-colors cursor-pointer"
                          >
                            {job.client_name}
                          </Link>
                          <span className={`${getRiskBadgeClass(job.risk_level)} text-xs px-2 py-0.5`}>
                            {job.risk_level?.toUpperCase() || 'NO SCORE'}
                          </span>
                          <span className={`${getStatusBadgeClass(job.status)} text-xs px-2 py-0.5`}>
                            {job.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-white/55 mb-0.5">
                          {job.job_type} • {job.location}
                        </div>
                        <div className="text-xs text-white/55 mb-0.5">
                          Created {new Date(job.created_at).toLocaleDateString()}
                        </div>
                        {/* Readiness metrics and blockers */}
                        {((job as any).blockers_count !== undefined && (job as any).blockers_count > 0) && (
                          <div className="text-xs text-orange-400/80">
                            {(job as any).blockers_count} blocker{((job as any).blockers_count !== 1) ? 's' : ''}
                            {((job as any).readiness_score !== null && (job as any).readiness_score !== undefined) && (
                              <span className="text-white/50 ml-2">• Readiness: {(job as any).readiness_score}%</span>
                            )}
                            {((job as any).readiness_empty_reason === 'no_mitigations') && (
                              <span className="text-white/50 ml-2">• No mitigations</span>
                            )}
                          </div>
                        )}
                        {(job as any).missing_evidence && (
                          <div className="text-xs text-yellow-400/80">
                            Missing evidence
                          </div>
                        )}
                        {/* Next Required Action Hint (fallback) */}
                        {(job as any).incompleteMitigations > 0 && !((job as any).blockers_count !== undefined) && (
                          <div className="text-xs text-white/50">
                            {(job as any).incompleteMitigations} action{((job as any).incompleteMitigations !== 1) ? 's' : ''} required
                          </div>
                        )}
                        {(job as any).permitPacksAvailable && !(job as any).incompleteMitigations && (
                          <div className="text-xs text-white/50">
                            Permit pack available
                          </div>
                        )}
                      </div>
                      {job.risk_score !== null && (
                        <div className="text-right ml-6 flex-shrink-0">
                          <div className="flex items-baseline justify-end gap-1.5 mb-0.5">
                            <div className="text-3xl font-bold text-white">{job.risk_score}</div>
                            {/* Risk indicator - removed colored dot, using badge instead */}
                          </div>
                          <div className="text-xs text-white/50">Risk Score</div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            
            {/* Pagination Controls */}
            {jobsPagination && jobsPagination.total_pages && jobsPagination.total_pages > 1 && (
              <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/60">Page size:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value, 10))
                      setCurrentPage(1)
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-3 py-1.5 text-sm text-white/90 transition focus:outline-none focus:ring-1 focus:ring-white/20"
                  >
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <SharedButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </SharedButton>
                  
                  <span className="text-sm text-white/60 px-4">
                    Page {currentPage} of {jobsPagination.total_pages}
                  </span>
                  
                  <SharedButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(jobsPagination.total_pages || 1, p + 1))}
                    disabled={currentPage >= (jobsPagination.total_pages || 1)}
                  >
                    Next
                  </SharedButton>
                </div>
              </div>
            )}
          </GlassCard>
        </AppShell>

        {/* First-Run Setup Wizard */}
      <FirstRunSetupWizard
        isOpen={showOnboarding}
        onComplete={async () => {
          setShowOnboarding(false)
          // Reload data to reflect setup changes
          loadData()
        }}
        onSkip={async () => {
          setShowOnboarding(false)
          // Mark setup as skipped (but not completed)
          const supabase = createSupabaseBrowserClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await supabase
              .from('users')
              .update({ has_completed_onboarding: true })
              .eq('id', user.id)
          }
        }}
      />
        </AppBackground>
    </ProtectedRoute>
  )
}
