'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { jobsApi, teamApi } from '@/lib/api'
import { useRiskFactors, usePlan } from '@/lib/cache'
import { Toast } from '@/components/dashboard/Toast'
import ProtectedRoute from '@/components/ProtectedRoute'
import RiskmateLogo from '@/components/RiskmateLogo'
import { GenerationProgressModal } from '@/components/dashboard/GenerationProgressModal'
import { DashboardSkeleton, SkeletonLoader } from '@/components/dashboard/SkeletonLoader'
import { EditableText } from '@/components/dashboard/EditableText'
import { EditableSelect } from '@/components/dashboard/EditableSelect'
import { VersionHistory } from '@/components/dashboard/VersionHistory'
import { JobAssignment } from '@/components/dashboard/JobAssignment'
import { EvidenceVerification } from '@/components/dashboard/EvidenceVerification'
import { TemplatesManager, TemplateModal, TemplateModalProps } from '@/components/dashboard/TemplatesManager'
import { ApplyTemplateInline } from '@/components/dashboard/ApplyTemplateInline'
import { JobPacketView } from '@/components/job/JobPacketView'
import { JobActivityFeed, type AuditEvent } from '@/components/job/JobActivityFeed'
import { JobCommentsPanel } from '@/components/job/JobCommentsPanel'
import { MentionsInbox } from '@/components/job/MentionsInbox'
import { commentsApi } from '@/lib/api'
import { TeamSignatures } from '@/components/report/TeamSignatures'
import { AddTaskModal } from '@/components/tasks/AddTaskModal'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskTemplateSelector } from '@/components/tasks/TaskTemplateSelector'
import { ToastContainer } from '@/components/ToastContainer'
import { typography, emptyStateStyles, spacing, dividerStyles, tabStyles } from '@/lib/styles/design-system'
import { ErrorModal } from '@/components/dashboard/ErrorModal'
import { optimizePhoto } from '@/lib/utils/photoOptimization'
import { getGPSLocation } from '@/lib/utils/gpsMetadata'
import { hasPermission } from '@/lib/utils/permissions'
import { AppBackground, AppShell, PageSection, GlassCard, Button, Badge, TrustReceiptStrip, IntegrityBadge, EventChip, EnforcementBanner, EvidenceStamp } from '@/components/shared'
import { extractProxyError, formatProxyErrorTitle, logProxyError } from '@/lib/utils/extractProxyError'
import { useTasks } from '@/hooks/useTasks'
import { CreateTaskPayload } from '@/types/tasks'

// Helper function to convert base64 to Blob
const base64ToBlob = (base64: string, contentType = 'application/pdf') => {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: contentType })
}

interface MitigationItem {
  id: string
  title: string
  description: string
  done: boolean
  is_completed: boolean
}

interface Job {
  id: string
  client_name: string
  client_type: string
  job_type: string
  location: string
  description: string
  status: string
  risk_score: number | null
  risk_level: string | null
  risk_score_detail: {
    overall_score: number
    risk_level: string
    factors: Array<{
      code: string
      name: string
      severity: string
      weight: number
    }>
  } | null
  mitigation_items: MitigationItem[]
  created_at: string
  applied_template_id?: string | null
  applied_template_type?: 'hazard' | 'job' | null
  start_date?: string | null
  end_date?: string | null
}

