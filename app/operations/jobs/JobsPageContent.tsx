'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { DataGrid } from '@/components/dashboard/DataGrid'
import { ConfirmationModal } from '@/components/dashboard/ConfirmationModal'
import { Toast } from '@/components/dashboard/Toast'
import { JobRosterSelect } from '@/components/dashboard/JobRosterSelect'
import { BulkActionsToolbar } from '@/components/jobs/BulkActionsToolbar'
import { BulkStatusModal } from '@/components/jobs/BulkStatusModal'
import { BulkAssignModal } from '@/components/jobs/BulkAssignModal'
import { BulkDeleteConfirmation } from '@/components/jobs/BulkDeleteConfirmation'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { jobsApi } from '@/lib/api'
import { hasPermission } from '@/lib/utils/permissions'
import { exportJobs } from '@/lib/utils/exportJobs'
import { AppBackground, AppShell, PageHeader, PageSection, GlassCard, Button } from '@/components/shared'

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
  const [executiveView, setExecutiveView] = useState(false)
  const [showKeyboardHint, setShowKeyboardHint] = useState(false)
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false)
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [exportInFlight, setExportInFlight] = useState(false)

  const bulk = useBulkSelection(props.jobs)
  
  const canArchive = hasPermission(props.userRole, 'jobs.close')
  const canDelete = hasPermission(props.userRole, 'jobs.delete')
  const canAssign = hasPermission(props.userRole, 'jobs.edit')
  const canChangeStatus = hasPermission(props.userRole, 'jobs.edit')
  
  // Show keyboard hint once per user
  React.useEffect(() => {
    const hasSeenHint = localStorage.getItem('riskMate_keyboardHint_seen')
    if (!hasSeenHint && props.jobs.length > 0) {
      setShowKeyboardHint(true)
      const timer = setTimeout(() => {
        setShowKeyboardHint(false)
        localStorage.setItem('riskMate_keyboardHint_seen', 'true')
      }, 5000) // Show for 5 seconds
      return () => clearTimeout(timer)
    }
  }, [props.jobs.length])

  // Cmd+A / Ctrl+A: select all jobs when not in an input
  const toggleAll = bulk.toggleAll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        if (props.jobs.length > 0) toggleAll()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [props.jobs.length, toggleAll])
  
  // Calculate risk trend (simple heuristic: compare current risk to a baseline)
  // For now, we'll use a simple indicator based on risk level changes
  const getRiskTrend = (job: any): '↑' | '→' | '↓' | null => {
    if (!job.risk_score || job.risk_score === 0) return null
    // Simple heuristic: if risk_score is high and recently updated, it's increasing
    // If risk_score is low or medium, it's stable or improving
    // This is a placeholder - in production, you'd compare against historical data
    if (job.risk_score >= 70) {
      // High risk jobs are likely increasing
      return '↑'
    } else if (job.risk_score >= 40) {
      // Medium risk is stable
      return '→'
    } else {
      // Low risk is improving
      return '↓'
    }
  }
  
  // Actions column component (needs hooks)
  const ActionsCell = ({ job }: { job: any }) => {
    const [showMoreMenu, setShowMoreMenu] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setShowMoreMenu(false)
        }
      }
      if (showMoreMenu) {
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [showMoreMenu])
    
    const hasArchive = canArchive && job.status !== 'archived'
    const hasDelete = canDelete && job.status === 'draft'
    
    if (!hasArchive && !hasDelete) return null
    
    return (
      <div className="relative flex items-center gap-2" onClick={(e) => e.stopPropagation()} ref={menuRef}>
        {hasArchive && (
          <button
            onClick={() => handleArchive(job.id, job.client_name)}
            className="px-3 py-1 text-xs text-white/70 hover:text-white border border-white/10 rounded hover:bg-white/5 transition-colors"
            title="Archive job (preserves records for audit and compliance)"
          >
            Archive
          </button>
        )}
        {hasDelete && (
          <>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="px-2 py-1 text-xs text-white/50 hover:text-white/70 transition-colors"
              title="More actions"
            >
              ⋯
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-lg z-10 min-w-[140px]">
                <button
                  onClick={() => {
                    setShowMoreMenu(false)
                    handleDelete(job.id, job.client_name)
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors first:rounded-t-lg last:rounded-b-lg"
                  title="Delete job (available only for draft jobs without audit data)"
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

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
      
      setToast({ 
        message: `Work record archived. Entry added to Compliance Ledger. [View in Ledger](${`/operations/audit?job_id=${archiveModal.jobId}`})`, 
        type: 'success'
      })
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
      
      setToast({ 
        message: `Work record deleted. Entry added to Compliance Ledger. [View in Ledger](/operations/audit)`, 
        type: 'success' 
      })
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

  const handleBulkStatusChange = async (status: import('@/components/jobs/BulkStatusModal').BulkStatusValue) => {
    const ids = bulk.selectedItems.map((j) => j.id)
    const previousData = props.mutateData?.currentData ? JSON.parse(JSON.stringify(props.mutateData.currentData)) : null
    if (props.mutateData?.mutate) {
      props.mutateData.mutate((current: any) => {
        if (!current?.data) return current
        return {
          ...current,
          data: current.data.map((job: any) =>
            ids.includes(job.id) ? { ...job, status } : job
          ),
        }
      }, { optimisticData: true, rollbackOnError: true, revalidate: false })
    }
    setBulkActionLoading(true)
    try {
      const { data } = await jobsApi.bulkStatus(ids, status)
      const { succeeded, failed } = data
      props.onJobArchived()
      if (failed.length === 0) {
        bulk.clearSelection()
        setBulkStatusModalOpen(false)
        setToast({ message: `${succeeded.length} job${succeeded.length !== 1 ? 's' : ''} updated to ${status.replace('_', ' ')}`, type: 'success' })
      } else {
        if (previousData && props.mutateData?.mutate) {
          props.mutateData.mutate(previousData, { revalidate: false })
        }
        props.onJobArchived()
        bulk.setSelection(failed.map((f: { id: string }) => f.id))
        setBulkStatusModalOpen(true)
        if (succeeded.length > 0) {
          setToast({ message: `${succeeded.length} updated, ${failed.length} failed. Retry or adjust selection.`, type: 'error' })
        } else {
          setToast({ message: failed[0]?.message || 'Failed to update jobs. Retry or adjust selection.', type: 'error' })
        }
      }
    } catch (err: any) {
      if (previousData && props.mutateData?.mutate) {
        props.mutateData.mutate(previousData, { revalidate: false })
      }
      props.onJobArchived()
      bulk.setSelection(ids)
      setBulkStatusModalOpen(true)
      setToast({ message: err?.message || 'Failed to update some jobs', type: 'error' })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkAssign = async (workerId: string) => {
    const ids = bulk.selectedItems.map((j) => j.id)
    const previousData = props.mutateData?.currentData ? JSON.parse(JSON.stringify(props.mutateData.currentData)) : null
    if (props.mutateData?.mutate) {
      props.mutateData.mutate((current: any) => {
        if (!current?.data) return current
        return {
          ...current,
          data: current.data.map((job: any) =>
            ids.includes(job.id) ? { ...job, assigned_to_id: workerId } : job
          ),
        }
      }, { optimisticData: true, rollbackOnError: true, revalidate: false })
    }
    setBulkActionLoading(true)
    try {
      const { data } = await jobsApi.bulkAssign(ids, workerId)
      const { succeeded, failed, updated_assignments } = data
      if (succeeded.length > 0 && updated_assignments && props.mutateData?.mutate) {
        props.mutateData.mutate((current: any) => {
          if (!current?.data) return current
          return {
            ...current,
            data: current.data.map((job: any) => {
              const u = updated_assignments[job.id]
              if (!u) return job
              return { ...job, assigned_to_id: u.assigned_to_id, assigned_to_name: u.assigned_to_name, assigned_to_email: u.assigned_to_email }
            }),
          }
        }, { revalidate: false })
      }
      props.onJobArchived()
      if (failed.length === 0) {
        bulk.clearSelection()
        setBulkAssignModalOpen(false)
        setToast({ message: `${succeeded.length} job${succeeded.length !== 1 ? 's' : ''} assigned`, type: 'success' })
      } else {
        if (previousData && props.mutateData?.mutate) {
          props.mutateData.mutate(previousData, { revalidate: false })
        }
        props.onJobArchived()
        bulk.setSelection(failed.map((f: { id: string }) => f.id))
        setBulkAssignModalOpen(true)
        if (succeeded.length > 0) {
          setToast({ message: `${succeeded.length} assigned, ${failed.length} failed. Retry or adjust selection.`, type: 'error' })
        } else {
          setToast({ message: failed[0]?.message || 'Failed to assign jobs. Retry or adjust selection.', type: 'error' })
        }
      }
    } catch (err: any) {
      if (previousData && props.mutateData?.mutate) {
        props.mutateData.mutate(previousData, { revalidate: false })
      }
      props.onJobArchived()
      bulk.setSelection(ids)
      setBulkAssignModalOpen(true)
      setToast({ message: err?.message || 'Failed to assign jobs', type: 'error' })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (bulk.selectedItems.length === 0) return
    const ids = bulk.selectedItems.map((j) => j.id)
    setExportInFlight(true)
    setToast({ message: 'Preparing export…', type: 'success' })
    try {
      const { data } = await jobsApi.bulkExport(ids)
      const { succeeded, failed } = data
      const toExport = bulk.selectedItems.filter((j) => succeeded.includes(j.id))
      if (toExport.length === 0) {
        setToast({ message: failed[0]?.message || 'No jobs available to export', type: 'error' })
        return
      }
      await exportJobs(toExport, ['csv', 'pdf'])
      if (failed.length > 0) {
        setToast({ message: `Exported ${toExport.length} job${toExport.length !== 1 ? 's' : ''}; ${failed.length} could not be exported.`, type: 'success' })
      } else {
        setToast({ message: `Exported ${toExport.length} job${toExport.length !== 1 ? 's' : ''} (CSV and PDF).`, type: 'success' })
      }
    } catch (err: any) {
      setToast({ message: err?.message || 'Export failed', type: 'error' })
    } finally {
      setExportInFlight(false)
    }
  }

  const handleBulkDelete = async () => {
    const ids = bulk.selectedItems.map((j) => j.id)
    const previousData = props.mutateData?.currentData ? JSON.parse(JSON.stringify(props.mutateData.currentData)) : null
    setBulkActionLoading(true)
    try {
      const { data } = await jobsApi.bulkDelete(ids)
      const { succeeded, failed } = data
      props.onJobDeleted()
      if (failed.length === 0) {
        bulk.clearSelection()
        setBulkDeleteModalOpen(false)
        if (props.mutateData?.mutate) {
          props.mutateData.mutate((current: any) => {
            if (!current?.data) return current
            return {
              ...current,
              data: (current.data || []).filter((job: any) => !ids.includes(job.id)),
              pagination: {
                ...current.pagination,
                total: Math.max(0, (current.pagination?.total || 0) - ids.length),
              },
            }
          }, { revalidate: false })
        }
        setToast({ message: `${succeeded.length} job${succeeded.length !== 1 ? 's' : ''} deleted`, type: 'success' })
      } else {
        const failedIds = failed.map((f: { id: string }) => f.id)
        bulk.setSelection(failedIds)
        setBulkDeleteModalOpen(true)
        if (props.mutateData?.mutate) {
          props.mutateData.mutate((current: any) => {
            if (!current?.data) return current
            const removed = new Set(succeeded)
            return {
              ...current,
              data: (current.data || []).filter((job: any) => !removed.has(job.id)),
              pagination: {
                ...current.pagination,
                total: Math.max(0, (current.pagination?.total || 0) - succeeded.length),
              },
            }
          }, { revalidate: false })
        }
        if (succeeded.length > 0) {
          setToast({ message: `${succeeded.length} deleted, ${failed.length} could not be deleted (e.g. not draft). Retry or adjust selection.`, type: 'error' })
        } else {
          setToast({ message: failed[0]?.message || 'Could not delete jobs. Only draft jobs without audit data can be deleted.', type: 'error' })
        }
      }
    } catch (err: any) {
      if (previousData && props.mutateData?.mutate) {
        props.mutateData.mutate(previousData, { revalidate: false })
      }
      props.onJobDeleted()
      bulk.setSelection(ids)
      setBulkDeleteModalOpen(true)
      setToast({ message: err?.message || 'Failed to delete jobs', type: 'error' })
    } finally {
      setBulkActionLoading(false)
    }
  }

  return (
    <AppBackground>
      <DashboardNavbar 
        email={props.user?.email} 
        onLogout={async () => {
          const { cacheInvalidation } = await import('@/lib/cache')
          cacheInvalidation.clearAll()
          router.push('/')
        }} 
      />
      <AppShell>
        <PageHeader
          title="Work Records"
          subtitle="Your centralized job hub — track progress, hazards, documents, and generate audit-ready reports."
          showDivider
        />

        {/* Filters */}
        <PageSection>
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-wrap gap-3">
            <JobRosterSelect
            value={props.filterStatus}
              onValueChange={(value) => {
                props.onFilterStatusChange(value)
              props.onPageChange(1)
            }}
              placeholder="All Statuses"
              options={[
                { label: 'All Statuses', value: '' },
                { label: 'Active', value: 'active' },
                { label: 'Completed', value: 'completed' },
                { label: 'On Hold', value: 'on-hold' },
                { label: 'Cancelled', value: 'cancelled' },
              ]}
            />

            <JobRosterSelect
            value={props.filterRiskLevel}
              onValueChange={(value) => {
                props.onFilterRiskLevelChange(value)
              props.onPageChange(1)
            }}
              placeholder="All Risk Levels"
              options={[
                { label: 'All Risk Levels', value: '' },
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Critical', value: 'critical' },
              ]}
            />

            <JobRosterSelect
            value={props.filterTemplateSource}
              onValueChange={(value) => {
                props.onFilterTemplateSourceChange(value)
              props.onFilterTemplateIdChange('')
              props.onPageChange(1)
            }}
              placeholder="All Sources"
              options={[
                { label: 'All Sources', value: '' },
                { label: 'From Template', value: 'template' },
                { label: 'Manual', value: 'manual' },
              ]}
            />

          {props.filterTemplateSource === 'template' && props.templates.length > 0 && (
              <JobRosterSelect
              value={props.filterTemplateId}
                onValueChange={(value) => {
                  props.onFilterTemplateIdChange(value)
                props.onPageChange(1)
              }}
                placeholder="All Templates"
              disabled={props.loadingTemplates}
                options={[
                  { label: 'All Templates', value: '' },
                  ...props.templates.map((template) => ({
                    label: template.name,
                    value: template.id,
                  })),
                ]}
              />
            )}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer hover:text-white/80 transition-colors">
                <input
                  type="checkbox"
                  checked={executiveView}
                  onChange={(e) => setExecutiveView(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F97316] focus:ring-[#F97316]/50"
                />
                <span>Executive View</span>
              </label>
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push('/operations/jobs/new')}
              >
                + Create Job
              </Button>
            </div>
          </div>
          {/* Filter Summary */}
          {(props.filterStatus || props.filterRiskLevel || props.filterTemplateSource || props.filterTemplateId) && (
            <div className="flex items-center gap-2 text-sm text-white/50 mb-2">
              <span>Filtered by:</span>
              {props.filterStatus && (
                <span className="px-2 py-0.5 bg-white/5 rounded text-white/70 capitalize">{props.filterStatus}</span>
              )}
              {props.filterRiskLevel && (
                <span className="px-2 py-0.5 bg-white/5 rounded text-white/70 capitalize">{props.filterRiskLevel} Risk</span>
              )}
              {props.filterTemplateSource && (
                <span className="px-2 py-0.5 bg-white/5 rounded text-white/70 capitalize">{props.filterTemplateSource === 'template' ? 'From Template' : 'Manual'}</span>
              )}
              <button
                onClick={() => {
                  props.onFilterStatusChange('')
                  props.onFilterRiskLevelChange('')
                  props.onFilterTemplateSourceChange('')
                  props.onFilterTemplateIdChange('')
                  props.onPageChange(1)
                }}
                className="px-2 py-0.5 text-xs text-white/60 hover:text-white/80 underline"
              >
                Reset all
              </button>
            </div>
          )}
        </PageSection>

        {/* Keyboard Hint (one-time) */}
        {showKeyboardHint && (
          <div className="mb-6 px-4 py-2 bg-[#F97316]/10 border border-[#F97316]/20 rounded-lg text-sm text-white/70">
            <div className="flex items-center justify-between">
              <span>💡 Tip: Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">/</kbd> to search, <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">Enter</kbd> to open row</span>
              <button
                onClick={() => {
                  setShowKeyboardHint(false)
                  localStorage.setItem('riskMate_keyboardHint_seen', 'true')
                }}
                className="text-white/50 hover:text-white/80"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <PageSection>
        {props.loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97316] border-t-transparent" />
          </div>
        ) : props.jobs.length === 0 ? (
          <GlassCard className="p-12 text-center">
            {props.filterStatus || props.filterRiskLevel || props.filterTemplateSource || props.filterTemplateId ? (
              <>
                <p className="text-white font-medium mb-2">No jobs match these filters</p>
                <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
                  Try adjusting your filters or clear them to see all work records.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    props.onFilterStatusChange('')
                    props.onFilterRiskLevelChange('')
                    props.onFilterTemplateSourceChange('')
                    props.onFilterTemplateIdChange('')
                    props.onPageChange(1)
                  }}
                >
                  Clear Filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-white font-medium mb-2">No jobs yet</p>
                <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
                  Jobs are where you track safety, document hazards, and generate proof packs. Every action creates an immutable ledger event. Create your first job to get started.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => router.push('/operations/jobs/new')}
                >
                  Create Your First Job
                </Button>
              </>
            )}
          </GlassCard>
        ) : (
          <>
            {bulk.selectedItems.length > 0 && (
              <div className="mb-4">
                <BulkActionsToolbar
                  selectedCount={bulk.selectedItems.length}
                  onStatusChange={() => setBulkStatusModalOpen(true)}
                  onAssign={() => setBulkAssignModalOpen(true)}
                  onExport={handleBulkExport}
                  onDelete={() => setBulkDeleteModalOpen(true)}
                  onClearSelection={bulk.clearSelection}
                  disableExport={exportInFlight}
                  canChangeStatus={canChangeStatus}
                  canAssign={canAssign}
                  canDelete={canDelete}
                />
              </div>
            )}
          <DataGrid
            data={props.jobs}
            stickyColumns={['client_name', 'risk_score']}
            enableKeyboardShortcuts={true}
            executiveView={executiveView}
            rowHighlight={(job: any) =>
              bulk.isSelected(job.id)
                ? 'rgba(0, 122, 255, 0.12)'
                : (job.risk_level === 'critical' || (job.risk_score && job.risk_score >= 90)
                    ? 'rgba(239, 68, 68, 0.1)'
                    : job.risk_level === 'high' || (job.risk_score && job.risk_score >= 70)
                      ? 'rgba(251, 146, 60, 0.1)'
                      : job.risk_level === 'medium' || (job.risk_score && job.risk_score >= 40)
                        ? 'rgba(251, 191, 36, 0.08)'
                        : job.risk_level === 'low' || (job.risk_score != null && job.risk_score < 40)
                          ? 'rgba(34, 197, 94, 0.08)'
                          : null)
            }
            columns={[
              {
                id: 'select',
                header: (
                  <input
                    type="checkbox"
                    checked={bulk.isAllSelected}
                    onChange={() => bulk.toggleAll()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-white/30 bg-white/10 text-[#007aff] focus:ring-[#007aff]/50 cursor-pointer"
                    aria-label="Select all jobs"
                  />
                ),
                accessor: () => '',
                sortable: false,
                width: '48px',
                render: (_: any, job: any) => (
                  <input
                    type="checkbox"
                    checked={bulk.isSelected(job.id)}
                    onChange={() => bulk.toggleItem(job.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-white/30 bg-white/10 text-[#007aff] focus:ring-[#007aff]/50 cursor-pointer"
                    aria-label={`Select ${job.client_name}`}
                  />
                ),
              },
              {
                id: 'client_name',
                header: 'Client',
                accessor: (job: any) => job.client_name,
                sortable: true,
                width: '200px',
                render: (value: string, job: any) => (
                  <div>
                  <button
                    onClick={() => router.push(`/operations/jobs/${job.id}`)}
                    onMouseEnter={() => handleJobHover(job.id)}
                    onMouseLeave={() => handleJobHoverEnd(job.id)}
                    className="text-white hover:text-[#F97316] transition-colors font-semibold"
                  >
                    {value}
                  </button>
                    {!executiveView && (
                      <div className="text-xs text-white/30 mt-0.5">
                        Owner: {job.owner_name || 'Safety Lead'}
                      </div>
                    )}
                  </div>
                ),
              },
              ...(executiveView ? [] : [{
                id: 'job_type',
                header: 'Job Type',
                accessor: (job: any) => job.job_type,
                sortable: true,
                render: (value: string) => (
                  <span className="text-white/50 text-sm">{value}</span>
                ),
              }]),
              {
                id: 'location',
                header: 'Location',
                accessor: (job: any) => job.location,
                sortable: true,
                render: (value: string) => (
                  <span className="text-white/50 text-sm">{value}</span>
                ),
              },
              ...(executiveView ? [] : [{
                id: 'status',
                header: 'Status',
                accessor: (job: any) => job.status,
                sortable: true,
                render: (value: string) => (
                  <span className={`px-2 py-0.5 rounded text-xs font-normal ${props.getStatusColor(value)} opacity-80`}>
                    {value}
                  </span>
                ),
              }]),
              {
                id: 'risk_score',
                header: 'Risk Score',
                accessor: (job: any) => job.risk_score ?? '—',
                sortable: true,
                width: '120px',
                // Add tooltip title for governance clarity
                render: (value: string | number, job: any) => {
                  const RiskTooltip = () => {
                    const [showTooltip, setShowTooltip] = useState(false)
                    const tooltipRef = useRef<HTMLDivElement>(null)
                    
                    React.useEffect(() => {
                      const handleClickOutside = (event: MouseEvent) => {
                        if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                          setShowTooltip(false)
                        }
                      }
                      if (showTooltip) {
                        document.addEventListener('mousedown', handleClickOutside)
                        return () => document.removeEventListener('mousedown', handleClickOutside)
                      }
                    }, [showTooltip])
                    
                      const getRiskExplanation = () => {
                      if (!job.risk_score || job.risk_score === 0) {
                        return 'No risk factors identified. Job is compliant and audit-ready.'
                      }
                      if (job.risk_score >= 90) {
                        return 'Critical risk: Unresolved high-severity hazards and missing safety protocols. Requires immediate Safety Lead review. This risk level triggers automatic visibility escalation.'
                      }
                      if (job.risk_score >= 70) {
                        return 'Elevated risk: Unresolved hazards and incomplete safety documentation. Visible to Safety Leads and Executives. Mitigation required before completion.'
                      }
                      if (job.risk_score >= 40) {
                        return 'Moderate risk: Some unresolved hazards or missing equipment checks. Standard mitigation procedures apply.'
                      }
                      return 'Low risk: Minor items requiring attention. Standard compliance protocols sufficient.'
                    }
                    
                    // Risk breakdown by category (simplified - can be enhanced with actual risk factor data)
                    const getRiskBreakdown = () => {
                      if (!job.risk_score || job.risk_score === 0) return null
                      
                      // Simplified breakdown - in production, this would come from actual risk factor categories
                      const breakdown = []
                      if (job.risk_score >= 70) {
                        breakdown.push({ category: 'Site conditions', points: Math.floor(job.risk_score * 0.3) })
                        breakdown.push({ category: 'Equipment', points: Math.floor(job.risk_score * 0.25) })
                        breakdown.push({ category: 'Crew readiness', points: Math.floor(job.risk_score * 0.2) })
                        breakdown.push({ category: 'Documentation', points: Math.floor(job.risk_score * 0.25) })
                      } else if (job.risk_score >= 40) {
                        breakdown.push({ category: 'Site conditions', points: Math.floor(job.risk_score * 0.35) })
                        breakdown.push({ category: 'Equipment', points: Math.floor(job.risk_score * 0.3) })
                        breakdown.push({ category: 'Documentation', points: Math.floor(job.risk_score * 0.35) })
                      } else {
                        breakdown.push({ category: 'Minor items', points: job.risk_score })
                      }
                      
                      return breakdown
                    }
                    
                    return (
                      <div className="relative text-right" ref={tooltipRef}>
                        <div 
                          className="cursor-help"
                          onMouseEnter={() => setShowTooltip(true)}
                          onMouseLeave={() => setShowTooltip(false)}
                          onClick={() => setShowTooltip(!showTooltip)}
                        >
                          <div className="flex items-center gap-1.5 justify-end">
                    <div className="text-lg font-bold text-white">{value}</div>
                            {getRiskTrend(job) && (
                              <span className="text-sm text-white/50" title={
                                getRiskTrend(job) === '↑' ? 'Increasing risk' :
                                getRiskTrend(job) === '→' ? 'Stable' : 'Improving'
                              }>
                                {getRiskTrend(job)}
                              </span>
                            )}
                          </div>
                    {job.risk_level && (
                      <div className={`text-xs ${props.getRiskColor(job.risk_level)}`}>
                        {job.risk_level.toUpperCase()}
                      </div>
                    )}
                  </div>
                        {showTooltip && (
                          <div className="absolute right-0 top-full mt-2 z-20 w-72 p-3 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-lg text-left text-xs text-white/80">
                            <div className="font-semibold text-white mb-2">Risk Score: {job.risk_score || 0}</div>
                            {getRiskBreakdown() && (
                              <div className="mb-2 space-y-1">
                                {getRiskBreakdown()!.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-white/70">
                                    <span>• {item.category}:</span>
                                    <span className="text-white/50">+{item.points}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="pt-2 border-t border-white/10 text-white/60">
                              {getRiskExplanation()}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }
                  
                  return <RiskTooltip />
                },
              },
              {
                id: 'next_action',
                header: 'Next Action',
                accessor: (job: any) => {
                  // Derive next action from job state
                  if (job.status === 'draft') {
                    return 'Complete job setup'
                  }
                  if (job.status === 'in_progress' && job.risk_score && job.risk_score >= 70) {
                    return 'Resolve high-risk hazards'
                  }
                  if (job.status === 'in_progress' && job.risk_score && job.risk_score >= 40) {
                    return 'Review mitigation plan'
                  }
                  if (job.status === 'in_progress') {
                    return 'Complete safety checklist'
                  }
                  if (job.status === 'completed') {
                    return '—'
                  }
                  if (job.status === 'archived') {
                    return '—'
                  }
                  return '—'
                },
                sortable: false,
                render: (value: string, job: any) => {
                  if (value === '—') return <span className="text-xs text-white/30">—</span>
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60">{value}</span>
                      {(job.risk_score && job.risk_score >= 40) && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const isFlagged = job.review_flag === true
                              await jobsApi.flag(job.id, !isFlagged)
                              setToast({ 
                                message: isFlagged ? 'Review flag removed' : 'Flagged for review', 
                                type: 'success' 
                              })
                              // Revalidate to get updated flag state
                              props.onJobArchived()
                            } catch (err: any) {
                              setToast({ 
                                message: err?.message || 'Failed to update review flag', 
                                type: 'error' 
                              })
                            }
                          }}
                          className={`text-xs underline transition-colors ${
                            job.review_flag 
                              ? 'text-white/60 hover:text-white/80' 
                              : 'text-white/40 hover:text-white/60'
                          }`}
                          title={job.review_flag ? 'Remove review flag' : 'Flag for review (visible to Safety Leads and executives)'}
                        >
                          {job.review_flag ? '✓ Flagged' : 'Flag for review'}
                        </button>
                      )}
                    </div>
                  )
                },
              },
              {
                id: 'last_activity',
                header: executiveView ? 'Last Update (UTC)' : 'Record Created (UTC)',
                accessor: (job: any) => job.updated_at || job.created_at,
                sortable: true,
                render: (value: string, job: any) => (
                  <div>
                    <div className="text-xs text-white/40">
                      {executiveView ? props.formatDate(job.updated_at || job.created_at) : props.formatDate(job.created_at)}
                    </div>
                    <div className="text-xs text-white/20 mt-0.5">
                      {executiveView ? 'Last governance record' : 'Evidence created'}
                    </div>
                  </div>
                ),
              },
              {
                id: 'ledger',
                header: '',
                accessor: () => '',
                sortable: false,
                width: '80px',
                render: (_: any, job: any) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.location.href = `/operations/audit?job_id=${job.id}`
                    }}
                    className="text-xs text-white/40 hover:text-[#F97316] transition-colors underline"
                    title="View all actions for this job in Compliance Ledger"
                  >
                    Ledger
                  </button>
                ),
              },
              ...(canArchive || canDelete ? [{
                id: 'actions',
                header: 'Actions',
                accessor: () => '',
                sortable: false,
                width: '100px',
                render: (_: any, job: any) => <ActionsCell job={job} />,
              }] : []),
            ]}
            onRowClick={(job: any) => router.push(`/operations/jobs/${job.id}`)}
            onRowHover={(job: any) => handleJobHover(job.id)}
            onRowHoverEnd={(job: any) => handleJobHoverEnd(job.id)}
          />
          </>
        )}
        </PageSection>

        {/* Audit Narrative Footer */}
        {props.jobs.length > 0 && (
          <PageSection>
            <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="text-white/30">
                All job records are immutable once governance evidence exists.
              </div>
              <div className="text-white/40 italic">
                Export-ready for insurer & regulatory review
              </div>
            </div>
            <div className="text-white/25 text-center">
              Riskmate maintains a continuous, immutable risk ledger for every job.
            </div>
            </div>
          </PageSection>
        )}

        {/* Pagination */}
        {props.totalPages > 1 && (
          <PageSection>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="secondary"
                onClick={() => props.onPageChange(Math.max(1, props.page - 1))}
                disabled={props.page === 1}
              >
                Previous
              </Button>
              <span className="px-4 text-sm text-white/60">
                Page {props.page} of {props.totalPages}
              </span>
              <Button
                variant="secondary"
                onClick={() => props.onPageChange(Math.min(props.totalPages, props.page + 1))}
                disabled={props.page === props.totalPages}
              >
                Next
              </Button>
            </div>
          </PageSection>
        )}
      </AppShell>
      
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

      {/* Bulk Status Modal */}
      <BulkStatusModal
        isOpen={bulkStatusModalOpen}
        onClose={() => setBulkStatusModalOpen(false)}
        selectedJobs={bulk.selectedItems.map((j) => ({ id: j.id, client_name: j.client_name }))}
        onConfirm={handleBulkStatusChange}
        loading={bulkActionLoading}
      />

      {/* Bulk Assign Modal */}
      <BulkAssignModal
        isOpen={bulkAssignModalOpen}
        onClose={() => setBulkAssignModalOpen(false)}
        selectedJobs={bulk.selectedItems.map((j) => ({ id: j.id, client_name: j.client_name }))}
        onConfirm={handleBulkAssign}
        loading={bulkActionLoading}
      />

      {/* Bulk Delete Confirmation */}
      <BulkDeleteConfirmation
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        selectedJobs={bulk.selectedItems.map((j) => ({ id: j.id, client_name: j.client_name }))}
        onConfirm={handleBulkDelete}
        loading={bulkActionLoading}
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
    </AppBackground>
  )
}

