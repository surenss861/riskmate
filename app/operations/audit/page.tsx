'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Filter, Shield, AlertTriangle, User, Calendar, FileText, Clock, CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronUp, Building2, MoreVertical, Package } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { jobsApi, auditApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { typography } from '@/lib/styles/design-system'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { AppBackground, AppShell, PageSection, GlassCard, Button, ActionButton, Select, PageHeader, EventChip, TrustReceiptStrip, IntegrityBadge, EnforcementBanner, EmptyState } from '@/components/shared'
import { useAction } from '@/lib/hooks/useAction'
import { getEventMapping, categorizeEvent, type EventCategory, type EventSeverity, type EventOutcome } from '@/lib/audit/eventMapper'
import { getIndustryLanguage } from '@/lib/audit/industryLanguage'
import { SavedViewCards } from '@/components/audit/SavedViewCards'
import { SavedViewCardsSkeleton } from '@/components/audit/SavedViewCardsSkeleton'
import { LedgerEventListSkeleton } from '@/components/audit/LedgerEventListSkeleton'
import { EvidenceDrawer } from '@/components/audit/EvidenceDrawer'
import { AssignModal } from '@/components/audit/AssignModal'
import { ResolveModal } from '@/components/audit/ResolveModal'
import { CreateCorrectiveActionModal } from '@/components/audit/CreateCorrectiveActionModal'
import { CloseIncidentModal } from '@/components/audit/CloseIncidentModal'
import { RevokeAccessModal } from '@/components/audit/RevokeAccessModal'
import { FlagSuspiciousModal } from '@/components/audit/FlagSuspiciousModal'
import { EventSelectionTable } from '@/components/audit/EventSelectionTable'
import { SelectedActionBar } from '@/components/audit/SelectedActionBar'
import { BulkActionResultModal } from '@/components/audit/BulkActionResultModal'
import { EventDetailsDrawer } from '@/components/audit/EventDetailsDrawer'
import { PackHistoryDrawer } from '@/components/audit/PackHistoryDrawer'
import { useSelectedRows } from '@/lib/hooks/useSelectedRows'
import { terms } from '@/lib/terms'

interface AuditEvent {
  id: string
  event_type: string
  event_name?: string
  user_id?: string
  user_name?: string
  user_email?: string
  user_role?: string
  job_id?: string
  job_name?: string
  site_id?: string
  site_name?: string
  created_at: string
  metadata?: any
  organization_id: string
  actor_id?: string
  actor_name?: string
  actor_email?: string
  actor_role?: string
  target_type?: string
  target_id?: string
  category?: string
  category_tab?: 'governance' | 'operations' | 'access' // Computed by backend for backward compatibility
  severity?: 'critical' | 'material' | 'info'
  outcome?: 'blocked' | 'allowed' | 'success' | 'failure'
}

type TimeRange = '24h' | '7d' | '30d' | 'custom' | 'all'
export type SavedView = 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review' | 'custom'