export default function JobDetailPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSecondary, setLoadingSecondary] = useState(true) // For secondary sections
  const [skeletonMinTime, setSkeletonMinTime] = useState(true) // Minimum 300ms skeleton display
  const [updatingMitigation, setUpdatingMitigation] = useState<string | null>(null)
  const [generatingPermitPack, setGeneratingPermitPack] = useState(false)
  const [permitPacks, setPermitPacks] = useState<Array<{
    id: string
    version: number
    file_path: string
    generated_at: string
    downloadUrl: string | null
  }>>([])
  const [loadingPermitPacks, setLoadingPermitPacks] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showApplyTemplate, setShowApplyTemplate] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [prefillTemplateData, setPrefillTemplateData] = useState<{ name: string; trade?: string; hazardIds: string[] } | null>(null)
  const [appliedTemplate, setAppliedTemplate] = useState<{ id: string; name: string; type: 'hazard' | 'job' } | null>(null)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member'>('member')
  const [workers, setWorkers] = useState<Array<{
    id: string
    name: string
    email: string
    role: string
    checkedIn: boolean
    checkedInAt?: string
    jobsAssigned: number
    avatarUrl?: string
  }>>([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)
  const [attachments, setAttachments] = useState<Array<{
    id: string
    name: string
    type: 'photo' | 'document' | 'permit' | 'inspection'
    url?: string
    file_path?: string
    created_at: string
    category?: 'before' | 'during' | 'after'
  }>>([])
  const [signoffs, setSignoffs] = useState<Array<{
    id: string
    signer_id: string
    signer_role: string
    signer_name: string
    signoff_type: string
    status: 'pending' | 'signed' | 'rejected'
    signed_at?: string
    comments?: string
  }>>([])
  const [evidenceItems, setEvidenceItems] = useState<Array<{
    id: string
    type: 'photo' | 'document' | 'mitigation'
    name: string
    url?: string
    status: 'pending' | 'approved' | 'rejected'
    submittedBy: string
    submittedAt: string
    verifiedBy?: string
    verifiedAt?: string
    rejectionReason?: string
  }>>([])
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [loadingVersionHistory, setLoadingVersionHistory] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [versionHistoryEntries, setVersionHistoryEntries] = useState<Array<{
    id: string
    field: string
    oldValue: string | null
    newValue: string | null
    changedBy: string
    changedAt: string
    changeType: 'created' | 'updated' | 'deleted'
    actionType?: 'job_created' | 'hazard_added' | 'hazard_removed' | 'mitigation_completed' | 'photo_uploaded' | 'evidence_approved' | 'evidence_rejected' | 'template_applied' | 'worker_assigned' | 'worker_unassigned' | 'status_changed' | 'pdf_generated'
    metadata?: any
  }>>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'signatures' | 'tasks' | 'comments'>('overview')
  const [activityInitialEvents, setActivityInitialEvents] = useState<AuditEvent[] | null>(null)
  const [signatureCount, setSignatureCount] = useState<{ signed: number; total: number } | null>(null)
  const [taskIncompleteCount, setTaskIncompleteCount] = useState<number | null>(null)
  const [taskRefreshKey, setTaskRefreshKey] = useState(0)
  const [commentCount, setCommentCount] = useState<number | null>(null)
  const [commentUnreadCount, setCommentUnreadCount] = useState<number>(0)
  const [commentsLastViewedAt, setCommentsLastViewedAt] = useState<number | null>(null)
  const [mentionsCount, setMentionsCount] = useState<number | null>(null)
  const [showMentionsInbox, setShowMentionsInbox] = useState(false)

  const { addTask, refetch: refetchTasks, incompleteCount } = useTasks(jobId)

  useEffect(() => {
    setTaskIncompleteCount(incompleteCount)
  }, [incompleteCount])

  const handleAddTask = useCallback(
    async (payload: CreateTaskPayload) => {
      await addTask(payload)
      await refetchTasks()
      setTaskRefreshKey((value) => value + 1)
    },
    [addTask, refetchTasks]
  )

  const handleApplyTaskTemplate = useCallback(
    async (tasks: CreateTaskPayload[]) => {
      for (const task of tasks) {
        await addTask(task)
      }
      await refetchTasks()
      setTaskRefreshKey((value) => value + 1)
    },
    [addTask, refetchTasks]
  )

  const loadVersionHistory = async () => {
    if (loadingVersionHistory || !jobId) return
    setLoadingVersionHistory(true)
    try {
      const response = await jobsApi.getAuditLog(jobId)
      // Transform audit log entries to version history format
      type ValidActionType = 'job_created' | 'hazard_added' | 'hazard_removed' | 'mitigation_completed' | 'photo_uploaded' | 'evidence_approved' | 'evidence_rejected' | 'template_applied' | 'worker_assigned' | 'worker_unassigned' | 'status_changed' | 'pdf_generated'
      
      type VersionHistoryEntry = {
        id: string
        field: string
        oldValue: string | null
        newValue: string | null
        changedBy: string
        changedAt: string
        changeType: 'created' | 'updated' | 'deleted'
        actionType?: ValidActionType
        metadata?: any
      }
      
      const entries: VersionHistoryEntry[] = (response.data || []).map((entry: any): VersionHistoryEntry => {
        let changeType: 'created' | 'updated' | 'deleted' = 'updated'
        if (entry.event_name?.includes('created')) {
          changeType = 'created'
        } else if (entry.event_name?.includes('deleted')) {
          changeType = 'deleted'
        }
        
        // Map event_name to valid actionType union
        const eventName = entry.event_name || ''
        let actionType: ValidActionType | undefined = undefined
        
        // Map common event names to actionTypes
        if (eventName.includes('job.created') || eventName === 'job_created') {
          actionType = 'job_created'
        } else if (eventName.includes('hazard.added') || eventName === 'hazard_added') {
          actionType = 'hazard_added'
        } else if (eventName.includes('hazard.removed') || eventName === 'hazard_removed') {
          actionType = 'hazard_removed'
        } else if (eventName.includes('mitigation.completed') || eventName === 'mitigation_completed') {
          actionType = 'mitigation_completed'
        } else if (eventName.includes('photo.uploaded') || eventName === 'photo_uploaded') {
          actionType = 'photo_uploaded'
        } else if (eventName.includes('evidence.approved') || eventName === 'evidence_approved') {
          actionType = 'evidence_approved'
        } else if (eventName.includes('evidence.rejected') || eventName === 'evidence_rejected') {
          actionType = 'evidence_rejected'
        } else if (eventName.includes('template.applied') || eventName === 'template_applied') {
          actionType = 'template_applied'
        } else if (eventName.includes('worker.assigned') || eventName === 'worker_assigned' || eventName.includes('assignment.created')) {
          actionType = 'worker_assigned'
        } else if (eventName.includes('worker.unassigned') || eventName === 'worker_unassigned' || eventName.includes('assignment.removed')) {
          actionType = 'worker_unassigned'
        } else if (eventName.includes('status.changed') || eventName === 'status_changed') {
          actionType = 'status_changed'
        } else if (eventName.includes('pdf.generated') || eventName === 'pdf_generated' || eventName.includes('permit_pack.generated')) {
          actionType = 'pdf_generated'
        }
        
        return {
          id: entry.id,
          field: entry.target_type || 'job',
          oldValue: null,
          newValue: null,
          changedBy: entry.actor_name || 'System',
          changedAt: entry.created_at,
          changeType,
          actionType,
          metadata: entry.metadata || {},
        }
      })
      setVersionHistoryEntries(entries)
    } catch (err: any) {
      // Don't log plan gate 403s as errors (they're expected for starter plan)
      // The API returns code: 'FEATURE_RESTRICTED' for plan gate denials
      if (err?.code === 'FEATURE_RESTRICTED') {
        // Silently skip - feature not available on current plan
        return
      }
      // Only log actual errors
      console.error('Failed to load version history:', err)
    } finally {
      setLoadingVersionHistory(false)
    }
  }
  
  // Use cached hooks
  const { data: riskFactors = [] } = useRiskFactors(organizationId || undefined)
  const { data: subscriptionData, isLoading: loadingPlan } = usePlan(organizationId)
  const subscriptionTier = subscriptionData?.tier || null

  const loadJob = useCallback(async () => {
    const startTime = Date.now()
    // Performance marker
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      window.performance?.mark('job-detail-load-start')
    }
    try {
      const response = await jobsApi.get(jobId)
      setJob(response.data)
      
      // Performance measurement
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        const loadTime = Date.now() - startTime
        window.performance?.mark('job-detail-load-end')
        window.performance?.measure('job-detail-load', 'job-detail-load-start', 'job-detail-load-end')
        if (loadTime > 800) {
          console.warn(`⚠️ Job detail load took ${loadTime}ms (budget: 800ms)`)
        } else {
          console.log(`✅ Job detail load: ${loadTime}ms`)
        }
      }
      
      // Load applied template info if exists
      if (response.data.applied_template_id && response.data.applied_template_type) {
        const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
        const supabase = createSupabaseBrowserClient()
        const table = response.data.applied_template_type === 'hazard' ? 'hazard_templates' : 'job_templates'
        
        const { data: templateData } = await supabase
          .from(table)
          .select('id, name, archived')
          .eq('id', response.data.applied_template_id)
          .single()
        
        if (templateData) {
          setAppliedTemplate({
            id: templateData.id,
            name: templateData.name + (templateData.archived ? ' (Archived)' : ''),
            type: response.data.applied_template_type,
          })
        }
      } else {
        setAppliedTemplate(null)
      }
      
      // Load attachments
      try {
        const documentsResponse = await jobsApi.getDocuments(jobId)
        const docs = documentsResponse.data || []
        setAttachments(docs.map((doc: any) => ({
          id: doc.id,
          name: doc.file_name || doc.name || 'Untitled',
          type: doc.type === 'photo' ? 'photo' :
                doc.file_name?.toLowerCase().includes('permit') ? 'permit' :
                doc.file_name?.toLowerCase().includes('inspection') ? 'inspection' : 'document',
          url: doc.url ?? doc.file_path,
          file_path: doc.file_path ?? doc.storage_path,
          created_at: doc.created_at,
          category: doc.type === 'photo' ? (doc.category ?? undefined) : undefined,
        })))
      } catch (err) {
        console.error('Failed to load attachments:', err)
      }

      // Load sign-offs
      try {
        const signoffsResponse = await jobsApi.getSignoffs(jobId)
        setSignoffs(signoffsResponse.data || [])
      } catch (err) {
        console.error('Failed to load sign-offs:', err)
      }
      
      // Ensure minimum skeleton display time (300ms)
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 300 - elapsed)
      setTimeout(() => {
        setLoading(false)
        // Load secondary sections after primary content is visible
        setTimeout(() => {
          setLoadingSecondary(false)
        }, 100)
      }, remaining)
    } catch (err: any) {
      console.error('Failed to load job:', err)
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 300 - elapsed)
      setTimeout(() => {
        setLoading(false)
        setLoadingSecondary(false)
      }, remaining)
    }
  }, [jobId])

  useEffect(() => {
    if (jobId) {
      loadJob()
    }
  }, [jobId, loadJob])

  // Restore last-viewed timestamp for comments (unread badge) from localStorage
  useEffect(() => {
    if (!jobId || typeof window === 'undefined') return
    try {
      const key = `riskmate_comments_last_viewed_${jobId}`
      const raw = localStorage.getItem(key)
      if (raw) {
        const t = parseInt(raw, 10)
        if (!Number.isNaN(t)) setCommentsLastViewedAt(t)
      }
    } catch {
      // ignore
    }
  }, [jobId])

  // When user opens Comments tab, mark all as read (reset unread badge)
  useEffect(() => {
    if (activeTab !== 'comments' || !jobId) return
    const now = Date.now()
    setCommentsLastViewedAt(now)
    setCommentUnreadCount(0)
    try {
      localStorage.setItem(`riskmate_comments_last_viewed_${jobId}`, String(now))
    } catch {
      // ignore
    }
  }, [activeTab, jobId])

  // Fetch mentions count for badge (lightweight: limit=1 just to get count)
  useEffect(() => {
    let cancelled = false
    commentsApi
      .listMentionsMe({ limit: 1, offset: 0 })
      .then((res) => {
        if (!cancelled && res.count != null) setMentionsCount(res.count)
      })
      .catch(() => {
        if (!cancelled) setMentionsCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load organization ID (subscription and risk factors are cached)
  useEffect(() => {
    const loadOrgId = async () => {
      const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userRow } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .single()
        if (userRow?.organization_id) {
          setOrganizationId(userRow.organization_id)
        }
      }
    }
    loadOrgId()
  }, [])

  // Load initial job activity when Activity tab is selected (for JobActivityFeed)
  useEffect(() => {
    if (activeTab !== 'activity' || !jobId) return
    let cancelled = false
    jobsApi.getJobActivity(jobId, { limit: 20, offset: 0 }).then((res) => {
      if (!cancelled && res.data?.events) {
        setActivityInitialEvents(res.data.events as AuditEvent[])
      }
    }).catch(() => {
      if (!cancelled) setActivityInitialEvents([])
    })
    return () => { cancelled = true }
  }, [activeTab, jobId])

  // Fetch initial signature count for tab badge during page load
  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    const fetchSignatureCount = async () => {
      try {
        // Fetch all insurance report runs (not just limit=1) to find the active one
        const runsRes = await fetch(`/api/reports/runs?job_id=${jobId}&packet_type=insurance`)
        if (!runsRes.ok || cancelled) return
        const { data: runs } = await runsRes.json()
        if (!runs?.length) {
          // No run exists yet, default to 0/3
          if (!cancelled) setSignatureCount({ signed: 0, total: 3 })
          return
        }
        // Find the latest non-superseded run (fallback to first if all superseded)
        const activeRun = runs.find((r: { status: string }) => r.status !== 'superseded') || runs[0]
        const sigRes = await fetch(`/api/reports/runs/${activeRun.id}/signatures`)
        if (!sigRes.ok || cancelled) return
        const { data: sigs } = await sigRes.json()
        // Count only required signatures (prepared_by, reviewed_by, approved_by)
        const requiredRoles = ['prepared_by', 'reviewed_by', 'approved_by']
        const signed = Array.isArray(sigs) 
          ? sigs.filter((sig: { signature_role: string }) => requiredRoles.includes(sig.signature_role)).length 
          : 0
        if (!cancelled) setSignatureCount({ signed, total: 3 })
      } catch {
        if (!cancelled) setSignatureCount({ signed: 0, total: 3 })
      }
    }
    fetchSignatureCount()
    return () => { cancelled = true }
  }, [jobId])

  // Load permit packs for Business plan users (lazy - only when section is visible)
  useEffect(() => {
    const loadPermitPacks = async () => {
      if (subscriptionTier === 'business' && jobId && organizationId && !loadingSecondary) {
        setLoadingPermitPacks(true)
        try {
          const response = await jobsApi.getPermitPacks(jobId)
          setPermitPacks(response.data || [])
        } catch (err) {
          console.error('Failed to load permit packs:', err)
        } finally {
          setLoadingPermitPacks(false)
        }
      }
    }
    loadPermitPacks()
  }, [subscriptionTier, jobId, organizationId, subscriptionData, loadingSecondary])

  const handleGeneratePermitPack = async () => {
    if (!jobId) return

    // Guard: Don't proceed if subscription isn't loaded or isn't Business
    if (loadingPlan) {
      // Subscription still loading, wait for it to complete
      return
    }
    
    if (!subscriptionData || subscriptionTier !== 'business') {
      setError('Permit Packs are available on the Business plan. This feature bundles all job documentation into a single ZIP file for inspectors and permit offices. Upgrade to Business to access this feature.')
      return
    }

    setGeneratingPermitPack(true)
    setError(null)
    setShowProgressModal(true)
    
    try {
      const response = await jobsApi.generatePermitPack(jobId)
      
      if (response.success && response.data.downloadUrl) {
        // Wait for progress modal to show completion
        setTimeout(() => {
          // Open download URL in new tab
          window.open(response.data.downloadUrl, '_blank')
          
          // Show success toast
          setToast({ 
            message: `Permit Pack exported. Entry added to Compliance Ledger. [View in Ledger](/operations/audit?job_id=${jobId})`, 
            type: 'success' 
          })
          
          // Reload permit packs list
          jobsApi.getPermitPacks(jobId).then((packsResponse) => {
            setPermitPacks(packsResponse.data || [])
          }).catch((err) => {
            console.error('Failed to reload permit packs:', err)
          })
        }, 1000)
      } else {
        throw new Error('Failed to generate permit pack')
      }
    } catch (err: any) {
      console.error('Failed to generate permit pack:', err)
      setShowProgressModal(false)
      
      // Check error response for specific error codes
      // The apiRequest function sets err.code from data.code
      const errorCode = err?.code
      const errorMessage = err?.message || ''
      
      // Log full error for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('Permit pack error details:', {
          code: errorCode,
          message: errorMessage,
          fullError: err,
        })
      }
      
      if (errorCode === 'FEATURE_RESTRICTED' || errorMessage?.includes('Business plan') || errorMessage?.includes('only available for Business')) {
        setError('Permit Packs are available on the Business plan. This feature bundles all job documentation into a single ZIP file for inspectors and permit offices. Upgrade to Business to access this feature.')
      } else {
        setError('We couldn\'t generate the permit pack. Your job data is safe — try again in a moment. If this continues, check your internet connection.')
      }
    } finally {
      setGeneratingPermitPack(false)
    }
  }

  const toggleMitigation = async (itemId: string, currentDone: boolean) => {
    // Optimistic update - update UI immediately
    const previousState = job?.mitigation_items
    if (job) {
      setJob({
        ...job,
        mitigation_items: job.mitigation_items.map((item) =>
          item.id === itemId
            ? { ...item, done: !currentDone, is_completed: !currentDone }
            : item
        ),
      })
    }
    setUpdatingMitigation(itemId)
    
    try {
      // Make API call
      const response = await fetch(`/api/jobs/${jobId}/mitigations/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !currentDone }),
      })
      if (!response.ok) {
        // Extract structured error using shared helper
        const errorDetails = await extractProxyError(response)
        const { code, message, hint, errorId, requestId, statusCode } = errorDetails
        
        // Log error ID for debugging
        logProxyError(errorId, code, `/api/jobs/${jobId}/mitigations/${itemId}`, statusCode, requestId)
        
        // Format title using shared helper
        const title = formatProxyErrorTitle(code, errorId, message)
        
        throw new Error(title)
      }
      
      // Success - show Ledger confirmation
      setToast({ 
        message: `Control updated. Entry added to Compliance Ledger. View in Ledger: /operations/audit?job_id=${jobId}`, 
        type: 'success' 
      })
    } catch (err) {
      console.error('Failed to update mitigation:', err)
      // Rollback on error
      if (job && previousState) {
        setJob({
          ...job,
          mitigation_items: previousState,
        })
      }
      // Show error toast
      setToast({ 
        message: 'Couldn\'t save that. Your data is safe — retrying helps.', 
        type: 'error' 
      })
    } finally {
      setUpdatingMitigation(null)
    }
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    if (score >= 71) return 'text-red-400'
    if (score >= 41) return 'text-[#F97316]'
    return 'text-green-400'
  }

  const getScoreBg = (score: number | null) => {
    if (score === null) return 'bg-gray-500/10 border-gray-500/30'
    if (score >= 71) return 'bg-red-500/10 border-red-500/30'
    if (score >= 41) return 'bg-[#F97316]/10 border-[#F97316]/30'
    return 'bg-green-500/10 border-green-500/30'
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardSkeleton />
      </ProtectedRoute>
    )
  }

  if (!job) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/60 mb-4">Job not found</p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push('/operations')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const completedCount = job.mitigation_items.filter((m) => m.done).length
  const totalCount = job.mitigation_items.length

  const currentRiskFactorCodes = job.risk_score_detail?.factors
    ? job.risk_score_detail.factors.map((f) => f.code)
    : []

  const handleApplyTemplate = async (
    hazardIds: string[],
    templateId: string,
    templateType: 'hazard' | 'job',
    replaceExisting: boolean = false
  ) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hazard_ids: hazardIds,
          template_id: templateId,
          template_type: templateType,
          replace_existing: replaceExisting,
        }),
      })

      if (!response.ok) {
        // Extract structured error using shared helper
        const { code, message, hint, errorId, requestId, statusCode } = await extractProxyError(response)
        
        // Log error ID for debugging
        logProxyError(errorId, code, `/api/jobs/${jobId}/apply-template`, statusCode, requestId)
        
        // Format title using shared helper
        const title = formatProxyErrorTitle(code, errorId, message)
        
        throw new Error(title)
      }

      const { data } = await response.json()
      setJob(data)
      loadJob() // Reload to get fresh data
    } catch (err: any) {
      console.error('Failed to apply template:', err)
      setError(err.message || 'We couldn\'t load that template. Your job data is safe — try again in a moment.')
    }
  }

  const handleSaveAndApplyTemplate = async (templateId: string, hazardIds: string[]) => {
    try {
      // Convert hazard IDs to risk factor codes
      const hazardCodes = riskFactors
        .filter((rf) => hazardIds.includes(rf.id))
        .map((rf) => rf.code)

      if (hazardCodes.length === 0) {
        throw new Error('No hazards to apply')
      }

      await handleApplyTemplate(hazardIds, templateId, 'hazard', false)
      setShowCreateTemplate(false)
      setPrefillTemplateData(null)
      setToast({ 
        message: `Template saved and applied. Entry added to Compliance Ledger. [View in Ledger](/operations/audit?job_id=${jobId})`, 
        type: 'success' 
      })
    } catch (err: any) {
      console.error('Failed to save and apply template:', err)
      setToast({ message: err.message || 'Failed to save and apply template', type: 'error' })
    }
  }

  const handleSaveAsTemplate = () => {
    if (!job || !job.risk_score_detail || job.risk_score_detail.factors.length === 0) {
      setToast({ message: 'No hazards to save as template', type: 'error' })
      return
    }

    // Get current hazard IDs from risk factors
    const currentHazardCodes = job.risk_score_detail.factors.map((f) => f.code)
    const currentHazardIds = riskFactors
      .filter((rf) => currentHazardCodes.includes(rf.code))
      .map((rf) => rf.id)

    // Pre-fill template data
    setPrefillTemplateData({
      name: `${job.client_name} - ${job.job_type}`,
      trade: job.job_type, // Use job_type as trade hint
      hazardIds: currentHazardIds,
    })

    setShowCreateTemplate(true)
  }

  return (
    <ProtectedRoute>
      <ToastContainer />
      <AppBackground>
        <div className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
                <RiskmateLogo size="sm" showText={true} />
              </div>
              <div className="flex items-center gap-3 min-w-0 flex-wrap justify-end">
                <button
                  onClick={() => router.push('/operations')}
                  className="text-sm text-white/60 hover:text-white transition-colors flex-shrink-0"
                >
                  ← Back to Dashboard
                </button>
                <div className="flex items-center gap-3 flex-wrap">
                  {subscriptionTier === 'business' && (
                    <Button
                      variant="primary"
                      onClick={handleGeneratePermitPack}
                      disabled={generatingPermitPack}
                    >
                      {generatingPermitPack ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                          Generating...
                        </>
                      ) : (
                        <>📦 Generate Permit Pack</>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/operations/jobs/${jobId}/report`)}
                  >
                    View Audit-Ready Report
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/operations/audit?job_id=${jobId}`)}
                  >
                    View in Compliance Ledger
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AppShell>
          <PageSection className="mb-8">
            <EditableText
              value={job.client_name}
              onSave={async (newValue) => {
                await jobsApi.update(jobId, { client_name: newValue })
                setJob({ ...job, client_name: newValue })
              }}
              className={`${typography.h1} mb-2`}
              inputClassName={typography.h1}
            />
            <div className="flex items-center gap-3 mb-1 min-w-0 flex-wrap">
              <p className="text-xl text-[#A1A1A1] truncate min-w-0 flex-1">{job.location}</p>
              {appliedTemplate && (
                <span className="px-3 py-1 text-xs font-medium bg-[#F97316]/20 text-[#F97316] rounded-lg border border-[#F97316]/30 flex items-center gap-1.5 flex-shrink-0">
                  <span>📋</span>
                  <span className="truncate max-w-[200px]" title={`From template: ${appliedTemplate.name}`}>From template: {appliedTemplate.name}</span>
                  <button
                    onClick={() => {
                      // Open template in Account page (new tab)
                      window.open(`/operations/account#template-${appliedTemplate.id}`, '_blank')
                    }}
                    className="text-[#F97316] hover:text-[#FB923C] underline text-xs flex-shrink-0"
                  >
                    View
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mb-2 min-w-0 flex-wrap">
              <p className="text-sm text-[#A1A1A1]/70 truncate min-w-0">
                {job.job_type} • {job.client_type}
              </p>
              <span className="text-[#A1A1A1]/50 flex-shrink-0">•</span>
              <div className="flex-shrink-0">
                <EditableSelect
                  value={job.status}
                  options={[
                    { value: 'draft', label: 'Draft', color: '#A1A1A1' },
                    { value: 'pending', label: 'Pending', color: '#FACC15' },
                    { value: 'in_progress', label: 'In Progress', color: '#38BDF8' },
                    { value: 'completed', label: 'Completed', color: '#29E673' },
                    { value: 'cancelled', label: 'Cancelled', color: '#FB7185' },
                  ]}
                  onSave={async (newValue) => {
                    await jobsApi.update(jobId, { status: newValue })
                    setJob({ ...job, status: newValue })
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-white/50 mt-2">
              Status helps your team understand what stage this job is in.
            </p>
            
            {/* Trust Receipt: Created by / Last modified + Integrity Badge */}
            {job && (
              <div className="mt-6 space-y-3">
                <TrustReceiptStrip
                  actorName={versionHistoryEntries.length > 0 ? versionHistoryEntries[0].changedBy : 'System'}
                  actorRole={undefined}
                  occurredAt={job.created_at}
                  eventType="job.created"
                  category="operations"
                  summary={`Created job for ${job.client_name}`}
                  compact
                />
                {versionHistoryEntries.length > 1 && (
                  <TrustReceiptStrip
                    actorName={versionHistoryEntries[versionHistoryEntries.length - 1].changedBy}
                    actorRole={undefined}
                    occurredAt={versionHistoryEntries[versionHistoryEntries.length - 1].changedAt}
                    eventType="job.updated"
                    category="operations"
                    summary={`Last modified: ${versionHistoryEntries[versionHistoryEntries.length - 1].actionType || versionHistoryEntries[versionHistoryEntries.length - 1].changeType}`}
                    compact
                  />
                )}
                <div>
                  <IntegrityBadge
                    status="unverified"
                    showDetails
                  />
                </div>
              </div>
            )}
          </PageSection>

          {/* Tab navigation: Overview | Activity | Signatures */}
          <div className={`${tabStyles.container} mb-6`}>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`${tabStyles.item} ${activeTab === 'overview' ? tabStyles.active : tabStyles.inactive}`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`${tabStyles.item} ${activeTab === 'activity' ? tabStyles.active : tabStyles.inactive}`}
            >
              Activity
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('signatures')}
              className={`${tabStyles.item} ${activeTab === 'signatures' ? tabStyles.active : tabStyles.inactive}`}
            >
              Signatures
              {signatureCount !== null && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 text-xs font-medium rounded-md bg-white/10 text-white/80 border border-white/10">
                  {signatureCount.signed}/{signatureCount.total}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`${tabStyles.item} ${activeTab === 'tasks' ? tabStyles.active : tabStyles.inactive}`}
            >
              Tasks
              {taskIncompleteCount !== null && taskIncompleteCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 text-xs font-medium rounded-md bg-white/10 text-white/80 border border-white/10">
                  {taskIncompleteCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`${tabStyles.item} ${activeTab === 'comments' ? tabStyles.active : tabStyles.inactive}`}
            >
              Comments
              {commentUnreadCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 text-xs font-medium rounded-md bg-white/10 text-white/80 border border-white/10">
                  {commentUnreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Comments section: always mounted so realtime/unread stay active when tab is inactive; hidden when not selected */}
          <PageSection className={activeTab === 'comments' ? '' : 'hidden'}>
            <GlassCard className="p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                <h2 className={typography.h2}>Comments</h2>
                <button
                  type="button"
                  onClick={() => setShowMentionsInbox((v) => !v)}
                  className="flex items-center gap-2 text-sm text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <span>Mentions</span>
                  {mentionsCount != null && mentionsCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 text-xs font-medium rounded-md bg-white/10 text-white/80 border border-white/10">
                      {mentionsCount}
                    </span>
                  )}
                </button>
              </div>
              <p className="text-sm text-white/60 mb-6">
                Discuss this job with your team. Use @ to mention someone—they&apos;ll get notified.
              </p>
              {showMentionsInbox ? (
                <div className="mb-6">
                  <h3 className={`${typography.h3} mb-3`}>Mentions of you</h3>
                  <MentionsInbox />
                </div>
              ) : null}
              <JobCommentsPanel
                jobId={jobId}
                onError={(msg) => setToast({ message: msg, type: 'error' })}
                onCommentCountChange={setCommentCount}
                onUnreadCountChange={setCommentUnreadCount}
                lastViewedAt={commentsLastViewedAt}
              />
            </GlassCard>
          </PageSection>

          {activeTab === 'activity' ? (
            <PageSection>
              <GlassCard className="p-6 md:p-8">
                <h2 className={`${typography.h2} mb-4`}>Job Activity</h2>
                <p className="text-sm text-white/60 mb-6">
                  Timeline of updates to this job—status changes, documents, and team actions.
                </p>
                <JobActivityFeed
                  jobId={jobId}
                  initialEvents={activityInitialEvents ?? undefined}
                  enableRealtime={true}
                  showFilters={true}
                  maxHeight="70vh"
                />
              </GlassCard>
            </PageSection>
          ) : activeTab === 'signatures' ? (
            <PageSection>
              <GlassCard className="p-6 md:p-8">
                <TeamSignatures
                  jobId={jobId}
                  readOnly={false}
                  onReportRunCreated={() => {
                    setSignatureCount({ signed: 0, total: 3 })
                  }}
                  onSignaturesChange={(signed, total) => {
                    setSignatureCount({ signed, total })
                  }}
                />
              </GlassCard>
            </PageSection>
          ) : activeTab === 'tasks' ? (
            <PageSection>
              <GlassCard className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className={`${typography.h2} mb-1`}>Tasks</h2>
                    <p className="text-sm text-white/60">Track and complete job work items.</p>
                  </div>
                  <button type="button" className={tabStyles.item + ' ' + tabStyles.active} onClick={() => setShowAddTask(true)}>
                    + Add Task
                  </button>
                </div>
                <TaskList
                  jobId={jobId}
                  onAddTask={() => setShowAddTask(true)}
                  onTaskCountChange={(count) => setTaskIncompleteCount(count)}
                  refreshKey={taskRefreshKey}
                />
              </GlassCard>
            </PageSection>
                    ) : activeTab === 'comments' ? null : (
          <>
          <div className="grid lg:grid-cols-3 gap-6 mb-16">
            <GlassCard className="p-10 flex flex-col h-full">
                {/* Growable Content Section */}
                <div className="flex-1">
                  <div className="text-center mb-10">
                    <div className={`text-9xl font-bold mb-4 ${getScoreColor(job.risk_score)}`}>
                      {job.risk_score ?? '—'}
                    </div>
                    <div className="text-2xl font-semibold mb-3 text-white">
                      {job.risk_level ? `${job.risk_level.toUpperCase()} Risk` : 'No Score'}
                    </div>
                    {job.risk_score_detail && (
                      <div className="text-sm text-[#A1A1A1] mb-4">
                        {job.risk_score_detail.factors.length} risk factor{job.risk_score_detail.factors.length !== 1 ? 's' : ''} detected
                      </div>
                    )}
                    <div className="border-t border-white/10 pt-4 mb-4"></div>
                    <p className="text-xs text-white/60 max-w-xs mx-auto">
                      Calculated from identified hazards. Higher scores require more safety controls. This score is logged with timestamp for compliance and insurance purposes.
                    </p>
                  </div>

                  {job.risk_score_detail && job.risk_score_detail.factors.length > 0 && (
                      <div className={`${spacing.gap.normal} ${spacing.section}`}>
                      {job.risk_score_detail.factors.map((factor, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                          <span className="text-[#A1A1A1]">{factor.name}</span>
                          <span className="text-xs text-[#A1A1A1]/70 ml-auto">+{factor.weight}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {totalCount > 0 && (
                    <div className="pt-6 border-t border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-[#A1A1A1]">Mitigation Progress</span>
                        <span className="text-sm font-semibold text-white">
                          {completedCount}/{totalCount}
                        </span>
                      </div>
                      <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-[#F97316] h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Risk & Hazards Section */}
                  <div className={dividerStyles.section}>
                    <div className={`flex items-center justify-between ${spacing.normal}`}>
                      <div>
                        <h3 className={`${typography.h4} mb-1`}>Risk & Hazards</h3>
                        <p className="text-xs text-white/50">
                          {job.risk_score_detail?.factors.length || 0} hazard{job.risk_score_detail?.factors.length !== 1 ? 's' : ''} identified
                        </p>
                      </div>
                    </div>
                    {job.risk_score_detail && job.risk_score_detail.factors.length > 0 ? (
                      <div className={spacing.gap.tight}>
                        {job.risk_score_detail.factors.map((factor, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.03]"
                          >
                            <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                            <div className="flex-1">
                              <div className="text-sm text-white">{factor.name}</div>
                              <div className="text-xs text-white/50 mt-0.5">
                                {factor.severity} severity • +{factor.weight} points
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`${emptyStateStyles.container} py-6`}>
                        <p className="text-sm text-white font-medium mb-2">No hazards identified yet</p>
                        <p className="text-xs text-white/60 max-w-md mx-auto">
                          Hazards determine your risk score and generate required safety controls. Apply a template or select hazards manually to begin your assessment.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Footer - Pinned Inside Card */}
                {organizationId && (
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="primary"
                        onClick={() => setShowApplyTemplate(true)}
                      >
                        Apply Template
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setPrefillTemplateData(null)
                          setShowCreateTemplate(true)
                        }}
                      >
                        + Create Template
                      </Button>
                      {!job.applied_template_id && job.risk_score_detail && job.risk_score_detail.factors.length > 0 && (
                        <Button
                          variant="ghost"
                          onClick={handleSaveAsTemplate}
                          title="Save this job setup as a reusable template"
                        >
                          💾 Save as Template
                        </Button>
                      )}
                    </div>
                  </div>
                )}
            </GlassCard>

            <GlassCard className="p-8 h-full">
                <div className={spacing.relaxed}>
                  <h2 className={`${typography.h2} ${spacing.tight}`}>Controls & Corrective Actions</h2>
                  <p className="text-sm text-white/60">
                    These are the safety controls required to reduce the work record&apos;s overall risk.
                  </p>
                </div>
                {totalCount === 0 ? (
                  <div className={`${emptyStateStyles.container} py-6`}>
                    <p className="text-sm text-white font-medium mb-2">No checklist items yet</p>
                    <p className="text-xs text-white/60 max-w-md mx-auto">
                      Your safety checklist is generated automatically from identified hazards. Add hazards above to see required controls.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {job.mitigation_items.map((item, index) => (
                      <div key={item.id}>
                        <label
                          className={`flex items-start gap-3 p-4 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5 ${
                            item.done ? 'opacity-100' : 'opacity-90'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => toggleMitigation(item.id, item.done)}
                            disabled={updatingMitigation === item.id}
                            className="mt-1 w-5 h-5 rounded border-white/20 bg-[#121212]/60 text-[#F97316] focus:ring-[#F97316] focus:ring-2 disabled:opacity-50"
                          />
                          <span
                            className={`flex-1 text-sm ${
                              item.done ? 'line-through text-[#A1A1A1]/50' : 'text-[#A1A1A1]'
                            }`}
                          >
                            {item.title}
                          </span>
                        </label>
                        {/* Subtle grouping spacing every 4-5 items */}
                        {(index + 1) % 5 === 0 && index < job.mitigation_items.length - 1 && (
                          <div className="h-2"></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {totalCount > 0 && (
                  <p className="text-sm text-[#A1A1A1] mt-6 pt-6 border-t border-white/10">
                    Mark mitigations complete only after verifying the action was performed on-site.
                  </p>
                )}
            </GlassCard>

            <GlassCard className="p-8 h-full flex flex-col">
                <h2 className={`${typography.h2} mb-6 text-white/80`}>Job Details</h2>

                <div className="space-y-4 mb-8 flex-1">
                  {job.description && (
                    <div>
                      <div className="text-xs text-white/40 uppercase mb-1">Description</div>
                      <div className="text-sm text-white/90">{job.description}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-white/40 uppercase mb-1">Created</div>
                    <div className="text-sm text-white/90">
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40 uppercase mb-1">Status</div>
                    <div className="text-sm text-white/90 capitalize">{job.status}</div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 space-y-3">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => router.push(`/operations/jobs/${jobId}/report`)}
                  >
                    View Live Report →
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => router.push(`/operations/jobs/${jobId}/edit`)}
                  >
                    Edit Job Details
                  </Button>
                </div>
            </GlassCard>
          </div>

          {/* Apply Template Inline - Full Width Section */}
          {showApplyTemplate && organizationId && (
            <ApplyTemplateInline
              jobId={jobId}
              organizationId={organizationId}
              currentRiskFactorCodes={currentRiskFactorCodes}
              onClose={() => setShowApplyTemplate(false)}
              onApply={handleApplyTemplate}
            />
          )}

          {/* Permit Packs Section (Business Plan Only) */}
          {subscriptionTier === 'business' && (
            <PageSection>
              <GlassCard className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className={`${typography.h2} mb-2`}>Permit Packs</h2>
                    <p className="text-sm text-white/60">
                      Bundle all job documentation into a single ZIP file for inspectors, permit offices, or insurers. Everything is timestamped and audit-ready.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleGeneratePermitPack}
                    disabled={generatingPermitPack}
                  >
                    {generatingPermitPack ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                        Generating...
                      </>
                    ) : (
                      <>📦 Generate New Pack</>
                    )}
                  </Button>
                </div>

                {loadingPermitPacks ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316] mx-auto mb-4" />
                    <p className="text-sm text-[#A1A1A1]">Loading permit packs...</p>
                  </div>
                ) : permitPacks.length === 0 ? (
                  <div className={`${emptyStateStyles.container} py-8`}>
                    <p className="text-sm text-white font-medium mb-2">No permit packs generated yet</p>
                    <p className="text-xs text-white/60 max-w-md mx-auto mb-4">
                      Permit packs bundle all job documentation into a single ZIP file for inspectors, insurers, or permit offices. Everything is timestamped and audit-ready.
                    </p>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleGeneratePermitPack}
                      disabled={generatingPermitPack}
                    >
                      {generatingPermitPack ? 'Generating...' : 'Generate Your First Permit Pack'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {permitPacks.map((pack) => (
                      <GlassCard key={pack.id} className="p-4">
                        <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#F97316]/20 flex items-center justify-center">
                            <span className="text-xl">📦</span>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">
                              Permit Pack v{pack.version}
                            </div>
                            <div className="text-xs text-[#A1A1A1]">
                              Generated {new Date(pack.generated_at).toLocaleDateString()} at{' '}
                              {new Date(pack.generated_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        {pack.downloadUrl ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => window.open(pack.downloadUrl!, '_blank')}
                          >
                            Download
                          </Button>
                        ) : (
                          <span className="text-xs text-white/60">Unavailable</span>
                        )}
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </GlassCard>
            </PageSection>
          )}

          {/* Job Assignment */}
          <PageSection>
            {loadingWorkers ? (
              <GlassCard className="p-8">
                    <div className="mb-6">
                      <SkeletonLoader variant="text" lines={2} className="mb-2" />
                    </div>
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <SkeletonLoader key={i} variant="card" height="80px" />
                      ))}
                    </div>
              </GlassCard>
            ) : (
                  <JobAssignment
                    jobId={jobId}
                    workers={workers}
                  onAssign={async (workerId) => {
                    try {
                      await jobsApi.assignWorker(jobId, workerId)
                      // Refresh workers list
                      const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
                      const supabase = createSupabaseBrowserClient()
                      const teamData = await teamApi.get()
                      const { data: assignments } = await supabase
                        .from('job_assignments')
                        .select('user_id')
                        .eq('job_id', jobId)
                      const assignedUserIds = new Set(assignments?.map(a => a.user_id) || [])
                      const workersList = teamData.members.map((member: any) => ({
                        id: member.id,
                        name: member.full_name || member.email,
                        email: member.email,
                        role: member.role,
                        checkedIn: false,
                        jobsAssigned: assignedUserIds.has(member.id) ? 1 : 0,
                      }))
                      setWorkers(workersList)
                      setToast({ 
                        message: `Worker assigned. Entry added to Compliance Ledger. [View in Ledger](/operations/audit?job_id=${jobId})`, 
                        type: 'success' 
                      })
                    } catch (err) {
                      setToast({ message: 'Couldn\'t assign that worker. Try again.', type: 'error' })
                      throw err
                    }
                  }}
                  onUnassign={async (workerId) => {
                    try {
                      await jobsApi.unassignWorker(jobId, workerId)
                      // Refresh workers list
                      const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
                      const supabase = createSupabaseBrowserClient()
                      const teamData = await teamApi.get()
                      const { data: assignments } = await supabase
                        .from('job_assignments')
                        .select('user_id')
                        .eq('job_id', jobId)
                      const assignedUserIds = new Set(assignments?.map(a => a.user_id) || [])
                      const workersList = teamData.members.map((member: any) => ({
                        id: member.id,
                        name: member.full_name || member.email,
                        email: member.email,
                        role: member.role,
                        checkedIn: false,
                        jobsAssigned: assignedUserIds.has(member.id) ? 1 : 0,
                      }))
                      setWorkers(workersList)
                      setToast({ 
                        message: `Worker unassigned. Entry added to Compliance Ledger. [View in Ledger](/operations/audit?job_id=${jobId})`, 
                        type: 'success' 
                      })
                    } catch (err) {
                      setToast({ message: 'Couldn\'t unassign that worker. Try again.', type: 'error' })
                      throw err
                    }
                  }}
                  onCheckIn={async (workerId) => {
                    // TODO: Implement check-in API
                    console.log('Check in worker:', workerId)
                  }}
                  onCheckOut={async (workerId) => {
                    // TODO: Implement check-out API
                    console.log('Check out worker:', workerId)
                  }}
                    userRole={userRole}
                  />
            )}
          </PageSection>

          {/* Evidence Verification */}
          <PageSection>
            {loadingEvidence ? (
              <GlassCard className="p-8">
                <div className="mb-6">
                  <SkeletonLoader variant="text" lines={2} className="mb-2" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <SkeletonLoader key={i} variant="card" height="100px" />
                  ))}
                </div>
              </GlassCard>
            ) : (
                  <EvidenceVerification
                    jobId={jobId}
                    items={evidenceItems}
                  onVerify={async (id, status, reason) => {
                    try {
                      await jobsApi.verifyEvidence(jobId, id, status, reason)
                      // Refresh evidence list
                      const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
                      const supabase = createSupabaseBrowserClient()
                      const { data: documents } = await supabase
                        .from('documents')
                        .select('*, evidence_verifications(status, reviewed_by, reviewed_at, rejection_reason)')
                        .eq('job_id', jobId)
                      const { data: mitigations } = await supabase
                        .from('mitigation_items')
                        .select('*, documents(*)')
                        .eq('job_id', jobId)
                      const evidenceList: typeof evidenceItems = []
                      documents?.forEach((doc: any) => {
                        const verification = doc.evidence_verifications?.[0]
                        evidenceList.push({
                          id: doc.id,
                          type: doc.file_type?.startsWith('image/') ? 'photo' : 'document',
                          name: doc.file_name || 'Untitled',
                          url: doc.file_path,
                          status: verification?.status || 'pending',
                          submittedBy: doc.uploaded_by || 'Unknown',
                          submittedAt: doc.created_at,
                          verifiedBy: verification?.reviewed_by,
                          verifiedAt: verification?.reviewed_at,
                          rejectionReason: verification?.rejection_reason,
                        })
                      })
                      mitigations?.forEach((mit: any) => {
                        mit.documents?.forEach((photo: any) => {
                          const verification = photo.evidence_verifications?.[0]
                          evidenceList.push({
                            id: photo.id,
                            type: 'mitigation',
                            name: `Mitigation: ${mit.title}`,
                            url: photo.file_path,
                            status: verification?.status || 'pending',
                            submittedBy: photo.uploaded_by || 'Unknown',
                            submittedAt: photo.created_at,
                            verifiedBy: verification?.reviewed_by,
                            verifiedAt: verification?.reviewed_at,
                            rejectionReason: verification?.rejection_reason,
                          })
                        })
                      })
                      setEvidenceItems(evidenceList)
                      setToast({ 
                        message: status === 'approved' 
                          ? `Evidence approved. Entry added to Compliance Ledger. [View in Ledger](/operations/audit?job_id=${jobId})` 
                          : `Evidence rejected. Entry added to Compliance Ledger. [View in Ledger](/operations/audit?job_id=${jobId})`, 
                        type: 'success' 
                      })
                    } catch (err) {
                      setToast({ message: 'Couldn\'t verify that evidence. Try again.', type: 'error' })
                      throw err
                    }
                  }}
                    userRole={userRole}
                  />
            )}
          </PageSection>

          {/* Version History - Lazy Load */}
          <PageSection>
            <div
              onMouseEnter={() => {
                // Only load version history if feature is available (Business plan)
                if (!showVersionHistory && !loadingVersionHistory && subscriptionTier === 'business') {
                  setShowVersionHistory(true)
                  loadVersionHistory()
                }
              }}
            >
              {loadingVersionHistory ? (
                <GlassCard className="p-8">
                  <div className="mb-6">
                    <SkeletonLoader variant="text" lines={2} className="mb-2" />
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <SkeletonLoader key={i} variant="card" height="60px" />
                    ))}
                  </div>
                </GlassCard>
              ) : (
                  <VersionHistory
                    jobId={jobId}
                    entries={versionHistoryEntries}
                  />
              )}
            </div>
          </PageSection>

          {/* Job Packet View */}
          <PageSection>
            <div id="job-packet">
                <JobPacketView
                  job={job}
                  mitigations={job.mitigation_items || []}
                  auditTimeline={versionHistoryEntries.map(entry => ({
                    id: entry.id,
                    event_type: entry.actionType || entry.changeType || 'updated',
                    user_name: entry.changedBy || undefined,
                    created_at: entry.changedAt,
                    metadata: entry.metadata,
                  }))}
                  attachments={attachments}
                  signoffs={signoffs}
                  onExport={async (packType) => {
                    try {
                      const response = await jobsApi.exportProofPack(jobId, packType)
                      
                      // Download PDF
                      if (response.data.pdf_base64) {
                        const blob = base64ToBlob(response.data.pdf_base64, 'application/pdf')
                        if (blob) {
                          const url = URL.createObjectURL(blob)
                          const link = document.createElement('a')
                          link.href = url
                          link.download = `${job.client_name}-${packType}-packet.pdf`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          URL.revokeObjectURL(url)
                          setToast({ 
                            message: `${packType === 'insurance' ? 'Insurance' : packType === 'audit' ? 'Audit' : packType === 'incident' ? 'Incident' : 'Compliance'} Packet exported. Entry added to Compliance Ledger. [View in Ledger](/operations/audit?job_id=${jobId})`, 
                            type: 'success' 
                          })
                        }
                      }
                    } catch (err: any) {
                      setToast({ message: err.message || 'Export failed', type: 'error' })
                    }
                  }}
                  onAttachmentUploaded={async () => {
                    // Reload attachments
                    try {
                      const documentsResponse = await jobsApi.getDocuments(jobId)
                      const docs = documentsResponse.data || []
                      setAttachments(docs.map((doc: any) => ({
                        id: doc.id,
                        name: doc.file_name || doc.name || 'Untitled',
                        type: doc.type === 'photo' ? 'photo' :
                              doc.file_name?.toLowerCase().includes('permit') ? 'permit' :
                              doc.file_name?.toLowerCase().includes('inspection') ? 'inspection' : 'document',
                        url: doc.url ?? doc.file_path,
                        file_path: doc.file_path ?? doc.storage_path,
                        created_at: doc.created_at,
                        category: doc.type === 'photo' ? (doc.category ?? undefined) : undefined,
                      })))
                    } catch (err) {
                      console.error('Failed to reload attachments:', err)
                    }
                  }}
                  onAttachmentCategoryChange={async (docId, newCategory) => {
                    const previous = attachments.map((a) => (a.id === docId ? { ...a } : a))
                    setAttachments((prev) =>
                      prev.map((a) => (a.id === docId ? { ...a, category: newCategory } : a))
                    )
                    try {
                      await jobsApi.updateDocumentCategory(jobId, docId, newCategory)
                      setToast({ message: 'Category updated', type: 'success' })
                    } catch (err) {
                      setAttachments(previous)
                      setToast({ message: 'Failed to update category', type: 'error' })
                    }
                  }}
                />
            </div>
          </PageSection>
          </>
          )}
        </AppShell>
      </AppBackground>
      <GenerationProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        onComplete={() => {
          setShowProgressModal(false)
        }}
        type="permit-pack"
      />

      {/* Create Template Modal */}
      {showCreateTemplate && organizationId && riskFactors.length > 0 && (
        <TemplateModal
          type="hazard"
          template={null}
          organizationId={organizationId}
          subscriptionTier={subscriptionTier}
          riskFactors={riskFactors}
          usageCount={0}
          prefillData={prefillTemplateData || undefined}
          onClose={() => {
            setShowCreateTemplate(false)
            setPrefillTemplateData(null)
          }}
          onSave={() => {
            setShowCreateTemplate(false)
            setPrefillTemplateData(null)
            setToast({ 
              message: `Template created. Entry added to Compliance Ledger. [View in Ledger](/operations/audit)`, 
              type: 'success' 
            })
          }}
          onSaveAndApply={handleSaveAndApplyTemplate}
        />
      )}

      {/* Toast Notification */}
      <Toast
        message={toast?.message || ''}
        type={toast?.type || 'success'}
        isOpen={toast !== null}
        onClose={() => setToast(null)}
      />

      <ErrorModal
        isOpen={error !== null}
        title={error?.includes('Business plan') ? 'Plan Upgrade Required' : 'Error'}
        message={error || ''}
        onClose={() => setError(null)}
        onRetry={async () => {
          setError(null)
          await loadJob()
        }}
        retryLabel="Reload Job"
        showBackButton={true}
        onBack={() => {
          setError(null)
          router.push('/operations/jobs')
        }}
      />

      <AddTaskModal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        jobId={jobId}
        onTaskAdded={handleAddTask}
        onUseTemplate={() => {
          setShowAddTask(false)
          setShowTemplateSelector(true)
        }}
      />

      <TaskTemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        jobId={jobId}
        onApply={handleApplyTaskTemplate}
      />
    </ProtectedRoute>
  )
}
