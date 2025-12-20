'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Download, Filter, Shield, AlertTriangle, User, Calendar, FileText, Clock, CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronUp, Building2 } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { jobsApi, auditApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { cardStyles, buttonStyles, typography } from '@/lib/styles/design-system'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { getEventMapping, categorizeEvent, type EventCategory, type EventSeverity, type EventOutcome } from '@/lib/audit/eventMapper'
import { getIndustryLanguage } from '@/lib/audit/industryLanguage'
import { SavedViewCards } from '@/components/audit/SavedViewCards'
import { EvidenceDrawer } from '@/components/audit/EvidenceDrawer'

interface AuditEvent {
  id: string
  event_type: string
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
  target_type?: string
  target_id?: string
}

type TimeRange = '24h' | '7d' | '30d' | 'custom' | 'all'
type SavedView = 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review' | 'custom'

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
    savedView: '' as SavedView | '',
  })
  const [jobs, setJobs] = useState<Array<{ id: string; client_name: string; site_name?: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role?: string }>>([])
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([])
  const [industryVertical, setIndustryVertical] = useState<string | null>(null)
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false)
  const [evidenceJobId, setEvidenceJobId] = useState<string | undefined>()
  const [evidenceJobName, setEvidenceJobName] = useState<string | undefined>()
  const [evidenceSiteName, setEvidenceSiteName] = useState<string | undefined>()

  useEffect(() => {
    loadAuditEvents()
    loadJobs()
    loadUsers()
    loadSites()
    loadIndustryVertical()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const loadAuditEvents = async () => {
    try {
      setLoading(true)
      
      // Use new backend endpoint with server-side enrichment
      const response = await auditApi.getEvents({
        category: activeTab,
        site_id: filters.site || undefined,
        job_id: filters.job || undefined,
        actor_id: filters.user || undefined,
        severity: filters.severity || undefined,
        outcome: filters.outcome || undefined,
        time_range: filters.timeRange,
        view: filters.savedView && filters.savedView !== 'custom' ? filters.savedView : undefined,
        limit: 500,
      })

      const enrichedEvents = (response.data.events || []).map((event: any) => ({
        ...event,
        event_type: event.event_name || event.event_type || 'unknown',
        job_name: event.job_title || event.job_name,
        user_name: event.actor_name || event.user_name,
        user_email: event.user_email,
        user_role: event.actor_role || event.user_role,
        site_name: event.site_name,
      }))

      setEvents(enrichedEvents as AuditEvent[])
      
      // Update summary metrics from backend stats
      if (response.data.stats) {
        // Stats are already computed server-side, but we'll recalculate from filtered events
        // for consistency with UI
      }
    } catch (err) {
      console.error('Failed to load audit events:', err)
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
        setEvents((data || []) as AuditEvent[])
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

  // Filter events by active tab (unless Review Queue is active)
  const filteredEvents = events.filter(e => {
    if (filters.savedView === 'review-queue') {
      // Review Queue shows all relevant events regardless of tab
      return true
    }
    const category = categorizeEvent(e.event_type)
    return category === activeTab
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

  const handleExportFromView = async (format: 'csv' | 'json', view: string) => {
    try {
      await auditApi.export({
        format,
        view: view as any,
        time_range: filters.timeRange,
      })
    } catch (err) {
      alert('Export failed. Please try again.')
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
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <DashboardNavbar />
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className={`${typography.h1} mb-2`}>Compliance Ledger</h1>
            <p className="text-white/60 text-sm">
              Complete governance evidence trail of all actions, enforcement events, and access changes. Export-ready for compliance, legal discovery, and regulatory review.
            </p>
          </div>

          {/* Saved View Cards */}
          <SavedViewCards
            activeView={filters.savedView}
            onSelectView={(view) => {
              setFilters({ ...filters, savedView: view })
              if (view === 'governance-enforcement') setActiveTab('governance')
              if (view === 'access-review') setActiveTab('access')
            }}
            onExport={handleExportFromView}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className={cardStyles.base + ' p-4'}>
              <div className="text-sm text-white/60 mb-1">Total Events</div>
              <div className="text-2xl font-bold text-white">{summaryMetrics.totalEvents}</div>
            </div>
            <div className={cardStyles.base + ' p-4'}>
              <div className="text-sm text-white/60 mb-1">Violations</div>
              <div className="text-2xl font-bold text-red-400">{summaryMetrics.governanceViolations}</div>
            </div>
            <div className={cardStyles.base + ' p-4'}>
              <div className="text-sm text-white/60 mb-1">{industryLang.job}s Touched</div>
              <div className="text-2xl font-bold text-[#F97316]">{summaryMetrics.highRiskJobsTouched}</div>
            </div>
            <div className={cardStyles.base + ' p-4'}>
              <div className="text-sm text-white/60 mb-1">{industryLang.proofPack}s</div>
              <div className="text-2xl font-bold text-green-400">{summaryMetrics.proofPacksGenerated}</div>
            </div>
            <div className={cardStyles.base + ' p-4'}>
              <div className="text-sm text-white/60 mb-1">Sign-offs</div>
              <div className="text-2xl font-bold text-blue-400">{summaryMetrics.signoffsRecorded}</div>
            </div>
            <div className={cardStyles.base + ' p-4'}>
              <div className="text-sm text-white/60 mb-1">Access Changes</div>
              <div className="text-2xl font-bold text-yellow-400">{summaryMetrics.accessChanges}</div>
            </div>
          </div>

          {/* Filters */}
          <div className={`${cardStyles.base} p-6 mb-6`}>
            <div className="flex items-center gap-4 mb-4">
              <Filter className="w-5 h-5 text-white/60" />
              <h2 className={`${typography.h2}`}>Filters</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-sm text-white/60 mb-2 block">Time Range</label>
                <select
                  value={filters.timeRange}
                  onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as TimeRange })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-2 block">Severity</label>
                <select
                  value={filters.severity}
                  onChange={(e) => setFilters({ ...filters, severity: e.target.value as EventSeverity | '' })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="">All</option>
                  <option value="info">Info</option>
                  <option value="material">Material</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-2 block">Outcome</label>
                <select
                  value={filters.outcome}
                  onChange={(e) => setFilters({ ...filters, outcome: e.target.value as EventOutcome | '' })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="">All</option>
                  <option value="allowed">Allowed</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-white/60 mb-2 block">{industryLang.job}</label>
                <select
                  value={filters.job}
                  onChange={(e) => setFilters({ ...filters, job: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="">All {industryLang.job}s</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.client_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-2 block">User</label>
                <select
                  value={filters.user}
                  onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="">All Users</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email} {user.role ? `(${user.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {sites.length > 0 && (
                <div>
                  <label className="text-sm text-white/60 mb-2 block">{industryLang.site}</label>
                  <select
                    value={filters.site}
                    onChange={(e) => setFilters({ ...filters, site: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  >
                    <option value="">All {industryLang.site}s</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

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
          <div className={`${cardStyles.base} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`${typography.h2}`}>
                {activeTab === 'governance' && 'Governance Enforcement Events'}
                {activeTab === 'operations' && 'Operational Actions'}
                {activeTab === 'access' && 'Access & Security Events'}
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-white/60">{filteredEvents.length} events</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await auditApi.export({
                          format: 'csv',
                          category: activeTab,
                          site_id: filters.site || undefined,
                          job_id: filters.job || undefined,
                          actor_id: filters.user || undefined,
                          severity: filters.severity || undefined,
                          outcome: filters.outcome || undefined,
                          time_range: filters.timeRange,
                          view: filters.savedView && filters.savedView !== 'custom' ? filters.savedView : undefined,
                        })
                      } catch (err) {
                        alert('Export failed. Please try again.')
                      }
                    }}
                    className={`${buttonStyles.secondary} flex items-center gap-2`}
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await auditApi.export({
                          format: 'json',
                          category: activeTab,
                          site_id: filters.site || undefined,
                          job_id: filters.job || undefined,
                          actor_id: filters.user || undefined,
                          severity: filters.severity || undefined,
                          outcome: filters.outcome || undefined,
                          time_range: filters.timeRange,
                          view: filters.savedView && filters.savedView !== 'custom' ? filters.savedView : undefined,
                        })
                      } catch (err) {
                        alert('Export failed. Please try again.')
                      }
                    }}
                    className={`${buttonStyles.secondary} flex items-center gap-2`}
                  >
                    <Download className="w-4 h-4" />
                    Export JSON
                  </button>
                </div>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-12 text-white/60">Loading audit events...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12 text-white/60">No events found for this category</div>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map((event) => {
                  const mapping = getEventMapping(event.event_type)
                  const isExpanded = expandedEvents.has(event.id)
                  const isViolation = mapping.category === 'governance' && mapping.outcome === 'blocked'

                  // Enhanced visual weight for Review Queue items
                  const isReviewQueue = filters.savedView === 'review-queue'
                  const isCritical = mapping.severity === 'critical'
                  const isMaterial = mapping.severity === 'material'
                  const isBlocked = mapping.outcome === 'blocked'
                  const needsAttention = isReviewQueue && (isCritical || isMaterial || isBlocked)

                  return (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        isViolation || needsAttention
                          ? 'border-red-500/40 bg-red-500/10 shadow-lg shadow-red-500/10'
                          : 'border-white/10 bg-white/5'
                      } hover:bg-white/10 ${
                        needsAttention ? 'ring-1 ring-red-500/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 p-2 rounded ${
                          mapping.outcome === 'blocked' ? 'bg-red-500/20' : 'bg-green-500/20'
                        }`}>
                          {mapping.outcome === 'blocked' ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className={`font-semibold ${
                                  needsAttention ? 'text-red-200' : 'text-white'
                                }`}>
                                  {mapping.title}
                                  {needsAttention && (
                                    <span className="ml-2 text-xs text-red-400 font-normal">
                                      • Requires action
                                    </span>
                                  )}
                                </h3>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  mapping.severity === 'critical' ? 'bg-red-500/30 text-red-300 border border-red-500/50' :
                                  mapping.severity === 'material' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' :
                                  'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {mapping.severity.toUpperCase()}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  mapping.outcome === 'blocked' ? 'bg-red-500/20 text-red-400' :
                                  'bg-green-500/20 text-green-400'
                                }`}>
                                  {mapping.outcome.toUpperCase()}
                                </span>
                              </div>
                              {isViolation && mapping.policyStatement && (
                                <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm">
                                  <div className="font-medium text-yellow-200 mb-1">Policy:</div>
                                  <div className="text-white/90">{mapping.policyStatement}</div>
                                  {mapping.whyItMatters && (
                                    <div className="text-white/70 text-xs mt-2 italic">
                                      Why it matters: {mapping.whyItMatters}
                                    </div>
                                  )}
                                  {mapping.exposure && (
                                    <div className="mt-3 pt-3 border-t border-yellow-500/20 space-y-1">
                                      <div className="text-xs font-medium text-yellow-200">Exposure:</div>
                                      {mapping.exposure.insurance && (
                                        <div className="text-xs text-white/80">
                                          <span className="font-medium">Insurance:</span> {mapping.exposure.insurance}
                                        </div>
                                      )}
                                      {mapping.exposure.regulatory && (
                                        <div className="text-xs text-white/80">
                                          <span className="font-medium">Regulatory:</span> {mapping.exposure.regulatory}
                                        </div>
                                      )}
                                      {mapping.exposure.owner && (
                                        <div className="text-xs text-white/80">
                                          <span className="font-medium">Owner:</span> {mapping.exposure.owner}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Review context for flagged/review events */}
                              {event.event_type?.includes('flag') && event.metadata && (
                                <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm">
                                  <div className="font-medium text-blue-200 mb-2">Review Context:</div>
                                  {event.metadata.flag_reason && (
                                    <div className="text-xs text-white/90 mb-1">
                                      <span className="font-medium">Reason:</span> {event.metadata.flag_reason}
                                    </div>
                                  )}
                                  {event.metadata.review_owner_role && (
                                    <div className="text-xs text-white/90 mb-1">
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
                              <p className="text-sm text-white/70 mt-2">{mapping.description}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                            <div>
                              <div className="text-white/60 mb-1">Actor</div>
                              <div className="text-white flex items-center gap-2">
                                <User className="w-4 h-4" />
                                {event.user_name || 'System'}
                                {event.user_role && (
                                  <span className="text-xs text-white/50">({event.user_role})</span>
                                )}
                              </div>
                            </div>
                            {event.job_name && (
                              <div>
                                <div className="text-white/60 mb-1">Target</div>
                                <div className="text-white flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  <button
                                    onClick={() => handleOpenEvidence(event.job_id, event.job_name, event.site_name)}
                                    className="hover:text-[#F97316] transition-colors flex items-center gap-1"
                                  >
                                    {event.job_name}
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                            {event.site_name && (
                              <div>
                                <div className="text-white/60 mb-1">{industryLang.site}</div>
                                <div className="text-white flex items-center gap-2">
                                  <Building2 className="w-4 h-4" />
                                  {event.site_name}
                                </div>
                              </div>
                            )}
                            <div>
                              <div className="text-white/60 mb-1">Time</div>
                              <div className="text-white flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>{formatRelativeTime(event.created_at)}</span>
                              </div>
                              <div className="text-xs text-white/50 mt-1">
                                {new Date(event.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {event.job_id && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleOpenEvidence(event.job_id, event.job_name, event.site_name)}
                                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                              >
                                View Evidence
                              </button>
                              <button
                                onClick={() => router.push(`/operations/jobs/${event.job_id}`)}
                                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                              >
                                View {industryLang.job}
                              </button>
                              <button
                                onClick={() => router.push(`/operations/jobs/${event.job_id}?view=packet`)}
                                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                              >
                                {industryLang.proofPack}
                              </button>
                            </div>
                          )}
                          {event.metadata && Object.keys(event.metadata).length > 0 && (
                            <div className="mt-3">
                              <button
                                onClick={() => toggleEventExpansion(event.id)}
                                className="text-xs text-white/60 hover:text-white flex items-center gap-1"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {isExpanded ? 'Hide' : 'Show'} Details
                              </button>
                              {isExpanded && (
                                <div className="mt-2 p-3 bg-black/20 rounded text-xs text-white/70 font-mono">
                                  <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

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
      </div>
    </ProtectedRoute>
  )
}
