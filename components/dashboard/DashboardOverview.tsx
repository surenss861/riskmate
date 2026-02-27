'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KpiGrid, type KpiGridItem } from './KpiGrid'
import { InsightsPanel, type InsightItem } from './InsightsPanel'
import { AnalyticsTrendCharts } from './AnalyticsTrendCharts'
import { HazardFrequencyChart } from './HazardFrequencyChart'
import { RiskHeatmap } from './RiskHeatmap'
import { TeamPerformanceTable } from './TeamPerformanceTable'
import {
  buildDashboardCsv,
  downloadCsv,
  buildDashboardPdf,
  downloadPdf,
  type ExportKpi,
  type ExportInsight,
  type ExportTeamRow,
  type ExportHazardRow,
  type ExportTrendSummary,
} from '@/lib/utils/dashboardExport'

export type DashboardPeriod = '7d' | '30d' | '90d' | '1y' | 'custom'

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
]

export type CustomRange = { start: string; end: string }

/** Normalize ISO datetime or date string to YYYY-MM-DD for <input type="date">. */
function toDateOnly(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value
}

/** Format a Date as local YYYY-MM-DD for <input type="date"> (avoids UTC shift). */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function CustomDateRangePicker({
  customRange,
  onApply,
}: {
  customRange?: CustomRange | null
  onApply: (start: string, end: string) => void
}) {
  const defaultEnd = useMemo(() => toLocalDateString(new Date()), [])
  const defaultStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return toLocalDateString(d)
  }, [])
  const [start, setStart] = useState(() =>
    customRange?.start ? toLocalDateString(new Date(customRange.start)) : defaultStart
  )
  const [end, setEnd] = useState(() =>
    customRange?.end ? toLocalDateString(new Date(customRange.end)) : defaultEnd
  )
  useEffect(() => {
    if (customRange?.start) setStart(toLocalDateString(new Date(customRange.start)))
    if (customRange?.end) setEnd(toLocalDateString(new Date(customRange.end)))
  }, [customRange?.start, customRange?.end])
  const handleApply = () => {
    if (!start || !end || start > end) return
    // Normalize to start/end-of-day UTC only at apply time (interpret dates as local).
    const startIso = new Date(start + 'T00:00:00').toISOString()
    const endIso = new Date(end + 'T23:59:59.999').toISOString()
    onApply(startIso, endIso)
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#F97316]"
        aria-label="Start date"
      />
      <span className="text-white/50 text-sm">to</span>
      <input
        type="date"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#F97316]"
        aria-label="End date"
      />
      <button
        type="button"
        onClick={handleApply}
        className="rounded-lg bg-[#F97316] px-3 py-2 text-sm font-medium text-black hover:bg-[#F97316]/90 transition-colors"
      >
        Apply
      </button>
    </div>
  )
}

export type EnhancedAnalyticsProps = {
  period: DashboardPeriod
  onPeriodChange: (period: DashboardPeriod, customRange?: CustomRange) => void
  periodLabel: string
  /** When period is 'custom', the selected range for charts and KPIs. */
  customRange?: CustomRange | null
  kpiItems: KpiGridItem[]
  insights: InsightItem[]
  insightsLoading: boolean
  trendsJobs: { data: Array<{ period: string; value: number; label?: string }> } | null
  trendsRisk: { data: Array<{ period: string; value: number; label?: string }> } | null
  trendsCompletion: { data: Array<{ period: string; value: number; label?: string }> } | null
  /** Real completed counts per period (by completion date); when set, chart uses these for completed series. */
  trendsCompletedCounts?: { data: Array<{ period: string; value: number; label?: string }> } | null
  jobCountsByStatus: Record<string, number>
  /** Weekly (or daily) job status counts per period for Jobs-by-status chart; valid ISO period for drill-down. */
  statusByPeriod?: Array<{ period: string; [status: string]: string | number }>
  /** When statusByPeriod is absent, range for Jobs-by-status bar drill-down (start/end YYYY-MM-DD or ISO). */
  periodRangeStart?: string
  periodRangeEnd?: string
  hazardItems: Array<{ category: string; count: number; avg_risk: number; trend: 'up' | 'down' | 'neutral' }>
  /** Risk heatmap buckets: job_type × day_of_week (0=Sun..6=Sat) with avg_risk and count. */
  riskHeatmap?: { period: string; buckets: Array<{ job_type: string; day_of_week: number; avg_risk: number; count: number }> } | null
  teamMembers: Array<{
    user_id: string
    name: string
    jobs_assigned: number
    jobs_completed: number
    completion_rate: number
    avg_days: number
    overdue_count: number
  }>
  isLoading: boolean
  onPeriodClick?: (period: string, opts?: { useCompletionDate?: boolean; rangeEnd?: string }) => void
  onStatusClick?: (status: string, period?: string, opts?: { rangeEnd?: string }) => void
  onHazardCategoryClick?: (category: string) => void
}

