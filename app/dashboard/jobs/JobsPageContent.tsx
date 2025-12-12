'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { DataGrid } from '@/components/dashboard/DataGrid'
import { typography, buttonStyles, spacing } from '@/lib/styles/design-system'

interface JobsPageContentProps {
  user: any
  loading: boolean
  jobs: any[]
  filterStatus: string
  filterRiskLevel: string
  filterTemplateSource: string
  filterTemplateId: string
  templates: Array<{ id: string; name: string }>
  loadingTemplates: boolean
  page: number
  totalPages: number
  onFilterStatusChange: (value: string) => void
  onFilterRiskLevelChange: (value: string) => void
  onFilterTemplateSourceChange: (value: string) => void
  onFilterTemplateIdChange: (value: string) => void
  onPageChange: (page: number) => void
  getRiskColor: (riskLevel: string | null) => string
  getStatusColor: (status: string) => string
  formatDate: (dateString: string) => string
}

export function JobsPageContentView(props: JobsPageContentProps) {
  const router = useRouter()
  
  return (
        <div className="min-h-screen bg-[#0A0A0A] text-white">
      <DashboardNavbar email={props.user?.email} onLogout={() => router.push('/')} />
      <div className="mx-auto max-w-7xl px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className={spacing.section}
        >
          <div className="flex items-center justify-between">
            <div>
                  <Link href="/dashboard/jobs" className={`${typography.h1} hover:text-[#F97316] transition-colors`}>
                    Job Roaster
                  </Link>
                  <p className={`${spacing.tight} ${typography.bodyMuted}`}>
                    Your centralized job hub — track progress, hazards, documents, and generate audit-ready reports.
                  </p>
            </div>
              <button
                onClick={() => router.push('/dashboard/jobs/new')}
                className={`${buttonStyles.primary} ${buttonStyles.sizes.lg} transition-transform hover:scale-105`}
              >
                + Create Job
              </button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className={`${spacing.relaxed} flex flex-wrap ${spacing.gap.normal}`}
        >
          <select
            value={props.filterStatus}
            onChange={(e) => {
              props.onFilterStatusChange(e.target.value)
              props.onPageChange(1)
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
            value={props.filterRiskLevel}
            onChange={(e) => {
              props.onFilterRiskLevelChange(e.target.value)
              props.onPageChange(1)
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
            value={props.filterTemplateSource}
            onChange={(e) => {
              props.onFilterTemplateSourceChange(e.target.value)
              props.onFilterTemplateIdChange('')
              props.onPageChange(1)
            }}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white focus:border-white/25 focus:outline-none"
          >
            <option value="">All Sources</option>
            <option value="template">From Template</option>
            <option value="manual">Manual</option>
          </select>

          {props.filterTemplateSource === 'template' && props.templates.length > 0 && (
            <select
              value={props.filterTemplateId}
              onChange={(e) => {
                props.onFilterTemplateIdChange(e.target.value)
                props.onPageChange(1)
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white focus:border-white/25 focus:outline-none"
              disabled={props.loadingTemplates}
            >
              <option value="">All Templates</option>
              {props.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          )}
        </motion.div>

        {/* Jobs List */}
        {props.loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97316] border-t-transparent" />
          </div>
        ) : props.jobs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-white/10 bg-black/35 p-12 text-center"
            >
              <p className={`text-white/60 ${spacing.tight}`}>No jobs yet</p>
              <p className={`text-sm text-white/40 ${spacing.relaxed}`}>Create your first job to generate your first safety report.</p>
              <button
                onClick={() => router.push('/dashboard/jobs/new')}
                className={`${spacing.normal} ${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
              >
                Create Job
              </button>
            </motion.div>
        ) : (
          <DataGrid
            data={props.jobs}
            columns={[
              {
                id: 'client_name',
                header: 'Client Name',
                accessor: (job: any) => job.client_name,
                sortable: true,
                render: (value: string, job: any) => (
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
                accessor: (job: any) => job.job_type,
                sortable: true,
              },
              {
                id: 'location',
                header: 'Location',
                accessor: (job: any) => job.location,
                sortable: true,
              },
              {
                id: 'status',
                header: 'Status',
                accessor: (job: any) => job.status,
                sortable: true,
                render: (value: string) => (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${props.getStatusColor(value)}`}>
                    {value}
                  </span>
                ),
              },
              {
                id: 'risk_score',
                header: 'Risk Score',
                accessor: (job: any) => job.risk_score ?? '—',
                sortable: true,
                render: (value: string | number, job: any) => (
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{value}</div>
                    {job.risk_level && (
                      <div className={`text-xs ${props.getRiskColor(job.risk_level)}`}>
                        {job.risk_level.toUpperCase()}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                id: 'created_at',
                header: 'Created',
                accessor: (job: any) => props.formatDate(job.created_at),
                sortable: true,
              },
            ]}
            onRowClick={(job: any) => router.push(`/dashboard/jobs/${job.id}`)}
            rowHighlight={(job: any) => {
              if (job.risk_score && job.risk_score > 80) return 'red-500'
              if (job.risk_score && job.risk_score > 60) return 'orange-500'
              return null
            }}
          />
        )}

        {/* Pagination */}
        {props.totalPages > 1 && (
          <div className={`${spacing.section} flex items-center justify-center ${spacing.gap.tight}`}>
            <button
              onClick={() => props.onPageChange(Math.max(1, props.page - 1))}
              disabled={props.page === 1}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
            >
              Previous
            </button>
            <span className="px-4 text-sm text-white/60">
              Page {props.page} of {props.totalPages}
            </span>
            <button
              onClick={() => props.onPageChange(Math.min(props.totalPages, props.page + 1))}
              disabled={props.page === props.totalPages}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

