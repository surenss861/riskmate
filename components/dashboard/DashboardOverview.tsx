'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
}

export function DashboardOverview({
  todaysJobs,
  jobsAtRisk,
  recentEvidence,
  incompleteMitigations,
  workforceActivity,
  complianceTrend,
}: DashboardOverviewProps) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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

      {/* Grid Layout */}
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
          className="rounded-xl border border-red-500/30 bg-red-500/5 backdrop-blur-sm p-6"
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
              <p className="text-sm text-white/50">No high-risk jobs</p>
            ) : (
              jobsAtRisk.slice(0, 3).map((job) => (
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
              ))
            )}
          </div>
        </motion.div>

        {/* Recently Uploaded Evidence */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6"
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
              <p className="text-sm text-white/50">No evidence uploaded recently</p>
            ) : (
              recentEvidence.slice(0, 3).map((evidence) => (
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
              ))
            )}
          </div>
        </motion.div>

        {/* Incomplete Mitigations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm p-6"
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
              <p className="text-sm text-white/50">All mitigations complete</p>
            ) : (
              incompleteMitigations.slice(0, 3).map((mitigation) => (
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
              ))
            )}
          </div>
        </motion.div>

        {/* Compliance Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6"
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
              {complianceTrend.map((point, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center"
                  style={{ height: `${point.rate * 100}%` }}
                >
                  <div className="w-full bg-gradient-to-t from-[#F97316] to-[#FF8A3D] rounded-t" />
                  <span className="text-xs text-white/50 mt-1">
                    {new Date(point.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Workforce Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6"
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
              <p className="text-sm text-white/50">No activity data</p>
            ) : (
              workforceActivity.slice(0, 3).map((worker) => (
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
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

