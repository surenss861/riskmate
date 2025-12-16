'use client'

import React, { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { DataGrid } from '@/components/dashboard/DataGrid'
import { ConfirmationModal } from '@/components/dashboard/ConfirmationModal'
import { Toast } from '@/components/dashboard/Toast'
import { jobsApi } from '@/lib/api'
import { typography, buttonStyles, spacing } from '@/lib/styles/design-system'
import { hasPermission } from '@/lib/utils/permissions'

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
  userRole: 'owner' | 'admin' | 'member'
  onJobArchived: () => void
  onJobDeleted: () => void
  lastUpdated?: string
  sourceIndicator?: string
  mutateData?: { mutate: any; currentData: any }
}

export function JobsPageContentView(props: JobsPageContentProps) {
  const router = useRouter()
  const prefetchTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const activePrefetches = useRef<Set<string>>(new Set())
  const MAX_CONCURRENT_PREFETCHES = 2
  
  const [archiveModal, setArchiveModal] = useState<{ isOpen: boolean; jobId: string | null; jobName: string }>({
    isOpen: false,
    jobId: null,
    jobName: '',
  })
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; jobId: string | null; jobName: string }>({
    isOpen: false,
    jobId: null,
    jobName: '',
  })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  const canArchive = hasPermission(props.userRole, 'jobs.close')
  const canDelete = hasPermission(props.userRole, 'jobs.delete')

  const handleJobHover = (jobId: string) => {
    // Clear any existing timeout for this job
    const existingTimeout = prefetchTimeouts.current.get(jobId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Skip if already prefetching or at max concurrency
    if (activePrefetches.current.has(jobId) || activePrefetches.current.size >= MAX_CONCURRENT_PREFETCHES) {
      return
    }

    // Prefetch after 150ms hover delay
    const timeout = setTimeout(() => {
      if (activePrefetches.current.size < MAX_CONCURRENT_PREFETCHES) {
        activePrefetches.current.add(jobId)
        router.prefetch(`/operations/jobs/${jobId}`)
        // Clean up after a delay (prefetch is synchronous in Next.js)
        setTimeout(() => {
          activePrefetches.current.delete(jobId)
        }, 1000) // Remove from active set after 1s
      }
      prefetchTimeouts.current.delete(jobId)
    }, 150)

    prefetchTimeouts.current.set(jobId, timeout)
  }

  const handleJobHoverEnd = (jobId: string) => {
    // Clear timeout if user stops hovering before prefetch
    const timeout = prefetchTimeouts.current.get(jobId)
    if (timeout) {
      clearTimeout(timeout)
      prefetchTimeouts.current.delete(jobId)
    }
  }
  
  const handleArchive = async (jobId: string, jobName: string) => {
    setArchiveModal({ isOpen: true, jobId, jobName })
  }
  
  const confirmArchive = async () => {
    if (!archiveModal.jobId) return
    
    setLoading(true)
    
    // Store previous cache state for rollback (snapshot)
    const previousData = props.mutateData?.currentData ? JSON.parse(JSON.stringify(props.mutateData.currentData)) : null
    
    // Optimistic update: remove job from list immediately
    // Use functional mutate to prevent race conditions with concurrent updates
    if (props.mutateData?.mutate) {
      props.mutateData.mutate((current: any) => {
        if (!current) return current
        return {
          ...current,
          data: (current.data || []).filter((job: any) => job.id !== archiveModal.jobId),
          pagination: {
            ...current.pagination,
            total: Math.max(0, (current.pagination?.total || 0) - 1),
          },
        }
      }, { 
        optimisticData: true,
        rollbackOnError: true,
        revalidate: false, // Don't revalidate yet, wait for API response
      })
    }
    
    try {
      // Perform archive
      await jobsApi.archive(archiveModal.jobId)
      
      // Revalidate to get fresh data
      props.onJobArchived()
      
      setToast({ message: 'Job archived successfully', type: 'success' })
      setArchiveModal({ isOpen: false, jobId: null, jobName: '' })
    } catch (err: any) {
      // Rollback is handled by SWR's rollbackOnError, but we also restore previous state explicitly
      if (previousData && props.mutateData?.mutate) {
        props.mutateData.mutate(previousData, { revalidate: false })
      }
      // Then revalidate to ensure consistency
      props.onJobArchived()
      setToast({ 
        message: err?.message || 'Failed to archive job', 
        type: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleDelete = async (jobId: string, jobName: string) => {
    setDeleteModal({ isOpen: true, jobId, jobName })
  }
  
  const confirmDelete = async () => {
    if (!deleteModal.jobId) return
    
    setLoading(true)
    
    // Store previous cache state for rollback (snapshot)
    const previousData = props.mutateData?.currentData ? JSON.parse(JSON.stringify(props.mutateData.currentData)) : null
    
    // Optimistic update: remove job from list immediately
    // Use functional mutate to prevent race conditions with concurrent updates
    if (props.mutateData?.mutate) {
      props.mutateData.mutate((current: any) => {
        if (!current) return current
        return {
          ...current,
          data: (current.data || []).filter((job: any) => job.id !== deleteModal.jobId),
          pagination: {
            ...current.pagination,
            total: Math.max(0, (current.pagination?.total || 0) - 1),
          },
        }
      }, { 
        optimisticData: true,
        rollbackOnError: true,
        revalidate: false, // Don't revalidate yet, wait for API response
      })
    }
    
    try {
      // Perform delete
      await jobsApi.delete(deleteModal.jobId)
      
      // Revalidate to get fresh data
      props.onJobDeleted()
      
      setToast({ message: 'Job deleted successfully', type: 'success' })
      setDeleteModal({ isOpen: false, jobId: null, jobName: '' })
    } catch (err: any) {
      // Rollback is handled by SWR's rollbackOnError, but we also restore previous state explicitly
      if (previousData && props.mutateData?.mutate) {
        props.mutateData.mutate(previousData, { revalidate: false })
      }
      // Then revalidate to ensure consistency
      props.onJobDeleted()
      const errorMessage = err?.message || 'Failed to delete job'
      // Handle specific error codes
      if (err?.code === 'NOT_ELIGIBLE_FOR_DELETE' || 
          err?.code === 'HAS_AUDIT_HISTORY' || 
          err?.code === 'HAS_EVIDENCE' || 
          err?.code === 'HAS_RISK_ASSESSMENT' || 
          err?.code === 'HAS_REPORTS') {
        setToast({ message: errorMessage, type: 'error' })
      } else {
        setToast({ message: errorMessage, type: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }
  
  return (
        <div className="min-h-screen bg-[#0A0A0A] text-white">
      <DashboardNavbar 
        email={props.user?.email} 
        onLogout={async () => {
          const { cacheInvalidation } = await import('@/lib/cache')
          cacheInvalidation.clearAll()
          router.push('/')
        }} 
      />
      <div className="mx-auto max-w-7xl px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className={spacing.section}
        >
          <div className="flex items-center justify-between">
            <div>
                  <Link href="/operations/jobs" className={`${typography.h1} hover:text-[#F97316] transition-colors`}>
                    Job Roster
                  </Link>
                  <p className={`${spacing.tight} ${typography.bodyMuted}`}>
                    Your centralized job hub — track progress, hazards, documents, and generate audit-ready reports.
                  </p>
            </div>
              <button
                onClick={() => router.push('/operations/jobs/new')}
                className={`${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
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
              <p className={`text-white font-medium ${spacing.tight}`}>No jobs yet</p>
              <p className={`text-sm text-white/60 ${spacing.normal} max-w-md mx-auto`}>
                Jobs are where you track safety, document hazards, and generate audit-ready reports. Create your first job to get started.
              </p>
              <button
                onClick={() => router.push('/operations/jobs/new')}
                className={`${spacing.normal} ${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
              >
                Create Your First Job
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
                    onClick={() => router.push(`/operations/jobs/${job.id}`)}
                    onMouseEnter={() => handleJobHover(job.id)}
                    onMouseLeave={() => handleJobHoverEnd(job.id)}
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
              ...(canArchive || canDelete ? [{
                id: 'actions',
                header: 'Actions',
                accessor: () => '',
                sortable: false,
                width: '120px',
                render: (_: any, job: any) => (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {canArchive && job.status !== 'archived' && (
                      <button
                        onClick={() => handleArchive(job.id, job.client_name)}
                        className="px-3 py-1 text-xs text-white/70 hover:text-white border border-white/10 rounded hover:bg-white/5 transition-colors"
                        title="Archive job (preserves records for audit and compliance)"
                      >
                        Archive
                      </button>
                    )}
                    {canDelete && job.status === 'draft' && (
                      <button
                        onClick={() => handleDelete(job.id, job.client_name)}
                        className="px-3 py-1 text-xs text-red-400/70 hover:text-red-400 border border-red-500/20 rounded hover:bg-red-500/10 transition-colors"
                        title="Delete job (available only for draft jobs without audit data)"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ),
              }] : []),
            ]}
            onRowClick={(job: any) => router.push(`/operations/jobs/${job.id}`)}
            onRowHover={(job: any) => handleJobHover(job.id)}
            onRowHoverEnd={(job: any) => handleJobHoverEnd(job.id)}
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
      
      {/* Archive Confirmation Modal */}
      <ConfirmationModal
        isOpen={archiveModal.isOpen}
        title="Archive Job"
        message={`Archive "${archiveModal.jobName}"? This preserves records for audit and compliance. The job will become read-only.`}
        confirmLabel="Archive"
        cancelLabel="Cancel"
        variant="default"
        loading={loading}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveModal({ isOpen: false, jobId: null, jobName: '' })}
      />
      
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete Job"
        message={`Permanently delete "${deleteModal.jobName}"? This action cannot be undone. Only draft jobs without audit data can be deleted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={loading}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, jobId: null, jobName: '' })}
      />
      
      {/* Toast Notification */}
      {toast && (
        <Toast
          isOpen={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

