'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ProtectedRoute from '@/components/ProtectedRoute'
import { motion } from 'framer-motion'
import { jobsApi } from '@/lib/api'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'

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
}

export default function JobsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const loadJobs = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const jobsResponse = await jobsApi.list({
        page,
        status: filterStatus || undefined,
        risk_level: filterRiskLevel || undefined,
        limit: 50,
      })
      setJobs(jobsResponse.data)
      setTotalPages(jobsResponse.pagination?.totalPages || 1)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load jobs:', err)
      setLoading(false)
    }
  }, [page, filterStatus, filterRiskLevel])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

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
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'on-hold':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
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
    <ProtectedRoute>
      <div className="min-h-screen bg-[#050505] text-white">
        <DashboardNavbar email={user?.email} onLogout={() => router.push('/')} />
        <div className="mx-auto max-w-7xl px-6 py-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-4xl font-bold text-white md:text-5xl">
                  Job Roaster
                </h1>
                <p className="mt-2 text-white/60">
                  Your centralized job hub — track progress, hazards, documents, and generate audit-ready reports.
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard/jobs/new')}
                className="rounded-xl bg-gradient-to-r from-[#F97316] via-[#FF8A3D] to-[#FFD166] px-6 py-3 font-semibold text-black shadow-[0_18px_40px_rgba(249,115,22,0.35)] transition-transform hover:scale-105"
              >
                + New Job
              </button>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="mb-6 flex flex-wrap gap-4"
          >
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white focus:border-white/25 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on-hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={filterRiskLevel}
              onChange={(e) => {
                setFilterRiskLevel(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white focus:border-white/25 focus:outline-none"
            >
              <option value="">All Risk Levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </motion.div>

          {/* Jobs List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97316] border-t-transparent" />
            </div>
          ) : jobs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-white/10 bg-black/35 p-12 text-center"
            >
              <p className="text-white/60">No jobs found</p>
              <button
                onClick={() => router.push('/dashboard/jobs/new')}
                className="mt-4 rounded-lg bg-[#F97316] px-6 py-2 font-medium text-black hover:bg-[#FB923C]"
              >
                Create Your First Job
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="space-y-4"
            >
              {jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                  className="group cursor-pointer rounded-2xl border border-white/10 bg-black/35 p-6 transition-all hover:border-white/20 hover:bg-black/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">
                          {job.client_name}
                        </h3>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(job.status)}`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-white/60">
                        {job.job_type} • {job.location}
                      </p>
                      <p className="mt-2 text-xs text-white/40">
                        Created {formatDate(job.created_at)}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      {job.risk_score !== null && (
                        <div className="mb-2">
                          <div className="text-2xl font-bold text-white">
                            {job.risk_score}
                          </div>
                          <div
                            className={`text-xs font-medium ${getRiskColor(job.risk_level)}`}
                          >
                            {job.risk_level?.toUpperCase() || 'N/A'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
                  >
                    Previous
                  </button>
                  <span className="px-4 text-sm text-white/60">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
                  >
                    Next
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

