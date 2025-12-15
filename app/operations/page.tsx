'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ProtectedRoute from '@/components/ProtectedRoute'
import { motion } from 'framer-motion'
import { jobsApi, subscriptionsApi, riskApi } from '@/lib/api'
import UpgradeBanner from '@/components/UpgradeBanner'
import { useAnalytics } from '@/hooks/useAnalytics'
import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { TrendChart } from '@/components/dashboard/TrendChart'
import EvidenceWidget from '@/components/dashboard/EvidenceWidget'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { DashboardSkeleton, JobListSkeleton } from '@/components/dashboard/SkeletonLoader'
import { DashboardOverview } from '@/components/dashboard/DashboardOverview'
import { Changelog } from '@/components/dashboard/Changelog'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import Link from 'next/link'
import { getRiskBadgeClass, getStatusBadgeClass, buttonStyles, spacing, typography } from '@/lib/styles/design-system'

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
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [subscription, setSubscription] = useState<any>(null)
  const [hazards, setHazards] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('')
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false)
  const [analyticsRange, setAnalyticsRange] = useState<number>(30)
  const [showOnboarding, setShowOnboarding] = useState(false)

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

      // Load user role and onboarding status
      let role = 'member'
      if (user) {
        const { data: userRow } = await supabase
          .from('users')
          .select('role, has_completed_onboarding, onboarding_completed')
          .eq('id', user.id)
          .maybeSingle()
        role = userRow?.role ?? 'member'
        setUserRole(role)
        // Show onboarding only if user exists and explicitly hasn't completed it
        if (userRow) {
          const onboardingCompleted = userRow.has_completed_onboarding ?? userRow.onboarding_completed
          // Only show if explicitly false or null (not completed)
          setShowOnboarding(onboardingCompleted !== true)
        } else {
          // If user row doesn't exist yet, don't show onboarding
          // (user will be created on signup/signin, and onboarding will be handled then)
          setShowOnboarding(false)
        }
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
          limit: 50, // Show more jobs in Job Roster
        })
        
        if (jobsResponse?.data && Array.isArray(jobsResponse.data)) {
          // Fetch additional data for next action hints (mitigation items, permit packs)
          const jobsWithHints = await Promise.all(
            jobsResponse.data.map(async (job: Job) => {
              try {
                // Get incomplete mitigation count
                const { count: incompleteCount } = await supabase
                  .from('mitigation_items')
                  .select('*', { count: 'exact', head: true })
                  .eq('job_id', job.id)
                  .eq('done', false)
                
                // Check if permit pack is available (Business plan only)
                const permitPacksAvailable = subscriptionData?.tier === 'business'
                
                return {
                  ...job,
                  incompleteMitigations: incompleteCount || 0,
                  permitPacksAvailable,
                }
              } catch (err) {
                // If fetch fails, return job without hints
                return { ...job, incompleteMitigations: 0, permitPacksAvailable: false }
              }
            })
          )
          setJobs(jobsWithHints)
        } else {
          console.warn('Jobs API returned invalid data format:', jobsResponse)
          setJobs([])
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
  }, [filterStatus, filterRiskLevel])

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
      },
    ],
    [
      analyticsData.completion_rate,
      analyticsData.avg_time_to_close_hours,
      analyticsData.high_risk_jobs,
      analyticsData.evidence_count,
      analyticsError,
      analyticsLoading,
    ]
  )

  const handleRangeChange = (nextRange: number) => {
    if (nextRange === analyticsRange) return
    setAnalyticsRange(nextRange)
    refetchAnalytics()
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

  // Calculate KPI metrics for hero card
  const kpiMetrics = useMemo(() => {
    const activeJobs = jobs.filter(j => j.status === 'active' || j.status === 'in_progress').length
    const openRisks = jobs.filter(j => j.risk_score !== null && j.risk_score > 75).length
    const avgRiskScore = jobs.length > 0 && jobs.some(j => j.risk_score !== null)
      ? Math.round(jobs.filter(j => j.risk_score !== null).reduce((sum, j) => sum + (j.risk_score || 0), 0) / jobs.filter(j => j.risk_score !== null).length)
      : null
    // Audit events count would need to fetch from audit_logs - for now use placeholder
    const auditEvents30d = null // Would need to fetch from audit_logs table
    
    return {
      activeJobs,
      openRisks,
      avgRiskScore,
      auditEvents30d,
    }
  }, [jobs])

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardSkeleton />
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen overflow-hidden bg-[#0A0A0A] text-white">
        {/* Ambient Gradient Backdrop - Subtle like landing page */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.05),_transparent_55%)]" />
        </div>

        <DashboardNavbar email={user?.email} onLogout={handleLogout} />

        {/* Dashboard Content */}
        <div className="relative mx-auto max-w-7xl px-6 py-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className={`relative ${spacing.section} flex flex-wrap items-center justify-between ${spacing.gap.relaxed} rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm px-8 py-10`}
          >
            <div className="relative max-w-xl">
              <p className="text-xs uppercase tracking-[0.42em] text-white/50">
                Control Center
              </p>
              <h1 className={`${typography.h1} ${spacing.section}`}>
                Operations Dashboard
              </h1>
              <div className="mt-4 h-[2px] w-24 bg-gradient-to-r from-[#F97316] via-[#FFC857] to-transparent animate-soft-float" />
              <p className="mt-4 text-base text-white/65">
                Your safety activity at a glance — stay ahead of risks before they become problems.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="px-4 py-2 bg-[#121212] rounded-lg border border-white/5">
                  Audit-ready reports
                </span>
                <span className="px-4 py-2 bg-[#121212] rounded-lg border border-white/5">
                  Timestamped evidence
                </span>
                <span className="px-4 py-2 bg-[#121212] rounded-lg border border-white/5">
                  Compliance trail
                </span>
              </div>
              
              {/* KPI Strip - Quantitative signals */}
              <div className="mt-8 pt-6 border-t border-white/5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-2xl font-semibold text-white mb-1">{kpiMetrics.activeJobs}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Active Jobs</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-white mb-1">{kpiMetrics.openRisks}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Open Risks</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-white mb-1">
                      {kpiMetrics.avgRiskScore !== null ? kpiMetrics.avgRiskScore : '—'}
                    </div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Avg Risk Score</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-white mb-1">—</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Audit Events (30d)</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative flex flex-col items-end gap-3">
            <button
              onClick={() => router.push('/operations/jobs/new')}
              className={`${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
            >
              + New Job
            </button>
              <Link
                href="/operations/jobs"
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/10 rounded-lg hover:border-white/20 transition-colors font-medium text-sm"
              >
                View job roster →
              </Link>
          </div>
          </motion.div>

          {!isMember && showUpgradeBanner && (
            <UpgradeBanner
              message="You've reached your Starter plan limit. Upgrade to Pro for unlimited jobs."
              onDismiss={() => setShowUpgradeBanner(false)}
            />
          )}

          {/* KPI Tiles - Only for owners/admins */}
          {!isMember && (analyticsLocked ? (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className={`${spacing.section} rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm px-8 py-10 text-center`}
            >
              <p className="text-xs uppercase tracking-[0.36em] text-white/45">Analytics</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Upgrade to unlock live analytics</h2>
              <p className="mt-4 text-sm text-white/65 max-w-2xl mx-auto">
                The Business plan includes real-time mitigation metrics, evidence reporting, and compliance insights. Upgrade your plan to see live analytics here.
              </p>
              <div className="mt-6 flex flex-col gap-3 items-center">
                <button
                  onClick={() => router.push('/pricing#business')}
                  className={`${buttonStyles.primary} ${buttonStyles.sizes.md}`}
                >
                  Explore Business Plan
                </button>
                <button
                  onClick={() => router.push('/pricing')}
                  className="px-6 py-3 border border-white/10 rounded-lg hover:border-white/20 transition-colors font-medium text-sm"
                >
                  View all plans →
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className={`${spacing.relaxed} ${spacing.gap.relaxed}`}
            >
            <KpiGrid items={kpiItems} />
            <div className={`grid ${spacing.gap.relaxed} xl:grid-cols-[2fr_1fr]`}>
              <TrendChart
                data={analyticsData.trend}
                rangeDays={analyticsRange}
                onRangeChange={handleRangeChange}
                isLoading={analyticsLoading}
              />
              <EvidenceWidget
                totalJobs={totalJobsForRange}
                jobsWithEvidence={jobsWithEvidence}
                evidenceCount={analyticsData.evidence_count}
                avgTimeToFirstEvidenceHours={analyticsData.avg_time_to_first_evidence_hours}
                isLoading={analyticsLoading}
              />
            </div>
            </motion.div>
          ))}

          {/* Enhanced Dashboard Overview - Only for owners/admins */}
          {!isMember && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.45 }}
              className="mb-10"
            >
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
              />
            </motion.div>
          )}

          {/* Changelog - Only for owners/admins */}
          {!isMember && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.45 }}
              className="mb-10"
            >
              <Changelog />
            </motion.div>
          )}

          {/* Top Hazards - Only for owners/admins */}
          {!isMember && hazards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.45 }}
              className={`relative ${spacing.relaxed} rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6`}
            >
              <h2 className="text-xl font-semibold text-white">Top Hazards (Last 30 Days)</h2>
              <p className="mt-1 text-sm text-white/60">
                The most frequent risk signatures across your active jobs.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {hazards.map((hazard) => (
                  <div
                    key={hazard.code}
                    className="px-4 py-2 bg-[#121212] rounded-lg border border-white/5 text-sm text-white transition hover:border-white/10"
                  >
                    <span className="font-medium">{hazard.name}</span>
                    <span className="ml-2 text-xs text-white/55">({hazard.count}x)</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Job List */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
            className="rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-6">
              <div className="flex-1">
                <Link href="/operations/jobs">
                  <h2 className={`${typography.h2} hover:text-[#F97316] transition-colors cursor-pointer`}>Job Roster</h2>
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/40 uppercase tracking-wider">Filter</span>
                <div className="flex gap-3">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-lg border border-white/5 bg-[#121212]/80 px-4 py-2 text-sm text-white/80 transition focus:outline-none focus:ring-1 focus:ring-white/20"
                  >
                    <option value="">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <select
                    value={filterRiskLevel}
                    onChange={(e) => setFilterRiskLevel(e.target.value)}
                    className="rounded-lg border border-white/5 bg-[#121212]/80 px-4 py-2 text-sm text-white/80 transition focus:outline-none focus:ring-1 focus:ring-white/20"
                  >
                    <option value="">All Risk Levels</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
            </div>

            {jobs.length === 0 ? (
              <div className="px-12 py-16 text-center">
                <p className="mb-2 text-white font-medium">No active jobs</p>
                <p className="mb-6 text-sm text-white/60">
                  Create a job to begin compliance tracking.
                </p>
                <button
                  onClick={() => router.push('/operations/jobs/new')}
                  onMouseEnter={() => router.prefetch('/operations/jobs/new')}
                  className={`${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
                >
                  Create Job
                </button>
              </div>
            ) : loading ? (
              <JobListSkeleton />
            ) : (
              <div className="divide-y divide-white/5/50">
                {jobs.map((job, index) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                    className="group px-6 py-4 transition duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-1.5">
                          <Link
                            href={`/operations/jobs/${job.id}`}
                            className="text-lg font-semibold text-white hover:text-[#F97316] transition-colors cursor-pointer"
                          >
                            {job.client_name}
                          </Link>
                          <span className={getRiskBadgeClass(job.risk_level)}>
                            {job.risk_level?.toUpperCase() || 'NO SCORE'}
                          </span>
                          <span className={getStatusBadgeClass(job.status)}>
                            {job.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-white/70 mb-1">
                          {job.job_type} • {job.location}
                        </div>
                        <div className="text-xs text-white/50 mb-1">
                          Created {new Date(job.created_at).toLocaleDateString()}
                        </div>
                        {/* Next Required Action Hint */}
                        {(job as any).incompleteMitigations > 0 && (
                          <div className="text-xs text-white/50">
                            {(job as any).incompleteMitigations} mitigation item{((job as any).incompleteMitigations !== 1) ? 's' : ''} remaining
                          </div>
                        )}
                        {(job as any).permitPacksAvailable && !(job as any).incompleteMitigations && (
                          <div className="text-xs text-white/50">
                            Permit pack available
                          </div>
                        )}
                      </div>
                      {job.risk_score !== null && (
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <div className="text-3xl font-bold text-white">{job.risk_score}</div>
                              {/* Risk indicator dot */}
                              <div className={`w-2 h-2 rounded-full ${
                                (job.risk_level || '').toLowerCase() === 'low' ? 'bg-green-400' :
                                (job.risk_level || '').toLowerCase() === 'medium' ? 'bg-yellow-400' :
                                (job.risk_level || '').toLowerCase() === 'high' ? 'bg-orange-400' :
                                (job.risk_level || '').toLowerCase() === 'critical' ? 'bg-red-400' :
                                'bg-white/20'
                              }`} />
                            </div>
                            <div className="text-xs text-white/50 mt-0.5">Risk Score</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Onboarding Wizard */}
      <OnboardingWizard
        isOpen={showOnboarding}
        onComplete={async () => {
          setShowOnboarding(false)
          // Mark onboarding as completed
          const supabase = createSupabaseBrowserClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { error } = await supabase
              .from('users')
              .update({ has_completed_onboarding: true })
              .eq('id', user.id)
            
            if (error) {
              console.error('Failed to update onboarding status:', error)
              // Still hide the onboarding even if update fails
            }
          }
        }}
        onSkip={async () => {
          setShowOnboarding(false)
          // Also mark as completed when skipped
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
    </ProtectedRoute>
  )
}
