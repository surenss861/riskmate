'use client'

import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ProtectedRoute from '@/components/ProtectedRoute'
import { motion } from 'framer-motion'
import { jobsApi } from '@/lib/api'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { DataGrid } from '@/components/dashboard/DataGrid'

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

function JobsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('')
  const [filterTemplateSource, setFilterTemplateSource] = useState<string>('')
  const [filterTemplateId, setFilterTemplateId] = useState<string>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Initialize filters from URL params
  useEffect(() => {
    if (searchParams) {
      const source = searchParams.get('source') || ''
      const templateId = searchParams.get('templateId') || ''
      setFilterTemplateSource(source)
      setFilterTemplateId(templateId)
    }
  }, [searchParams])

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

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (!user) return

      const { data: userRow } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!userRow?.organization_id) return

      // Build query with template filters
      let query = supabase
        .from('jobs')
        .select('id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at, applied_template_id, applied_template_type', { count: 'exact' })
        .eq('organization_id', userRow.organization_id)
        .order('created_at', { ascending: false })
        .range((page - 1) * 50, page * 50 - 1)

      if (filterStatus) {
        query = query.eq('status', filterStatus)
      }

      if (filterRiskLevel) {
        query = query.eq('risk_level', filterRiskLevel)
      }

      if (filterTemplateSource === 'template') {
        query = query.not('applied_template_id', 'is', null)
      } else if (filterTemplateSource === 'manual') {
        query = query.is('applied_template_id', null)
      }

      if (filterTemplateId) {
        query = query.eq('applied_template_id', filterTemplateId)
      }

      const { data: jobsData, count, error } = await query

      if (error) throw error

      setJobs(jobsData || [])
      setTotalPages(Math.ceil((count || 0) / 50))
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load jobs:', err)
      setLoading(false)
    }
  }, [page, filterStatus, filterRiskLevel, filterTemplateSource, filterTemplateId])

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

  const pageContent = (
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
                <Link href="/dashboard/jobs" className="font-display text-4xl font-bold text-white md:text-5xl hover:text-[#F97316] transition-colors">
                  Job Roaster
                </Link>
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

            <select
              value={filterTemplateSource}
              onChange={(e) => {
                setFilterTemplateSource(e.target.value)
                setFilterTemplateId('') // Reset template filter when source changes
                setPage(1)
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white focus:border-white/25 focus:outline-none"
            >
              <option value="">All Sources</option>
              <option value="template">From Template</option>
              <option value="manual">Manual</option>
            </select>

            {filterTemplateSource === 'template' && templates.length > 0 && (
              <select
                value={filterTemplateId}
                onChange={(e) => {
                  setFilterTemplateId(e.target.value)
                  setPage(1)
                }}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white focus:border-white/25 focus:outline-none"
                disabled={loadingTemplates}
              >
                <option value="">All Templates</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            )}
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
            <DataGrid
              data={jobs}
              columns={[
                {
                  id: 'client_name',
                  header: 'Client Name',
                  accessor: (job) => job.client_name,
                  sortable: true,
                  render: (value, job) => (
                    <button
                      onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                      className="text-white hover:text-[#F97316] transition-colors font-semibold"
                    >
                      {value}
                    </button>
                  ),
                },
                {
                  id: 'job_type',
                  header: 'Job Type',
                  accessor: (job) => job.job_type,
                  sortable: true,
                },
                {
                  id: 'location',
                  header: 'Location',
                  accessor: (job) => job.location,
                  sortable: true,
                },
                {
                  id: 'status',
                  header: 'Status',
                  accessor: (job) => job.status,
                  sortable: true,
                  render: (value) => (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(value)}`}>
                      {value}
                    </span>
                  ),
                },
                {
                  id: 'risk_score',
                  header: 'Risk Score',
                  accessor: (job) => job.risk_score ?? '—',
                  sortable: true,
                  render: (value, job) => (
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{value}</div>
                      {job.risk_level && (
                        <div className={`text-xs ${getRiskColor(job.risk_level)}`}>
                          {job.risk_level.toUpperCase()}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'created_at',
                  header: 'Created',
                  accessor: (job) => formatDate(job.created_at),
                  sortable: true,
                },
              ]}
              onRowClick={(job) => router.push(`/dashboard/jobs/${job.id}`)}
              rowHighlight={(job) => {
                if (job.risk_score && job.risk_score > 80) return 'red-500'
                if (job.risk_score && job.risk_score > 60) return 'orange-500'
                return null
              }}
            />
          )}

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
        </div>
      </div>
    </div>
  )
}

export default function JobsPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316]" />
          </div>
        }
      >
        <JobsPageContent />
      </Suspense>
    </ProtectedRoute>
  )
}

