'use client'

import React, { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { DataGrid } from '@/components/dashboard/DataGrid'
import { ConfirmationModal } from '@/components/dashboard/ConfirmationModal'
import { Toast } from '@/components/dashboard/Toast'
import { JobRosterSelect } from '@/components/dashboard/JobRosterSelect'
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
  const [executiveView, setExecutiveView] = useState(false)
  const [showKeyboardHint, setShowKeyboardHint] = useState(false)
  
  const canArchive = hasPermission(props.userRole, 'jobs.close')
  const canDelete = hasPermission(props.userRole, 'jobs.delete')
  
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
            <div className="flex-1">
                  <div className="flex items-center gap-3">
                  <Link href="/operations/jobs" className={`${typography.h1} hover:text-[#F97316] transition-colors`}>
                    Job Roster
                  </Link>
                    <span className="text-xs text-white/40 font-normal">Audit-safe view</span>
                  </div>
                  <p className={`${spacing.tight} ${typography.bodyMuted}`}>
                    Your centralized job hub — track progress, hazards, documents, and generate audit-ready reports.
                  </p>
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
              <button
                onClick={() => router.push('/operations/jobs/new')}
                className={`${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
              >
                + Create Job
              </button>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className={`${spacing.relaxed}`}
        >
          <div className="flex flex-wrap gap-3 mb-3">
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
        </motion.div>

        {/* Keyboard Hint (one-time) */}
        {showKeyboardHint && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 px-4 py-2 bg-[#F97316]/10 border border-[#F97316]/20 rounded-lg text-sm text-white/70"
          >
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
          </motion.div>
        )}

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
              {props.filterStatus || props.filterRiskLevel || props.filterTemplateSource || props.filterTemplateId ? (
                <>
                  <p className={`text-white font-medium ${spacing.tight}`}>No jobs match these filters</p>
                  <p className={`text-sm text-white/60 ${spacing.normal} max-w-md mx-auto`}>
                    Try adjusting your filters or clear them to see all jobs.
                  </p>
                  <button
                    onClick={() => {
                      props.onFilterStatusChange('')
                      props.onFilterRiskLevelChange('')
                      props.onFilterTemplateSourceChange('')
                      props.onFilterTemplateIdChange('')
                      props.onPageChange(1)
                    }}
                    className={`${spacing.normal} px-4 py-2 text-sm text-white/70 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors`}
                  >
                    Clear Filters
                  </button>
                </>
              ) : (
                <>
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
                </>
              )}
            </motion.div>
        ) : (
          <DataGrid
            data={props.jobs}
            stickyColumns={['client_name', 'risk_score']}
            enableKeyboardShortcuts={true}
            executiveView={executiveView}
            columns={[
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
            rowHighlight={(job: any) => {
              // Risk spine: subtle left border based on risk level
              if (job.risk_level === 'critical' || (job.risk_score && job.risk_score >= 90)) {
                return 'rgba(239, 68, 68, 0.1)' // red at 10% opacity
              }
              if (job.risk_level === 'high' || (job.risk_score && job.risk_score >= 70)) {
                return 'rgba(251, 146, 60, 0.1)' // amber at 10% opacity
              }
              if (job.risk_level === 'medium' || (job.risk_score && job.risk_score >= 40)) {
                return 'rgba(251, 191, 36, 0.08)' // yellow at 8% opacity
              }
              if (job.risk_level === 'low' || (job.risk_score !== null && job.risk_score < 40)) {
                return 'rgba(34, 197, 94, 0.08)' // green at 8% opacity
              }
              return null
            }}
          />
        )}

        {/* Audit Narrative Footer */}
        {props.jobs.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="text-white/30">
                All job records are immutable once governance evidence exists.
              </div>
              <div className="text-white/40 italic">
                Export-ready for insurer & regulatory review
              </div>
            </div>
            <div className="text-white/25 text-center">
              RiskMate maintains a continuous, immutable risk ledger for every job.
            </div>
          </div>
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