export default function AuditViewPage() {
  const router = useRouter()
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<EventCategory>('governance')
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    job: '',
    user: '',
    site: '',
    timeRange: '30d' as TimeRange,
    severity: '' as EventSeverity | '',
    outcome: '' as EventOutcome | '',
    savedView: 'review-queue' as SavedView, // Default to Review Queue
  })
  const [jobs, setJobs] = useState<Array<{ id: string; client_name: string; site_name?: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role?: string }>>([])
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([])
  const [industryVertical, setIndustryVertical] = useState<string | null>(null)
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false)
  const [evidenceJobId, setEvidenceJobId] = useState<string | undefined>()
  const [evidenceJobName, setEvidenceJobName] = useState<string | undefined>()
  const [evidenceSiteName, setEvidenceSiteName] = useState<string | undefined>()
  const [eventDetailsDrawerOpen, setEventDetailsDrawerOpen] = useState(false)
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<AuditEvent | null>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [resolveModalOpen, setResolveModalOpen] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<{
    type: 'event' | 'job'
    id: string
    name?: string
    severity?: 'critical' | 'material' | 'info'
    requiresEvidence?: boolean
    hasEvidence?: boolean
  } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; requestId?: string; description?: string } | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [bulkResultModal, setBulkResultModal] = useState<{
    isOpen: boolean
    title: string
    succeededCount: number
    failedCount: number
    succeededIds?: string[]
    failures?: Array<{ id: string; code: string; message: string }>
    requestId?: string
  } | null>(null)
  const [mutationLoading, setMutationLoading] = useState(false)
  const [highlightedFailedIds, setHighlightedFailedIds] = useState<Set<string>>(new Set())
  const [advancedExportMenuOpen, setAdvancedExportMenuOpen] = useState(false)
  const [packHistoryDrawerOpen, setPackHistoryDrawerOpen] = useState(false)
  const selectionHook = useSelectedRows()
  const { selectedIds, selectedCount } = selectionHook

  useEffect(() => {
    loadAuditEvents()
    loadJobs()
    loadUsers()
    loadSites()
    loadIndustryVertical()
    loadUserRole()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadUserRole = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        setUserRole(userData?.role || 'member')
      }
    } catch (err) {
      console.error('Failed to load user role:', err)
    }
  }

  const loadIndustryVertical = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: orgData } = await supabase
        .from('organizations')
        .select('trade_type')
        .single()

      if (orgData?.trade_type) {
        setIndustryVertical(orgData.trade_type)
      }
    } catch (err) {
      console.warn('Failed to load industry vertical:', err)
    }
  }

  useEffect(() => {
    loadAuditEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, activeTab])

  // Prune selection: remove IDs that no longer exist in the dataset
  // This prevents "ghost selection" when data changes
  const pruneSelection = (currentEvents: AuditEvent[]) => {
    if (selectedIds.length === 0) return
    
    const eventIds = new Set(currentEvents.map(e => e.id))
    const jobIds = new Set(currentEvents.filter(e => e.job_id).map(e => e.job_id!))
    
    const validSelectedIds = selectedIds.filter(id => 
      eventIds.has(id) || jobIds.has(id)
    )
    
    if (validSelectedIds.length !== selectedIds.length) {
      // Some selected IDs are no longer in the dataset - prune them
      selectionHook.clearSelection()
      validSelectedIds.forEach(id => selectionHook.toggleSelection(id))
    }
  }

  const loadAuditEvents = async () => {
    try {
      setLoading(true)
      
      // Use new backend endpoint with server-side enrichment
      // Don't send category when view is present (view takes precedence and includes category logic)
      // Map activeTab to valid backend categories: 'governance', 'operations', 'access'
      const hasView = filters.savedView && filters.savedView !== 'custom'
      const categoryForRequest = hasView 
        ? undefined // View takes precedence
        : (activeTab === 'governance' 
          ? 'governance' // 'governance' IS a valid backend category
          : activeTab as 'operations' | 'access' | undefined) // Send valid categories
      
      // Type guard: only pass valid view values (exclude 'custom')
      const viewForRequest = hasView 
        ? (filters.savedView as 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review')
        : undefined
      
      const response = await auditApi.getEvents({
        category: categoryForRequest,
        site_id: filters.site || undefined,
        job_id: filters.job || undefined,
        actor_id: filters.user || undefined,
        severity: filters.severity || undefined,
        outcome: filters.outcome || undefined,
        time_range: filters.timeRange,
        view: viewForRequest,
        limit: 500,
      })

      const enrichedEvents = (response.data.events || []).map((event: any) => ({
        ...event,
        event_type: event.event_name || event.event_type || 'unknown',
        job_name: event.job_title || event.job_name,
        user_name: event.actor_name || event.user_name,
        user_email: event.user_email || event.actor_email,
        user_role: event.actor_role || event.user_role,
        site_name: event.site_name,
        category: event.category,
        severity: event.severity,
        outcome: event.outcome,
      }))

      const finalEvents = enrichedEvents as AuditEvent[]
      setEvents(finalEvents)
      
      // Prune selection after loading new data
      pruneSelection(finalEvents)
      
      // Update summary metrics from backend stats
      if (response.data.stats) {
        // Stats are already computed server-side, but we'll recalculate from filtered events
        // for consistency with UI
      }
    } catch (err: any) {
      console.error('Failed to load ledger events:', err)
      
      // Log request ID if available for easier debugging
      if (err.requestId) {
        console.error(`Request ID: ${err.requestId} - Search this in Vercel logs to find the exact error`)
      }

      // Show user-friendly error toast
      setToast({
        message: err.message || 'Failed to load ledger events. Please try again.',
        type: 'error',
      })

      // Fallback to direct Supabase query if backend fails
      try {
        const supabase = createSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data: orgData } = await supabase
          .from('organizations')
          .select('id')
          .single()

        if (!orgData) return

        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('organization_id', orgData.id)
          .order('created_at', { ascending: false })
          .limit(500)

        if (error) throw error
        const fallbackEvents = (data || []) as AuditEvent[]
        setEvents(fallbackEvents)
        // Prune selection after fallback load
        pruneSelection(fallbackEvents)
      } catch (fallbackErr) {
        console.error('Fallback query also failed:', fallbackErr)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadJobs = async () => {
    try {
      const response = await jobsApi.list({ limit: 1000 })
      setJobs(response.data || [])
    } catch (err) {
      console.error('Failed to load jobs:', err)
    }
  }

  const loadUsers = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .single()

      if (!orgData) return

      const { data: users, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('organization_id', orgData.id)

      if (!error && users) {
        setUsers(users.map((u: any) => ({
          id: u.id,
          name: u.full_name || 'Unknown',
          email: u.email || '',
          role: u.role,
        })))
      }
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  const loadSites = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .single()

      if (!orgData) return

      const { data: sitesData, error } = await supabase
        .from('sites')
        .select('id, name')
        .eq('organization_id', orgData.id)

      if (!error && sitesData) {
        setSites(sitesData)
      }
    } catch (err) {
      // Sites table might not exist yet
      console.warn('Sites table not available:', err)
    }
  }

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  // Calculate summary metrics
  const summaryMetrics = {
    totalEvents: events.length,
    governanceViolations: events.filter(e => {
      const mapping = getEventMapping(e.event_type)
      return mapping.category === 'governance' && mapping.outcome === 'blocked'
    }).length,
    highRiskJobsTouched: new Set(events.filter(e => e.job_id).map(e => e.job_id)).size,
    proofPacksGenerated: events.filter(e => e.event_type?.includes('proof_pack')).length,
    signoffsRecorded: events.filter(e => e.event_type?.includes('signoff')).length,
    accessChanges: events.filter(e => categorizeEvent(e.event_type) === 'access').length,
  }

  // Filter events by active tab (unless a Saved View is active)
  // Map events to the three main Compliance Ledger tabs:
  // - governance: Blocked actions, policy enforcement, violations
  // - operations: Human actions (assign/resolve/waive, corrective actions, incident closures, exports)
    // - access: Identity + governance (access changes, logins, security events)
  const filteredEvents = events.filter(e => {
    if (filters.savedView && filters.savedView !== 'custom') {
      // Saved Views show all relevant events regardless of tab
      return true
    }
    
    // Use category_tab from backend if available (computed with backward compatibility),
    // otherwise compute from category/event_type client-side
    const categoryTab = e.category_tab || (() => {
      const eventCategory = e.category || categorizeEvent(e.event_type || '')
      
      // Map sub-categories to main tabs
      if (eventCategory === 'governance' || eventCategory === 'governance_enforcement') {
        return 'governance'
      } else if (['access', 'access_review', 'access_security'].includes(eventCategory)) {
        return 'access'
      } else {
        // Operations includes: operations, review_queue, incident_review, attestations, system
        return 'operations'
      }
    })()
    
    return categoryTab === activeTab
  })

  const formatRelativeTime = (date: string) => {
    const now = new Date()
    const eventDate = new Date(date)
    const diffMs = now.getTime() - eventDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return eventDate.toLocaleDateString()
  }

  const industryLang = getIndustryLanguage(industryVertical)

  // Export action (CSV/PDF/JSON) - using useAction for standardized UX
  const exportAction = useAction(
    async (format: 'csv' | 'json' | 'pdf', view: string) => {
      let endpoint = ''
      const params = new URLSearchParams({
        format,
        time_range: filters.timeRange || '30d',
      })

      // Add view filter if applicable
      if (view && view !== 'custom') {
        params.append('view', view)
      }

      // Route to appropriate export endpoint based on view
      if (view === 'review-queue') {
        endpoint = `/api/review-queue/export?${params.toString()}`
      } else if (view === 'access-review') {
        endpoint = `/api/access/export?${params.toString()}`
      } else if (view === 'incident-review') {
        endpoint = `/api/incidents/export?${params.toString()}`
      } else if (view === 'governance-enforcement') {
        const exportParams = new URLSearchParams({
          format: format === 'json' ? 'json' : 'csv',
          time_range: filters.timeRange || '30d',
        })
        endpoint = `/api/enforcement-reports/export?${exportParams.toString()}`
      } else if (view === 'insurance-ready') {
        endpoint = `/api/proof-packs/export?${params.toString()}`
      } else {
        endpoint = `/api/audit/export?${params.toString()}`
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorText = await response.text()
        let error
        try {
          error = JSON.parse(errorText)
        } catch {
          error = { message: errorText || 'Export failed' }
        }
        throw new Error(error.message || error.error || 'Export failed')
      }

      // Handle different content types
      const contentType = response.headers.get('content-type') || ''
      let filename = ''

      if (contentType.includes('application/json')) {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        filename = `${view}-export-${new Date().toISOString().split('T')[0]}.json`
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else if (contentType.includes('text/csv')) {
        const blob = await response.blob()
        filename = `${view}-export-${new Date().toISOString().split('T')[0]}.csv`
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else if (contentType.includes('application/pdf')) {
        const blob = await response.blob()
        const contentDisposition = response.headers.get('Content-Disposition')
        filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `${view}-export-${new Date().toISOString().split('T')[0]}.pdf`
          : `${view}-export-${new Date().toISOString().split('T')[0]}.pdf`
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        // Fallback: try to parse as JSON
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        filename = `${view}-export-${new Date().toISOString().split('T')[0]}.json`
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }

      return filename
    },
    {
      onSuccess: (filename) => {
        setToast({
          message: `CSV export completed: ${filename}. Use this for human workflow.`,
          type: 'success',
        })
      },
      onError: (err: any) => {
        setToast({
          message: err.message || 'CSV export failed. Please try again.',
          type: 'error',
        })
      },
    }
  )

  const handleExportFromView = (format: 'csv' | 'json', view: string) => {
    exportAction.run(format, view)
  }

  // CSV export handler (used by SavedViewCards)
  const handleExportCSV = (view: string) => {
    exportAction.run('csv', view)
  }

  // API payload (JSON) export - using useAction for standardized UX
  const apiPayloadAction = useAction(
    async () => {
      const endpoint = '/api/audit/export'
      
      const filterPayload: any = {
        format: 'json',
        category: activeTab,
        time_range: filters.timeRange || '30d',
        ...(filters.job && { job_id: filters.job }),
        ...(filters.site && { site_id: filters.site }),
        ...(filters.user && { actor_id: filters.user }),
        ...(filters.severity && { severity: filters.severity }),
        ...(filters.outcome && { outcome: filters.outcome }),
      }

      // Use current saved view if applicable
      if (filters.savedView && filters.savedView !== 'custom') {
        filterPayload.view = filters.savedView
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(filterPayload),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        const errorMessage = error.message || error.error || 'Failed to export API payload. Use this for automation/integration.'
        if (error.code === 'BACKEND_CONFIG_ERROR' || error.code === 'BACKEND_CONNECTION_ERROR') {
          throw new Error(error.hint || 'Backend server configuration error. Please check Vercel environment variables.')
        }
        throw new Error(errorMessage)
      }

      // Download the JSON file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `audit-payload-${new Date().toISOString().split('T')[0]}.json`
        : `audit-payload-${new Date().toISOString().split('T')[0]}.json`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      return filename
    },
    {
      onSuccess: (filename) => {
        setToast({
          message: `API payload exported: ${filename}. Use this for automation/integration.`,
          type: 'success',
        })
      },
      onError: (err: any) => {
        setToast({
          message: err.message || 'API payload export failed. Please try again.',
          type: 'error',
        })
      },
    }
  )

  // Generate Proof Pack action (using useAction for standardized UX)
  const generatePackAction = useAction(
    async (view?: string) => {
      const endpoint = '/api/audit/export/pack'

      // Build filter payload (supports all saved view filters)
      const filterPayload: any = {
        time_range: filters.timeRange || '30d',
        ...(filters.job && { job_id: filters.job }),
        ...(filters.site && { site_id: filters.site }),
        ...(filters.user && { actor_id: filters.user }),
        ...(filters.severity && { severity: filters.severity }),
        ...(filters.outcome && { outcome: filters.outcome }),
      }

      // Use provided view or current saved view
      if (view && view !== 'custom') {
        filterPayload.view = view
      } else if (filters.savedView && filters.savedView !== 'custom') {
        filterPayload.view = filters.savedView
      } else if (!view && !filters.savedView && activeTab) {
        filterPayload.category = activeTab
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(filterPayload),
      })

      if (!response.ok) {
        // Extract error ID from response headers first
        const errorIdFromHeader = response.headers.get('X-Error-ID')
        
        // CRITICAL: Always try to parse as JSON (proxy should always return JSON)
        // If parsing fails, create a structured error anyway
        let error: any = {}
        try {
          const errorText = await response.text()
          try {
            error = JSON.parse(errorText)
          } catch {
            // If response is not JSON, wrap it in a structured error
            error = {
              message: 'Failed to generate proof pack',
              raw: errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText,
            }
          }
        } catch (err) {
          // If reading response fails, use default error
          error = { message: 'Failed to generate proof pack' }
        }
        
        // Extract structured error details
        const errorMessage = error.message || error.error || 'Failed to generate proof pack'
        const errorId = error.error_id || error.errorId || errorIdFromHeader
        const hint = error.support_hint || error.hint
        const code = error.code
        
        // Create error object with all details for onError handler
        const errorWithDetails = new Error(errorMessage) as any
        errorWithDetails.error_id = errorId
        errorWithDetails.errorId = errorId
        errorWithDetails.code = code
        errorWithDetails.support_hint = hint
        errorWithDetails.hint = hint
        
        throw errorWithDetails
      }

      // Download the ZIP file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `audit-pack-${Date.now()}.zip`
        : `audit-pack-${Date.now()}.zip`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      return filename
    },
    {
      onSuccess: (filename) => {
        setToast({
          message: `Proof Pack generated: ${filename}`,
          type: 'success',
        })
      },
      onError: (err: any) => {
        // Extract structured error details (code, message, hint, error_id)
        const errorMessage = err.message || 'Failed to generate proof pack'
        const errorId = err.error_id || err.errorId
        const hint = err.support_hint || err.hint || err.supportHint
        
        // Build user-friendly error message with error ID
        let displayMessage = errorMessage
        if (errorId) {
          displayMessage = `${errorMessage} (Error ID: ${errorId})`
        }
        
        setToast({
          message: displayMessage,
          description: hint || 'Please try again or contact support with the Error ID if this persists.',
          type: 'error',
        })
      },
    }
  )

  const handleGeneratePack = (view?: string) => generatePackAction.run(view)

  const handleAssign = async (assignment: {
    owner_id: string
    due_date: string
    priority?: 'low' | 'medium' | 'high'
    note?: string
  }) => {
    // Prevent duplicate requests
    if (mutationLoading) {
      return
    }

    // Use selected IDs if available, otherwise use selectedTarget (single selection)
    const itemIds = selectedIds.length > 0 ? selectedIds : (selectedTarget ? [selectedTarget.id] : [])

    if (itemIds.length === 0) {
      setToast({
        message: 'Please select at least one item to assign',
        type: 'error',
      })
      return
    }

    try {
      setMutationLoading(true)
      const response = await fetch('/api/review-queue/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item_ids: itemIds,
          assignee_id: assignment.owner_id,
          priority: assignment.priority || 'medium',
          due_at: assignment.due_date,
          note: assignment.note,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to assign')
      }

      const data = await response.json()
      const requestId = response.headers.get('X-Request-ID') || data.requestId

      // Handle partial failures
      if (data.data?.partial_success || (data.data?.failed_ids && data.data.failed_ids.length > 0)) {
        const failedIds = data.data?.failed_ids || []
        const succeededIds = data.data?.succeeded_ids || []
        
        // Clear succeeded items from selection, keep failed items
        const newSelection = selectedIds.filter(id => failedIds.includes(id))
        selectionHook.clearSelection()
        newSelection.forEach(id => selectionHook.toggleSelection(id))

        setBulkResultModal({
          isOpen: true,
          title: 'Assignment Results',
          succeededCount: succeededIds.length,
          failedCount: failedIds.length,
          succeededIds,
          failures: data.data?.failures || [],
          requestId,
        })

        setToast({
          message: `Assigned ${succeededIds.length} item(s), ${failedIds.length} failed`,
          type: 'success',
          requestId: process.env.NODE_ENV === 'development' ? requestId : undefined,
        })
      } else {
        // Full success - clear selection
        selectionHook.clearSelection()
        setToast({
          message: `Successfully assigned ${data.data?.assigned_count || itemIds.length} item(s). Entry added to Compliance Ledger.`,
          type: 'success',
          requestId: process.env.NODE_ENV === 'development' ? requestId : undefined,
        })
      }
      
      // Reload events to show the new assignment
      await loadAuditEvents()
    } catch (err: any) {
      console.error('Failed to assign:', err)
      
      // Handle 401 (unauthorized/expired session)
      if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
        setToast({
          message: 'Your session has expired. Please log in again.',
          type: 'error',
        })
        // Optionally redirect to login
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
        return
      }
      
      // Try to extract request ID from error response
      const requestId = err.requestId || (err.response?.headers?.get?.('X-Request-ID'))
      setToast({
        message: err.message || 'Failed to assign. Please try again.',
        type: 'error',
        requestId: process.env.NODE_ENV === 'development' ? requestId : undefined,
      })
      throw err
    } finally {
      setMutationLoading(false)
    }
  }

  const handleResolve = async (resolution: {
    reason: string
    comment: string
    requires_followup: boolean
    waived?: boolean
    waiver_reason?: string
    expires_at?: string
  }) => {
    // Prevent duplicate requests
    if (mutationLoading) {
      return
    }

    // Use selected IDs if available, otherwise use selectedTarget (single selection)
    const itemIds = selectedIds.length > 0 ? selectedIds : (selectedTarget ? [selectedTarget.id] : [])

    if (itemIds.length === 0) {
      setToast({
        message: 'Please select at least one item to resolve',
        type: 'error',
      })
      return
    }

    try {
      setMutationLoading(true)
      const response = await fetch('/api/review-queue/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item_ids: itemIds,
          resolution: resolution.reason,
          notes: resolution.comment,
          waived: resolution.waived,
          waiver_reason: resolution.waiver_reason,
          expires_at: resolution.expires_at,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to resolve')
      }

      const data = await response.json()
      const requestId = response.headers.get('X-Request-ID') || data.requestId

      // Handle partial failures
      if (data.data?.partial_success || (data.data?.failed_ids && data.data.failed_ids.length > 0)) {
        const failedIds = data.data?.failed_ids || []
        const succeededIds = data.data?.succeeded_ids || []
        
        // Clear succeeded items from selection, keep failed items
        const newSelection = selectedIds.filter(id => failedIds.includes(id))
        selectionHook.clearSelection()
        newSelection.forEach(id => selectionHook.toggleSelection(id))

        setBulkResultModal({
          isOpen: true,
          title: 'Resolution Results',
          succeededCount: succeededIds.length,
          failedCount: failedIds.length,
          succeededIds,
          failures: data.data?.failures || [],
          requestId,
        })

        setToast({
          message: `Resolved ${succeededIds.length} item(s), ${failedIds.length} failed`,
          type: 'success',
          requestId: process.env.NODE_ENV === 'development' ? requestId : undefined,
        })
      } else {
        // Full success - clear selection
        selectionHook.clearSelection()
        setToast({
          message: `Successfully resolved ${data.data?.resolved_count || itemIds.length} item(s). Entry added to Compliance Ledger.`,
          type: 'success',
          requestId: process.env.NODE_ENV === 'development' ? requestId : undefined,
        })
      }
      
      // Reload events to show the resolution
      loadAuditEvents()
    } catch (err: any) {
      console.error('Failed to resolve:', err)
      setToast({
        message: err.message || 'Failed to resolve. Please try again.',
        type: 'error',
      })
      throw err
    }
  }

  // Handler for bulk result modal close
  const handleBulkResultClose = () => {
    setBulkResultModal(null)
  }

  // Handler to show failed items in table
  const handleShowFailedItems = (failedIds: string[]) => {
    // Clear current selection and select failed items
    selectionHook.clearSelection()
    failedIds.forEach(id => {
      if (events.some(e => e.id === id || e.job_id === id)) {
        selectionHook.toggleSelection(id)
      }
    })
    
    // Highlight failed items for 8 seconds
    setHighlightedFailedIds(new Set(failedIds))
    setTimeout(() => {
      setHighlightedFailedIds(new Set())
    }, 8000)
    
    // Scroll to table if it exists
    const tableElement = document.querySelector('[data-event-table]')
    if (tableElement) {
      tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleAssignClick = (event?: AuditEvent) => {
    if (!event) {
      // Called from card action - use first event from filtered list that needs assignment
      const needsAssignment = events.find(e => 
        e.outcome === 'blocked' || 
        e.severity === 'critical' || 
        e.severity === 'material' ||
        e.metadata?.needs_assignment === true
      )
      if (!needsAssignment) {
        alert('No events found that require assignment. Please select an event from the list.')
        return
      }
      event = needsAssignment
    }

    setSelectedTarget({
      type: 'event',
      id: event.id,
      name: event.job_name || event.event_type || 'Event',
    })
    setAssignModalOpen(true)
  }

  const handleResolveClick = (event?: AuditEvent) => {
    if (!event) {
      // Called from card action - use first event from filtered list that needs resolution
      const needsResolution = events.find(e => 
        e.outcome === 'blocked' || 
        e.severity === 'critical' || 
        e.severity === 'material' ||
        e.metadata?.needs_resolution === true
      )
      if (!needsResolution) {
        alert('No events found that require resolution. Please select an event from the list.')
        return
      }
      event = needsResolution
    }

    // Determine if evidence is required based on event type
    const requiresEvidence = event.event_type?.includes('missing_evidence') || 
                            event.metadata?.requires_evidence === true
    const hasEvidence = event.metadata?.has_evidence === true || 
                       event.job_id !== undefined // If linked to job, assume evidence might exist

    setSelectedTarget({
      type: event.job_id ? 'job' : 'event',
      id: event.job_id || event.id,
      name: event.job_name || event.event_type || 'Event',
      severity: event.metadata?.severity || 'info',
      requiresEvidence,
      hasEvidence,
    })
    setResolveModalOpen(true)
  }

  const handleExportEnforcement = async (view: string) => {
    try {
      const params = new URLSearchParams({
        format: 'pdf',
        time_range: filters.timeRange || '30d',
        categories: 'governance',
      })

      const response = await fetch(`/api/enforcement-reports/export?${params.toString()}`, {
        method: 'GET',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `enforcement-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setToast({
        message: 'Enforcement report exported successfully',
        type: 'success',
      })
    } catch (err: any) {
      console.error('Failed to export enforcement report:', err)
      setToast({
        message: err.message || 'Failed to export enforcement report. Please try again.',
        type: 'error',
      })
    }
  }

  const [createCorrectiveActionModalOpen, setCreateCorrectiveActionModalOpen] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<{
    workRecordId?: string
    workRecordName?: string
    incidentEventId?: string
    severity?: 'critical' | 'material' | 'info'
  } | null>(null)

  const handleCreateCorrectiveAction = async (action: {
    title: string
    owner_id: string
    due_date: string
    verification_method: string
    notes?: string
  }) => {
    if (!selectedIncident?.workRecordId) return

    try {
      const token = await (async () => {
        const supabase = createSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token || null
      })()

      const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''
      const response = await fetch(`${API_URL}/api/audit/incidents/corrective-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          work_record_id: selectedIncident.workRecordId,
          incident_event_id: selectedIncident.incidentEventId,
          ...action,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to create corrective action')
      }

      const data = await response.json()

      setToast({
        message: `Corrective action created. Entry added to Compliance Ledger. View at /operations/audit?event_id=${data.control_id}`,
        type: 'success',
      })
      
      loadAuditEvents()
    } catch (err: any) {
      console.error('Failed to create corrective action:', err)
      setToast({
        message: err.message || 'Failed to create corrective action. Please try again.',
        type: 'error',
      })
      throw err
    }
  }

  const handleCreateCorrectiveActionClick = (view: string) => {
    // Check for selection first, then fall back to finding from events
    let incidentEvent: AuditEvent | undefined
    
    if (selectionHook.selectedIds.length > 0) {
      incidentEvent = events.find(e => selectionHook.selectedIds.includes(e.id) && e.job_id)
    } else {
      // Find first incident from filtered events
      incidentEvent = events.find(e => 
        e.job_id && (
          e.severity === 'critical' || 
          e.severity === 'material' ||
          e.metadata?.flagged === true ||
          e.event_type?.includes('incident')
        )
      )
    }
    
    if (!incidentEvent || !incidentEvent.job_id) {
      setToast({
        message: 'Please select an incident from the list to create a corrective action',
        type: 'error',
      })
      return
    }
    
    setSelectedIncident({
      workRecordId: incidentEvent.job_id,
      workRecordName: incidentEvent.job_name || 'Incident',
      incidentEventId: incidentEvent.id,
      severity: incidentEvent.metadata?.severity || incidentEvent.severity || 'info',
    })
    setCreateCorrectiveActionModalOpen(true)
  }

  const [closeIncidentModalOpen, setCloseIncidentModalOpen] = useState(false)
  const [selectedIncidentForClosure, setSelectedIncidentForClosure] = useState<{
    workRecordId?: string
    workRecordName?: string
    hasCorrectiveActions?: boolean
    hasEvidence?: boolean
  } | null>(null)

  const handleCloseIncident = async (closure: {
    closure_summary: string
    root_cause: string
    evidence_attached: boolean
    waived?: boolean
    waiver_reason?: string
    no_action_required: boolean
    no_action_justification?: string
  }) => {
    if (!selectedIncidentForClosure?.workRecordId) return

    try {
      const token = await (async () => {
        const supabase = createSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token || null
      })()

      const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''
      const response = await fetch(`${API_URL}/api/audit/incidents/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          work_record_id: selectedIncidentForClosure.workRecordId,
          ...closure,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to close incident')
      }

      const data = await response.json()

      setToast({
        message: `Incident closed — entry added to Compliance Ledger showing closure + attestation. View at /operations/audit?event_id=${data.attestation_id}`,
        type: 'success',
      })
      
      loadAuditEvents()
    } catch (err: any) {
      console.error('Failed to close incident:', err)
      setToast({
        message: err.message || 'Failed to close incident. Please try again.',
        type: 'error',
      })
      throw err
    }
  }

  const handleCloseIncidentClick = (view: string) => {
    // Check for selection first, then fall back to finding from events
    let incidentEvent: AuditEvent | undefined
    
    if (selectionHook.selectedIds.length > 0) {
      incidentEvent = events.find(e => selectionHook.selectedIds.includes(e.id) && e.job_id)
    } else {
      // Find first incident from filtered events
      incidentEvent = events.find(e => 
        e.job_id && (
          e.severity === 'critical' || 
          e.severity === 'material' ||
          e.metadata?.flagged === true ||
          e.event_type?.includes('incident')
        )
      )
    }
    
    if (!incidentEvent || !incidentEvent.job_id) {
      setToast({
        message: 'Please select an incident from the list to close',
        type: 'error',
      })
      return
    }
    
    // Check if corrective actions exist (simplified - in real app, query controls)
    setSelectedIncidentForClosure({
      workRecordId: incidentEvent.job_id,
      workRecordName: incidentEvent.job_name || 'Incident',
      hasCorrectiveActions: true, // Assume true for now - would check actual controls
      hasEvidence: incidentEvent.metadata?.has_evidence === true,
    })
    setCloseIncidentModalOpen(true)
  }

  const handleRevokeAccessClick = (view: string) => {
    // Check for selection first, then fall back to finding from events
    let accessEvent: AuditEvent | undefined
    
    if (selectionHook.selectedIds.length > 0) {
      accessEvent = events.find(e => selectionHook.selectedIds.includes(e.id) && e.actor_id)
    } else {
      // Find first access-related event from filtered view
      accessEvent = events.find(e => 
        (e.category === 'access' || e.category === 'access_review') &&
        e.actor_id
      )
    }
    
    if (!accessEvent || !accessEvent.actor_id) {
      setToast({
        message: 'Please select a user from the Access Review view to revoke access',
        type: 'error',
      })
      return
    }
    
    setSelectedUser({
      userId: accessEvent.actor_id,
      userName: accessEvent.user_name || accessEvent.user_email || 'Unknown User',
      userRole: accessEvent.user_role,
    })
    setRevokeAccessModalOpen(true)
  }

  const handleFlagSuspiciousClick = (view: string) => {
    // Check for selection first, then fall back to finding from events
    let accessEvent: AuditEvent | undefined
    
    if (selectionHook.selectedIds.length > 0) {
      accessEvent = events.find(e => selectionHook.selectedIds.includes(e.id))
    } else {
      // Find first access-related event from filtered view
      accessEvent = events.find(e => 
        (e.category === 'access' || e.category === 'access_review') &&
        (e.actor_id || e.id)
      )
    }
    
    if (!accessEvent) {
      setToast({
        message: 'Please select a user or login event from the Access Review view to flag',
        type: 'error',
      })
      return
    }
    
    setSelectedUser({
      userId: accessEvent.actor_id,
      userName: accessEvent.user_name || accessEvent.user_email || 'Unknown User',
    })
    setFlagSuspiciousModalOpen(true)
  }

  const [revokeAccessModalOpen, setRevokeAccessModalOpen] = useState(false)
  const [flagSuspiciousModalOpen, setFlagSuspiciousModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{
    userId?: string
    userName?: string
    userRole?: string
  } | null>(null)

  const handleRevokeAccess = async (revocation: {
    action_type: 'disable_user' | 'downgrade_role' | 'revoke_sessions'
    reason: string
    new_role?: string
  }) => {
    if (!selectedUser?.userId) return

    try {
      const token = await (async () => {
        const supabase = createSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token || null
      })()

      const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''
      const response = await fetch(`${API_URL}/api/audit/access/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          target_user_id: selectedUser.userId,
          ...revocation,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to revoke access')
      }

      setToast({
        message: `Access revoked. Entry added to Compliance Ledger.`,
        type: 'success',
      })
      
      loadAuditEvents()
    } catch (err: any) {
      console.error('Failed to revoke access:', err)
      setToast({
        message: err.message || 'Failed to revoke access. Please try again.',
        type: 'error',
      })
      throw err
    }
  }

  const handleFlagSuspicious = async (flag: {
    reason: string
    notes?: string
    severity: 'critical' | 'material' | 'info'
    open_incident: boolean
  }) => {
    if (!selectedUser?.userId) return

    try {
      const token = await (async () => {
        const supabase = createSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token || null
      })()

      const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''
      const response = await fetch(`${API_URL}/api/audit/access/flag-suspicious`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          target_user_id: selectedUser.userId,
          ...flag,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to flag suspicious access')
      }

      const data = await response.json()

      setToast({
        message: `Suspicious access flagged. Entry added to Compliance Ledger.${data.incident_opened ? ' Security incident opened.' : ''}`,
        type: 'success',
      })
      
      loadAuditEvents()
    } catch (err: any) {
      console.error('Failed to flag suspicious access:', err)
      setToast({
        message: err.message || 'Failed to flag suspicious access. Please try again.',
        type: 'error',
      })
      throw err
    }
  }

  const handleOpenEvidence = (jobId?: string, jobName?: string, siteName?: string) => {
    setEvidenceJobId(jobId)
    setEvidenceJobName(jobName)
    setEvidenceSiteName(siteName)
    setEvidenceDrawerOpen(true)
  }

  const handleExportEvidence = async () => {
    if (!evidenceJobId) return
    try {
      await auditApi.export({
        format: 'json',
        job_id: evidenceJobId,
        time_range: 'all',
      })
    } catch (err) {
      alert('Export failed. Please try again.')
    }
  }

  return (
    <ProtectedRoute>
      <AppBackground>
        <DashboardNavbar />
        <AppShell>
          <PageSection>
            <PageHeader
              title={terms.complianceLedger.singular}
              subtitle="Immutable governance record of all actions, decisions, and evidence. This is your single source of truth for audits, claims, and disputes."
            />
            <div className="flex items-center gap-4 text-xs text-white/50 mt-4">
              <Shield className="w-4 h-4" />
              <span>Executive access is read-only by database policy. Oversight and authority are intentionally separated.</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40 italic mt-2">
              <span>All {terms.workRecord.plural.toLowerCase()}, {terms.control.plural.toLowerCase()}, {terms.evidence.plural.toLowerCase()}, and {terms.attestation.plural.toLowerCase()} feed into this {terms.complianceLedger.singular}.</span>
            </div>
          </PageSection>

          {/* Saved View Cards */}
          {loading ? (
            <PageSection>
              <SavedViewCardsSkeleton />
            </PageSection>
          ) : (
            <SavedViewCards
                activeView={filters.savedView}
                selectedCount={selectedCount}
                onSelectView={(view) => {
                  // Map empty string to 'custom' for type safety
                  const savedView: SavedView = view === '' ? 'custom' : view
                  setFilters({ ...filters, savedView })
                  if (savedView === 'governance-enforcement') setActiveTab('governance')
                  if (savedView === 'access-review') setActiveTab('access')
                }}
                onExportCSV={handleExportCSV}
                onExportCSVLoading={exportAction.loading}
                onAssign={(view) => {
                  // Check for selection first
                  if (selectionHook.selectedIds.length === 0) {
                    setToast({
                      message: 'Please select at least one item from the list below to assign',
                      type: 'error',
                    })
                    return
                  }
                  // Open assign modal with first selected item
                  const firstEvent = events.find(e => selectionHook.selectedIds.includes(e.id))
                  if (firstEvent) {
                    handleAssignClick(firstEvent)
                  } else {
                    setToast({
                      message: 'Selected item not found in current view',
                      type: 'error',
                    })
                  }
                }}
                onResolve={(view) => {
                  // Check for selection first
                  if (selectionHook.selectedIds.length === 0) {
                    setToast({
                      message: 'Please select at least one item from the list below to resolve',
                      type: 'error',
                    })
                    return
                  }
                  // Open resolve modal with first selected item
                  const firstEvent = events.find(e => selectionHook.selectedIds.includes(e.id))
                  if (firstEvent) {
                    handleResolveClick(firstEvent)
                  } else {
                    setToast({
                      message: 'Selected item not found in current view',
                      type: 'error',
                    })
                  }
                }}
                onExportEnforcement={handleExportEnforcement}
                onCreateCorrectiveAction={handleCreateCorrectiveActionClick}
                onCloseIncident={handleCloseIncidentClick}
                onRevokeAccess={handleRevokeAccessClick}
                onFlagSuspicious={handleFlagSuspiciousClick}
              />
          )}

          {/* Event Selection Table - Show when a saved view is active */}
          {filters.savedView !== 'custom' && (
            <div className="mb-6">
              <EventSelectionTable
                events={filteredEvents}
                view={filters.savedView}
                selectedIds={selectedIds}
                highlightedFailedIds={Array.from(highlightedFailedIds)}
                onSelect={(eventId) => {
                  selectionHook.toggleSelection(eventId)
                }}
                onRowClick={(event) => {
                  // Set selected target for modals
                  setSelectedTarget({
                    type: event.job_id ? 'job' : 'event',
                    id: event.job_id || event.id,
                    name: event.job_title || event.event_name || 'Event',
                    severity: event.severity,
                  })
                }}
                showActions={true}
                userRole={userRole || undefined}
              />
            </div>
          )}

          {/* Summary Cards */}
          <PageSection>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <GlassCard className="p-4">
              <div className="text-sm text-white/60 mb-1">Total Events</div>
              <div className="text-2xl font-bold text-white">{summaryMetrics.totalEvents}</div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-sm text-white/60 mb-1">Violations</div>
              <div className="text-2xl font-bold text-red-400">{summaryMetrics.governanceViolations}</div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-sm text-white/60 mb-1">{industryLang.job}s Touched</div>
              <div className="text-2xl font-bold text-[#F97316]">{summaryMetrics.highRiskJobsTouched}</div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-sm text-white/60 mb-1">{industryLang.proofPack}s</div>
              <div className="text-2xl font-bold text-green-400">{summaryMetrics.proofPacksGenerated}</div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-sm text-white/60 mb-1">Attestations</div>
              <div className="text-2xl font-bold text-blue-400">{summaryMetrics.signoffsRecorded}</div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-sm text-white/60 mb-1">Access Changes</div>
              <div className="text-2xl font-bold text-yellow-400">{summaryMetrics.accessChanges}</div>
            </GlassCard>
          </div>
          </PageSection>

          {/* Filters */}
          <PageSection>
            <GlassCard className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <Filter className="w-5 h-5 text-white/60" />
              <h2 className={`${typography.h2}`}>Filters</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-sm text-white/60 mb-2 block">Time Range</label>
                <Select
                  value={filters.timeRange}
                  onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as TimeRange })}
                >
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="all">All time</option>
                </Select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-2 block">Severity</label>
                <Select
                  value={filters.severity}
                  onChange={(e) => setFilters({ ...filters, severity: e.target.value as EventSeverity | '' })}
                >
                  <option value="">All</option>
                  <option value="info">Info</option>
                  <option value="material">Material</option>
                  <option value="critical">Critical</option>
                </Select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-2 block">Outcome</label>
                <Select
                  value={filters.outcome}
                  onChange={(e) => setFilters({ ...filters, outcome: e.target.value as EventOutcome | '' })}
                >
                  <option value="">All</option>
                  <option value="allowed">Allowed</option>
                  <option value="blocked">Blocked</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-white/60 mb-2 block">{industryLang.job}</label>
                <Select
                  value={filters.job}
                  onChange={(e) => setFilters({ ...filters, job: e.target.value })}
                >
                  <option value="">All {industryLang.job}s</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.client_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-2 block">User</label>
                <Select
                  value={filters.user}
                  onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                >
                  <option value="">All Users</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email} {user.role ? `(${user.role})` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              {sites.length > 0 && (
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Operational Context</label>
                  <Select
                    value={filters.site}
                    onChange={(e) => setFilters({ ...filters, site: e.target.value })}
                  >
                    <option value="">All {industryLang.site}s</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            </GlassCard>
          </PageSection>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-white/10">
            <button
              onClick={() => setActiveTab('governance')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'governance'
                  ? 'border-[#F97316] text-[#F97316]'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Governance Enforcement
            </button>
            <button
              onClick={() => setActiveTab('operations')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'operations'
                  ? 'border-[#F97316] text-[#F97316]'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Operational Actions
            </button>
            <button
              onClick={() => setActiveTab('access')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'access'
                  ? 'border-[#F97316] text-[#F97316]'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Access & Security
            </button>
          </div>

          {/* Events List */}
          <PageSection>
            <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className={`${typography.h2}`}>
                {activeTab === 'governance' && 'Governance Enforcement Events'}
                {activeTab === 'operations' && 'Operational Actions'}
                {activeTab === 'access' && 'Access & Security Events'}
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-white/60">{filteredEvents.length} events</span>
                <div className="flex items-center gap-2">
                  <ActionButton
                    onClick={() => handleExportFromView('csv', filters.savedView && filters.savedView !== 'custom' ? filters.savedView : 'custom')}
                    loading={exportAction.loading}
                    variant="secondary"
                    disabledReason={exportAction.error ? exportAction.error.message : undefined}
                    icon={<Download className="w-4 h-4" />}
                  >
                    Export CSV
                  </ActionButton>
                  {/* Advanced / Integrations Menu */}
                  <div className="relative">
                    <Button
                      variant="secondary"
                      onClick={() => setAdvancedExportMenuOpen(!advancedExportMenuOpen)}
                      title="Advanced export options for integrations"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                    {advancedExportMenuOpen && (
                      <>
                        {/* Backdrop to close menu */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setAdvancedExportMenuOpen(false)}
                        />
                        {/* Dropdown menu */}
                        <div className="absolute right-0 top-full mt-2 z-20 w-56 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl">
                          <div className="p-2">
                            <div className="px-3 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">
                              Advanced / Integrations
                            </div>
                            
                            {/* Active integrations */}
                            <div className="space-y-1 px-1">
                              <ActionButton
                                onClick={() => {
                                  setAdvancedExportMenuOpen(false)
                                  apiPayloadAction.run()
                                }}
                                loading={apiPayloadAction.loading}
                                variant="secondary"
                                className="w-full px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-md flex items-center gap-2 transition-colors"
                                disabledReason={apiPayloadAction.error ? apiPayloadAction.error.message : undefined}
                                icon={<Download className="w-4 h-4" />}
                              >
                                API payload (JSON)
                              </ActionButton>
                              <ActionButton
                                onClick={() => {
                                  setAdvancedExportMenuOpen(false)
                                  handleGeneratePack(filters.savedView && filters.savedView !== 'custom' ? filters.savedView : 'custom')
                                }}
                                loading={generatePackAction.loading}
                                variant="secondary"
                                className="w-full px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-md flex items-center gap-2 transition-colors"
                                disabledReason={generatePackAction.error ? generatePackAction.error.message : undefined}
                                icon={<Package className="w-4 h-4" />}
                              >
                                Generate Proof Pack (ZIP)
                              </ActionButton>
                              <button
                                onClick={() => {
                                  setAdvancedExportMenuOpen(false)
                                  setPackHistoryDrawerOpen(true)
                                }}
                                className="w-full px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-md flex items-center gap-2 transition-colors"
                              >
                                <Clock className="w-4 h-4" />
                                Pack History
                              </button>
                            </div>
                            <div className="mt-3 pt-3 border-t border-white/10 px-3 py-1.5">
                              <div className="text-xs font-semibold text-white/60 mb-2">Coming soon:</div>
                              <div className="space-y-1 text-xs text-white/40">
                                <div>• Send to Webhook</div>
                                <div>• Write to S3</div>
                                <div>• Send to Splunk HEC</div>
                                <div>• Send to Datadog Logs</div>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-white/10 px-3 py-1.5 text-xs text-white/50">
                              For SIEM, GRC tools, and automation. Human-readable exports: PDF/CSV.
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {loading ? (
              <LedgerEventListSkeleton />
            ) : filteredEvents.length === 0 ? (
              <>
                {activeTab === 'governance' && (
                  <EmptyState
                    title="No governance ledger events"
                    description="Nothing has triggered governance enforcement in this view yet."
                    hint="Allowed, blocked, and review-required outcomes appear here as immutable ledger events."
                    actionLabel="Clear filters"
                    onAction={() => setFilters({ ...filters, outcome: '', severity: '', timeRange: '30d' })}
                  />
                )}
                {activeTab === 'operations' && (
                  <EmptyState
                    title="No operational ledger events"
                    description="No operational activity matches your current filters."
                    hint="Try adjusting filters. Every operational action is recorded as a ledger event."
                    actionLabel="Clear filters"
                    onAction={() => setFilters({ ...filters, outcome: '', severity: '', timeRange: '30d' })}
                  />
                )}
                {activeTab === 'access' && (
                  <EmptyState
                    title="No access & security ledger events"
                    description="No role changes, access revocations, or security events match your criteria."
                    hint="Policy decisions (allowed/blocked) are recorded here as chain of custody."
                    actionLabel="Clear filters"
                    onAction={() => setFilters({ ...filters, outcome: '', severity: '', timeRange: '30d' })}
                  />
                )}
              </>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map((event) => {
                  const mapping = getEventMapping(event.event_type)
                  const isExpanded = expandedEvents.has(event.id)
                  const isBlocked = mapping.outcome === 'blocked' || event.outcome === 'blocked' || event.outcome === 'failure'

                  // Enhanced visual weight for Review Queue items
                  const isReviewQueue = filters.savedView === 'review-queue'
                  const isCritical = mapping.severity === 'critical'
                  const isMaterial = mapping.severity === 'material'
                  const needsAttention = isReviewQueue && (isCritical || isMaterial || isBlocked)

                  // Determine integrity status (default to 'unverified' if not yet verified)
                  // TODO: Replace with actual integrity check from ledger once implemented
                  const integrityStatus: 'verified' | 'unverified' | 'mismatch' | 'pending' = 'unverified'

                  return (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg border transition-colors min-w-0 ${
                        isBlocked || needsAttention
                          ? 'border-red-500/40 bg-red-500/10 shadow-lg shadow-red-500/10'
                          : 'border-white/10 bg-white/5'
                      } hover:bg-white/10 ${
                        needsAttention ? 'ring-1 ring-red-500/30' : ''
                      }`}
                      onClick={() => {
                        setSelectedEventForDetails(event)
                        setEventDetailsDrawerOpen(true)
                      }}
                    >
                      {/* EventChip: Type + Severity + Outcome */}
                      <div className="mb-3 min-w-0">
                        <EventChip
                          eventType={event.event_type}
                          severity={event.severity || mapping.severity}
                          outcome={event.outcome || mapping.outcome}
                          showOutcome
                        />
                      </div>

                      {/* TrustReceiptStrip: Who/When/What/Why */}
                      <div className="mb-3 min-w-0">
                      <TrustReceiptStrip
                        actorName={event.actor_name || event.user_name || event.actor_email || event.user_email || 'System'}
                        actorRole={event.actor_role || event.user_role}
                        actorEmail={event.actor_email || event.user_email}
                        occurredAt={event.created_at}
                        eventType={event.event_type}
                        category={mapping.category}
                        summary={mapping.description || event.metadata?.summary}
                        reason={event.metadata?.reason || mapping.whyItMatters}
                        policyStatement={event.metadata?.policy_statement || mapping.policyStatement}
                      />
                      </div>

                      {/* IntegrityBadge */}
                      <div className="mb-3 min-w-0">
                        <IntegrityBadge
                          status={integrityStatus}
                          showDetails
                        />
                      </div>

                      {/* EnforcementBanner: Show for blocked outcomes */}
                      {isBlocked && mapping.policyStatement && (
                        <div className="mb-3">
                          <EnforcementBanner
                            action={mapping.title}
                            blocked={true}
                            eventId={event.id}
                            policyStatement={mapping.policyStatement}
                            actorRole={event.actor_role || event.user_role}
                            severity={event.severity || mapping.severity}
                            onViewLedger={(eventId) => {
                              setSelectedEventForDetails(event)
                              setEventDetailsDrawerOpen(true)
                            }}
                          />
                        </div>
                      )}

                      {/* Additional context for flagged/review events */}
                      {event.event_type?.includes('flag') && event.metadata && (
                        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm min-w-0">
                          <div className="font-medium text-blue-200 mb-2">Review Context:</div>
                          {event.metadata.flag_reason && (
                            <div className="text-xs text-white/90 mb-1 break-words min-w-0">
                              <span className="font-medium">Reason:</span> {event.metadata.flag_reason}
                            </div>
                          )}
                          {event.metadata.review_owner_role && (
                            <div className="text-xs text-white/90 mb-1 break-words min-w-0">
                              <span className="font-medium">Assigned To:</span> {event.metadata.review_owner_role}
                            </div>
                          )}
                          {event.metadata.review_due_at && (
                            <div className="text-xs text-white/90">
                              <span className="font-medium">Due:</span> {new Date(event.metadata.review_due_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      {event.job_id && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEvidence(event.job_id, event.job_name, event.site_name)
                            }}
                            className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                          >
                            View Evidence
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/operations/jobs/${event.job_id}`)
                            }}
                            className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                          >
                            View {industryLang.job}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/operations/jobs/${event.job_id}?view=packet`)
                            }}
                            className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                          >
                            {industryLang.proofPack}
                          </button>
                        </div>
                      )}

                      {/* Review Queue Actions */}
                      {filters.savedView === 'review-queue' && needsAttention && (
                        <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAssignClick(event)
                            }}
                          >
                            <User className="w-3 h-3" />
                            Assign
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleResolveClick(event)
                            }}
                          >
                            <CheckCircle className="w-3 h-3" />
                            Resolve
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </GlassCard>
          
          {/* Contract Version Footer */}
          <div className="mt-8 pt-4 border-t border-white/5">
            <p className="text-xs text-white/30 text-center">
              Ledger Contract: v1.0 (frozen)
            </p>
          </div>
          </PageSection>
        </AppShell>

        {/* Evidence Drawer */}
        <EvidenceDrawer
          isOpen={evidenceDrawerOpen}
          onClose={() => setEvidenceDrawerOpen(false)}
          jobId={evidenceJobId}
          jobName={evidenceJobName}
          siteName={evidenceSiteName}
          events={events.filter(e => e.job_id === evidenceJobId)}
          onExportEvidence={handleExportEvidence}
        />

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border ${
            toast.type === 'success' 
              ? 'bg-green-500/20 border-green-500/40 text-green-400' 
              : 'bg-red-500/20 border-red-500/40 text-red-400'
          } max-w-md`}>
            <p className="text-sm">{toast.message}</p>
            {toast.description && (
              <p className="text-xs mt-1 opacity-80">{toast.description}</p>
            )}
            {toast.requestId && process.env.NODE_ENV === 'development' && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Request ID:</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(toast.requestId!)
                    }}
                    className="text-xs text-white/60 hover:text-white flex items-center gap-1"
                    title="Copy Request ID"
                  >
                    <code className="text-xs font-mono">{toast.requestId.slice(0, 16)}...</code>
                    <span className="text-xs">📋</span>
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => setToast(null)}
              className="absolute top-2 right-2 text-white/60 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Bulk Result Modal */}
        {bulkResultModal && (
          <BulkActionResultModal
            isOpen={bulkResultModal.isOpen}
            onClose={handleBulkResultClose}
            title={bulkResultModal.title}
            succeededCount={bulkResultModal.succeededCount}
            failedCount={bulkResultModal.failedCount}
            succeededIds={bulkResultModal.succeededIds}
            failures={bulkResultModal.failures}
            requestId={bulkResultModal.requestId}
            onShowInTable={handleShowFailedItems}
          />
        )}

        {/* Assign Modal */}
        <AssignModal
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false)
            setSelectedTarget(null)
          }}
          onAssign={handleAssign}
          targetType={selectedTarget?.type}
          targetId={selectedTarget?.id}
          targetName={selectedTarget?.name}
        />

        {/* Resolve Modal */}
        <ResolveModal
          isOpen={resolveModalOpen}
          onClose={() => {
            setResolveModalOpen(false)
            setSelectedTarget(null)
          }}
          onResolve={handleResolve}
          targetType={selectedTarget?.type}
          targetId={selectedTarget?.id}
          targetName={selectedTarget?.name}
          severity={selectedTarget?.severity}
          requiresEvidence={selectedTarget?.requiresEvidence}
          hasEvidence={selectedTarget?.hasEvidence}
        />

        {/* Create Corrective Action Modal */}
        <CreateCorrectiveActionModal
          isOpen={createCorrectiveActionModalOpen}
          onClose={() => {
            setCreateCorrectiveActionModalOpen(false)
            setSelectedIncident(null)
          }}
          onCreate={handleCreateCorrectiveAction}
          workRecordId={selectedIncident?.workRecordId}
          workRecordName={selectedIncident?.workRecordName}
          incidentEventId={selectedIncident?.incidentEventId}
          severity={selectedIncident?.severity}
        />

        {/* Close Incident Modal */}
        <CloseIncidentModal
          isOpen={closeIncidentModalOpen}
          onClose={() => {
            setCloseIncidentModalOpen(false)
            setSelectedIncidentForClosure(null)
          }}
          onCloseIncident={handleCloseIncident}
          workRecordId={selectedIncidentForClosure?.workRecordId}
          workRecordName={selectedIncidentForClosure?.workRecordName}
          hasCorrectiveActions={selectedIncidentForClosure?.hasCorrectiveActions}
          hasEvidence={selectedIncidentForClosure?.hasEvidence}
        />

        {/* Revoke Access Modal */}
        <RevokeAccessModal
          isOpen={revokeAccessModalOpen}
          onClose={() => {
            setRevokeAccessModalOpen(false)
            setSelectedUser(null)
          }}
          onRevoke={handleRevokeAccess}
          targetUserId={selectedUser?.userId}
          targetUserName={selectedUser?.userName}
          targetUserRole={selectedUser?.userRole}
        />

        {/* Flag Suspicious Modal */}
        <FlagSuspiciousModal
          isOpen={flagSuspiciousModalOpen}
          onClose={() => {
            setFlagSuspiciousModalOpen(false)
            setSelectedUser(null)
          }}
          onFlag={handleFlagSuspicious}
          targetUserId={selectedUser?.userId}
          targetUserName={selectedUser?.userName}
        />

        {/* Event Details Drawer */}
        <EventDetailsDrawer
          isOpen={eventDetailsDrawerOpen}
          onClose={() => {
            setEventDetailsDrawerOpen(false)
            setSelectedEventForDetails(null)
          }}
          event={selectedEventForDetails}
        />

        {/* Pack History Drawer */}
        <PackHistoryDrawer
          isOpen={packHistoryDrawerOpen}
          onClose={() => setPackHistoryDrawerOpen(false)}
        />
      </AppBackground>
    </ProtectedRoute>
  )
}