interface DashboardOverviewProps {
  todaysJobs: Array<{
    id: string
    client_name: string
    risk_score: number | null
    status: string
  }>
  jobsAtRisk: Array<{
    id: string
    client_name: string
    risk_score: number
    risk_level: string
  }>
  recentEvidence: Array<{
    id: string
    job_id: string
    job_name: string
    uploaded_at: string
    type: string
  }>
  incompleteMitigations: Array<{
    id: string
    job_id: string
    job_name: string
    title: string
    created_at: string
  }>
  workforceActivity: Array<{
    user_id: string
    name: string
    last_login: string
    jobs_assigned: number
  }>
  complianceTrend: Array<{
    date: string
    rate: number
  }>
  timeRange?: string
  /** When set, shows enhanced analytics layout: KPIs → Insights → Charts → Tables + Export */
  enhancedAnalytics?: EnhancedAnalyticsProps
}

export function DashboardOverview({
  todaysJobs,
  jobsAtRisk,
  recentEvidence,
  incompleteMitigations,
  workforceActivity,
  complianceTrend,
  timeRange = '30d',
  enhancedAnalytics,
}: DashboardOverviewProps) {
  const router = useRouter()
  const timeRangeParam = timeRange ? `time_range=${timeRange}` : ''
  // Show custom date picker when user selects "Custom" from dropdown without calling parent until they apply a range.
  const [customPickerOpen, setCustomPickerOpen] = useState(false)

  const handleExportCSV = () => {
    if (!enhancedAnalytics) return
    const kpis: ExportKpi[] = enhancedAnalytics.kpiItems.map((k) => ({
      title: k.title,
      value: `${k.prefix ?? ''}${k.value}${k.suffix ?? ''}`,
    }))
    const insights: ExportInsight[] = enhancedAnalytics.insights.map((i) => ({
      title: i.title,
      description: i.description,
      severity: i.severity,
    }))
    const team: ExportTeamRow[] = enhancedAnalytics.teamMembers.map((m) => ({
      name: m.name,
      assigned: m.jobs_assigned,
      completed: m.jobs_completed,
      rate: m.completion_rate,
      avgDays: m.avg_days,
      overdue: m.overdue_count,
    }))
    const hazards: ExportHazardRow[] = enhancedAnalytics.hazardItems.map((h) => ({
      category: h.category,
      count: h.count,
      avgRisk: h.avg_risk,
    }))
    // When only aggregate counts exist (no per-period data), synthesize one status-by-period row so export mirrors the on-screen Jobs-by-status chart
    const jobCounts = enhancedAnalytics.jobCountsByStatus ?? {}
    const hasStatusAggregate = Object.keys(jobCounts).length > 0
    const statusByPeriodForCsv =
      (enhancedAnalytics.statusByPeriod && enhancedAnalytics.statusByPeriod.length > 0)
        ? enhancedAnalytics.statusByPeriod
        : hasStatusAggregate
          ? [{ period: enhancedAnalytics.periodLabel, ...jobCounts }]
          : undefined
    const csv = buildDashboardCsv({
      periodLabel: enhancedAnalytics.periodLabel,
      kpis,
      insights,
      team,
      hazards,
      trendJobsCreated: enhancedAnalytics.trendsJobs?.data ?? undefined,
      trendJobsCompleted: enhancedAnalytics.trendsCompletedCounts?.data ?? undefined,
      trendCompletionPct: enhancedAnalytics.trendsCompletion?.data ?? undefined,
      trendRisk: enhancedAnalytics.trendsRisk?.data ?? undefined,
      statusByPeriod: statusByPeriodForCsv,
    })
    downloadCsv(csv, enhancedAnalytics.periodLabel)
  }

  const handleExportPDF = async () => {
    if (!enhancedAnalytics) return
    const kpis: ExportKpi[] = enhancedAnalytics.kpiItems.map((k) => ({
      title: k.title,
      value: `${k.prefix ?? ''}${k.value}${k.suffix ?? ''}`,
    }))
    const insights: ExportInsight[] = enhancedAnalytics.insights.map((i) => ({
      title: i.title,
      description: i.description,
      severity: i.severity,
    }))
    const trendSummaries: ExportTrendSummary[] = []
    const jobsData = enhancedAnalytics.trendsJobs?.data ?? []
    const riskData = enhancedAnalytics.trendsRisk?.data ?? []
    const completionData = enhancedAnalytics.trendsCompletion?.data ?? []
    if (jobsData.length > 0) {
      const totalCreated = jobsData.reduce((a, p) => a + p.value, 0)
      trendSummaries.push({ label: 'Jobs (period)', value: String(totalCreated) })
    }
    if (riskData.length > 0) {
      const avgRisk = riskData.reduce((a, p) => a + p.value, 0) / riskData.length
      trendSummaries.push({ label: 'Avg risk (trend)', value: avgRisk.toFixed(1) })
    }
    if (completionData.length > 0) {
      const avgComp = completionData.reduce((a, p) => a + p.value, 0) / completionData.length
      trendSummaries.push({ label: 'Completion % (trend)', value: `${avgComp.toFixed(0)}%` })
    }
    const hazards: ExportHazardRow[] = enhancedAnalytics.hazardItems.slice(0, 10).map((h) => ({
      category: h.category,
      count: h.count,
      avgRisk: h.avg_risk,
    }))
    const team: ExportTeamRow[] = enhancedAnalytics.teamMembers.map((m) => ({
      name: m.name,
      assigned: m.jobs_assigned,
      completed: m.jobs_completed,
      rate: m.completion_rate,
      avgDays: m.avg_days,
      overdue: m.overdue_count,
    }))
    const pdfBytes = await buildDashboardPdf({
      periodLabel: enhancedAnalytics.periodLabel,
      kpis,
      insights,
      trendSummaries: trendSummaries.length > 0 ? trendSummaries : undefined,
      hazards: hazards.length > 0 ? hazards : undefined,
      team: team.length > 0 ? team : undefined,
    })
    downloadPdf(pdfBytes, enhancedAnalytics.periodLabel)
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Analytics: period selector, export, KPIs → Insights → Charts → Tables */}
      {enhancedAnalytics && (
        <section className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-semibold text-white">Analytics</h2>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={enhancedAnalytics.period === 'custom' || customPickerOpen ? 'custom' : enhancedAnalytics.period}
                onChange={(e) => {
                  const p = e.target.value as DashboardPeriod
                  if (p !== 'custom') {
                    setCustomPickerOpen(false)
                    enhancedAnalytics.onPeriodChange(p)
                  } else {
                    setCustomPickerOpen(true)
                    // Do not call onPeriodChange('custom') until user applies a range in CustomDateRangePicker
                  }
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                aria-label="Time period"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {(enhancedAnalytics.period === 'custom' || customPickerOpen) && (
                <CustomDateRangePicker
                  customRange={enhancedAnalytics.customRange}
                  onApply={(start, end) => {
                    setCustomPickerOpen(false)
                    enhancedAnalytics.onPeriodChange('custom', { start, end })
                  }}
                />
              )}
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={enhancedAnalytics.isLoading}
                  className="px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/5 border-r border-white/10 disabled:opacity-50"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPDF()}
                  disabled={enhancedAnalytics.isLoading}
                  className="px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/5 disabled:opacity-50"
                >
                  Export PDF
                </button>
              </div>
            </div>
          </div>

          <KpiGrid items={enhancedAnalytics.kpiItems} />

          <InsightsPanel
            insights={enhancedAnalytics.insights}
            isLoading={enhancedAnalytics.insightsLoading}
            viewAllHref={
              enhancedAnalytics.period === 'custom' && enhancedAnalytics.customRange
                ? `/operations?time_range=custom&range_start=${enhancedAnalytics.customRange.start.slice(0, 10)}&range_end=${enhancedAnalytics.customRange.end.slice(0, 10)}`
                : `/operations?time_range=${enhancedAnalytics.period}`
            }
          />

          <AnalyticsTrendCharts
            trendsJobs={enhancedAnalytics.trendsJobs}
            trendsCompletion={enhancedAnalytics.trendsCompletion}
            trendsCompletedCounts={enhancedAnalytics.trendsCompletedCounts}
            trendsRisk={enhancedAnalytics.trendsRisk}
            jobCountsByStatus={enhancedAnalytics.jobCountsByStatus}
            statusByPeriod={enhancedAnalytics.statusByPeriod}
            periodLabel={enhancedAnalytics.periodLabel}
            periodRangeStart={enhancedAnalytics.periodRangeStart}
            periodRangeEnd={enhancedAnalytics.periodRangeEnd}
            isLoading={enhancedAnalytics.isLoading}
            onPeriodClick={enhancedAnalytics.onPeriodClick}
            onStatusClick={enhancedAnalytics.onStatusClick}
          />

          {enhancedAnalytics.riskHeatmap != null && (
            <RiskHeatmap
              periodLabel={enhancedAnalytics.periodLabel}
              buckets={enhancedAnalytics.riskHeatmap.buckets ?? []}
              isLoading={enhancedAnalytics.isLoading}
            />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <HazardFrequencyChart
              items={enhancedAnalytics.hazardItems}
              periodLabel={enhancedAnalytics.periodLabel}
              isLoading={enhancedAnalytics.isLoading}
              onCategoryClick={enhancedAnalytics.onHazardCategoryClick}
            />
            <TeamPerformanceTable
              members={enhancedAnalytics.teamMembers}
              periodLabel={enhancedAnalytics.periodLabel}
              isLoading={enhancedAnalytics.isLoading}
            />
          </div>
        </section>
      )}

      {/* What Needs Your Attention */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">What Needs Your Attention</h2>
            <p className="text-sm text-white/60 mt-1">
              A quick overview of today&apos;s priorities and recent activity
            </p>
          </div>
          <Link
            href="/operations/jobs"
            className="text-sm text-[#F97316] hover:text-[#FB923C] transition-colors"
          >
            View All Jobs →
          </Link>
        </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Today's Jobs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Today&apos;s Jobs</h3>
              <p className="text-xs text-white/50 mt-0.5">
                Jobs scheduled for today based on your team&apos;s workload.
              </p>
            </div>
            <span className="text-2xl font-bold text-[#F97316]">{todaysJobs.length}</span>
          </div>
          <div className="space-y-2">
            {todaysJobs.length === 0 ? (
              <p className="text-sm text-white/50">No jobs scheduled for today</p>
            ) : (
              todaysJobs.slice(0, 3).map((job) => (
                <Link
                  key={job.id}
                  href={`/operations/jobs/${job.id}`}
                  className="block p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/80 truncate">{job.client_name}</span>
                    {job.risk_score !== null && (
                      <span className="text-xs text-white/50">{job.risk_score}</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>

        {/* Jobs at Risk */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Jobs at Risk</h3>
              <p className="text-xs text-white/50 mt-0.5">
                Jobs with high or critical risk scores. Review hazards before work continues.
              </p>
            </div>
            <span className="text-2xl font-bold text-red-400">{jobsAtRisk.length}</span>
          </div>
          <div className="space-y-2">
            {jobsAtRisk.length === 0 ? (
              <>
                <p className="text-sm text-white/50 mb-3">All clear — no high-risk jobs</p>
                <Link
                  href={`/operations/jobs?${timeRangeParam}`}
                  className="text-xs text-[#F97316] hover:text-[#FB923C] transition-colors inline-block"
                >
                  View all jobs →
                </Link>
              </>
            ) : (
              <>
                {jobsAtRisk.slice(0, 3).map((job) => (
                  <Link
                    key={job.id}
                    href={`/operations/jobs/${job.id}`}
                    className="block p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/80 truncate">{job.client_name}</span>
                      <span className="text-xs font-semibold text-red-400">{job.risk_score}</span>
                    </div>
                  </Link>
                ))}
                {jobsAtRisk.length > 3 && (
                  <Link
                    href={`/operations/jobs?risk_level=high&${timeRangeParam}`}
                    className="text-xs text-[#F97316] hover:text-[#FB923C] transition-colors inline-block mt-2"
                  >
                    View all {jobsAtRisk.length} high-risk jobs →
                  </Link>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* Recently Uploaded Evidence */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Recent Evidence</h3>
              <p className="text-xs text-white/50 mt-0.5">
                The latest photos and documents your team captured in the field.
              </p>
            </div>
            <span className="text-sm text-white/50">Last 24h</span>
          </div>
          <div className="space-y-2">
            {recentEvidence.length === 0 ? (
              <>
                <p className="text-sm text-white/50 mb-3">No evidence uploaded recently</p>
                <Link
                  href={`/operations/jobs?missing_evidence=true&${timeRangeParam}`}
                  className="text-xs text-[#F97316] hover:text-[#FB923C] transition-colors inline-block"
                >
                  Upload evidence →
                </Link>
              </>
            ) : (
              <>
                {recentEvidence.slice(0, 3).map((evidence) => (
                  <Link
                    key={evidence.id}
                    href={`/operations/jobs/${evidence.job_id}`}
                    className="block p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/80 truncate">{evidence.job_name}</span>
                      <span className="text-xs text-white/50 capitalize">{evidence.type}</span>
                    </div>
                  </Link>
                ))}
                <Link
                  href={`/operations/jobs?missing_evidence=true&${timeRangeParam}`}
                  className="text-xs text-[#F97316] hover:text-[#FB923C] transition-colors inline-block mt-2"
                >
                  Upload more evidence →
                </Link>
              </>
            )}
          </div>
        </motion.div>

        {/* Incomplete Mitigations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Incomplete Mitigations</h3>
              <p className="text-xs text-white/50 mt-0.5">
                Outstanding safety actions that need completion before closing the job.
              </p>
            </div>
            <span className="text-2xl font-bold text-yellow-400">{incompleteMitigations.length}</span>
          </div>
          <div className="space-y-2">
            {incompleteMitigations.length === 0 ? (
              <>
                <p className="text-sm text-white/50 mb-3">All mitigations complete</p>
                <Link
                  href={`/operations/jobs?${timeRangeParam}`}
                  className="text-xs text-[#F97316] hover:text-[#FB923C] transition-colors inline-block"
                >
                  View all jobs →
                </Link>
              </>
            ) : (
              <>
                {incompleteMitigations.slice(0, 3).map((mitigation) => (
                  <Link
                    key={mitigation.id}
                    href={`/operations/jobs/${mitigation.job_id}`}
                    className="block p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-white/80 truncate">{mitigation.job_name}</span>
                      <span className="text-xs text-white/50 truncate">{mitigation.title}</span>
                    </div>
                  </Link>
                ))}
                {incompleteMitigations.length > 3 && (
                  <Link
                    href={`/operations/audit/readiness?status=open&${timeRangeParam}`}
                    className="text-xs text-[#F97316] hover:text-[#FB923C] transition-colors inline-block mt-2"
                  >
                    View all {incompleteMitigations.length} incomplete →
                  </Link>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* Compliance Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Compliance Trend</h3>
              <p className="text-xs text-white/50 mt-0.5">
                How consistently your organization is meeting safety standards.
              </p>
            </div>
            <span className="text-sm text-white/50">Last 7 days</span>
          </div>
          {complianceTrend.length === 0 ? (
            <p className="text-sm text-white/50">No data available</p>
          ) : (
            <div className="h-32 flex items-end gap-2">
              {complianceTrend.slice(-7).map((point, i) => {
                // Get last 7 days only and format correctly
                const date = new Date(point.date)
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center"
                    style={{ minHeight: '4px', height: `${Math.max(point.rate * 100, 4)}%` }}
                  >
                    <div className="w-full bg-gradient-to-t from-[#F97316] to-[#FF8A3D] rounded-t" />
                    <span className="text-xs text-white/50 mt-1">
                      {dayName}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Workforce Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Workforce Activity</h3>
              <p className="text-xs text-white/50 mt-0.5">
                Live view of team engagement and recent job interactions.
              </p>
            </div>
            <span className="text-sm text-white/50">{workforceActivity.length} active</span>
          </div>
          <div className="space-y-2">
            {workforceActivity.length === 0 ? (
              <>
                <p className="text-sm text-white/50 mb-3">No activity data</p>
                <Link
                  href={`/operations/team?${timeRangeParam}`}
                  className="text-xs text-[#F97316] hover:text-[#FB923C] transition-colors inline-block"
                >
                  Invite team →
                </Link>
              </>
            ) : (
              <>
                {workforceActivity.slice(0, 3).map((worker) => (
                  <div key={worker.user_id} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-white/80">{worker.name}</span>
                        <p className="text-xs text-white/50">
                          {worker.jobs_assigned} job{worker.jobs_assigned !== 1 ? 's' : ''} assigned
                        </p>
                      </div>
                      <span className="text-xs text-white/50">
                        {new Date(worker.last_login).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
                <Link
                  href={`/operations/audit?tab=operations&${timeRangeParam}`}
                  className="text-xs text-[#F97316] hover:text-[#FB923C] transition-colors inline-block mt-2"
                >
                  View workforce activity →
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
      </section>
    </div>
  )
}

