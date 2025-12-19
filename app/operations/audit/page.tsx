'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Download, Filter, Shield, AlertTriangle, User, Calendar, FileText, Clock, CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronUp, Building2 } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { jobsApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { cardStyles, buttonStyles, typography } from '@/lib/styles/design-system'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { getEventMapping, categorizeEvent, type EventCategory, type EventSeverity, type EventOutcome } from '@/lib/audit/eventMapper'

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
type SavedView = 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review' | 'custom'

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

  useEffect(() => {
    loadAuditEvents()
    loadJobs()
    loadUsers()
    loadSites()
  }, [])

  useEffect(() => {
    loadAuditEvents()
  }, [filters])

  const loadAuditEvents = async () => {
    try {
      setLoading(true)
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .single()

      if (!orgData) return

      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', orgData.id)
        .order('created_at', { ascending: false })
        .limit(500)

      // Time range filter
      if (filters.timeRange !== 'all' && filters.timeRange !== 'custom') {
        const now = new Date()
        let cutoff = new Date()
        if (filters.timeRange === '24h') {
          cutoff.setHours(now.getHours() - 24)
        } else if (filters.timeRange === '7d') {
          cutoff.setDate(now.getDate() - 7)
        } else if (filters.timeRange === '30d') {
          cutoff.setDate(now.getDate() - 30)
        }
        query = query.gte('created_at', cutoff.toISOString())
      }

      if (filters.job) {
        query = query.eq('job_id', filters.job)
      }

      if (filters.user) {
        query = query.eq('actor_id', filters.user)
      }

      if (filters.site) {
        // Filter by site via job_id (would need to join, but for now we'll filter after)
      }

      const { data, error } = await query

      if (error) throw error

      // Apply saved view filters
      let filteredData = data || []
      if (filters.savedView === 'governance-enforcement') {
        filteredData = filteredData.filter(e => {
          const eventType = (e.event_name || e.event_type || '').toString()
          return categorizeEvent(eventType) === 'governance'
        })
      } else if (filters.savedView === 'incident-review') {
        filteredData = filteredData.filter(e => {
          const type = (e.event_name || e.event_type || '').toString()
          return type.includes('flag') || type.includes('incident')
        })
      } else if (filters.savedView === 'access-review') {
        filteredData = filteredData.filter(e => {
          const eventType = (e.event_name || e.event_type || '').toString()
          return categorizeEvent(eventType) === 'access'
        })
      } else if (filters.savedView === 'insurance-ready') {
        filteredData = filteredData.filter(e => {
          const type = (e.event_name || e.event_type || '').toString()
          return type.includes('proof_pack') || type.includes('signoff') || type.includes('job.completed')
        })
      }

      // Enrich with job, user, and site names
      const enrichedEvents = await Promise.all(
        filteredData.map(async (event) => {
          let jobName = null
          let siteName = null
          let userName = null
          let userEmail = null
          let userRole = null

          if (event.job_id || event.target_id) {
            const jobId = event.job_id || (event.target_type === 'job' ? event.target_id : null)
            if (jobId) {
              try {
                const jobResponse = await jobsApi.get(jobId)
                jobName = jobResponse.data.client_name
                siteName = jobResponse.data.site_name
              } catch (e) {
                // Job might not exist
              }
            }
          }

          const userId = event.actor_id || event.user_id
          if (userId) {
            const { data: userData } = await supabase
              .from('users')
              .select('full_name, email, role')
              .eq('id', userId)
              .single()
            if (userData) {
              userName = userData.full_name
              userEmail = userData.email
              userRole = userData.role
            }
          }

          return {
            ...event,
            event_type: (event.event_name || event.event_type || 'unknown').toString(),
            job_name: jobName,
            site_name: siteName,
            user_name: userName,
            user_email: userEmail,
            user_role: userRole,
          }
        })
      )

      // Apply severity and outcome filters
      let finalEvents = enrichedEvents
      if (filters.severity) {
        finalEvents = finalEvents.filter(e => {
          const mapping = getEventMapping(e.event_type)
          return mapping.severity === filters.severity
        })
      }
      if (filters.outcome) {
        finalEvents = finalEvents.filter(e => {
          const mapping = getEventMapping(e.event_type)
          return mapping.outcome === filters.outcome
        })
      }

      // Filter by site if specified
      if (filters.site) {
        finalEvents = finalEvents.filter(e => e.site_id === filters.site || e.job_id && jobs.find(j => j.id === e.job_id)?.site_name)
      }

      setEvents(finalEvents as AuditEvent[])
    } catch (err) {
      console.error('Failed to load audit events:', err)
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

  // Filter events by active tab
  const filteredEvents = events.filter(e => {
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

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <DashboardNavbar />
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className={`${typography.h1} mb-2`}>Compliance Ledger</h1>
            <p className="text-white/60 text-sm">
              Complete audit trail of all actions, governance enforcement events, and access changes. Export-ready for compliance, legal discovery, and regulatory review.
            </p>
          </div>

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
              <div className="text-sm text-white/60 mb-1">Jobs Touched</div>
              <div className="text-2xl font-bold text-[#F97316]">{summaryMetrics.highRiskJobsTouched}</div>
            </div>
            <div className={cardStyles.base + ' p-4'}>
              <div className="text-sm text-white/60 mb-1">Proof Packs</div>
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
                <label className="text-sm text-white/60 mb-2 block">Saved View</label>
                <select
                  value={filters.savedView}
                  onChange={(e) => {
                    const view = e.target.value as SavedView
                    setFilters({ ...filters, savedView: view })
                    if (view === 'governance-enforcement') setActiveTab('governance')
                    if (view === 'access-review') setActiveTab('access')
                  }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="">Custom</option>
                  <option value="insurance-ready">Insurance-ready (Completed jobs + proof packs)</option>
                  <option value="governance-enforcement">Governance enforcement (Violations only)</option>
                  <option value="incident-review">Incident review (Flagged + escalations)</option>
                  <option value="access-review">Access review (Role + login changes)</option>
                </select>
              </div>
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
                <label className="text-sm text-white/60 mb-2 block">Job</label>
                <select
                  value={filters.job}
                  onChange={(e) => setFilters({ ...filters, job: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="">All Jobs</option>
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
                  <label className="text-sm text-white/60 mb-2 block">Site</label>
                  <select
                    value={filters.site}
                    onChange={(e) => setFilters({ ...filters, site: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  >
                    <option value="">All Sites</option>
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
                <button
                  onClick={() => {
                    // Export functionality
                    alert('Export audit trail coming in v2')
                  }}
                  className={`${buttonStyles.secondary} flex items-center gap-2`}
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
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

                  return (
                    <div
                      key={event.id}
                      className={`p-4 bg-white/5 rounded-lg border ${
                        isViolation ? 'border-red-500/30 bg-red-500/5' : 'border-white/10'
                      } hover:bg-white/10 transition-colors`}
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
                                <h3 className="font-semibold text-white">{mapping.title}</h3>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  mapping.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                  mapping.severity === 'material' ? 'bg-yellow-500/20 text-yellow-400' :
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
                                    onClick={() => router.push(`/operations/jobs/${event.job_id}`)}
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
                                <div className="text-white/60 mb-1">Site</div>
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
                                onClick={() => router.push(`/operations/jobs/${event.job_id}`)}
                                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                              >
                                View Job
                              </button>
                              <button
                                onClick={() => router.push(`/operations/jobs/${event.job_id}?view=packet`)}
                                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                              >
                                Job Packet
                              </button>
                              {event.event_type?.includes('proof_pack') && (
                                <button
                                  onClick={() => router.push(`/operations/jobs/${event.job_id}?view=packet`)}
                                  className="text-xs px-3 py-1 bg-[#F97316]/20 hover:bg-[#F97316]/30 rounded transition-colors"
                                >
                                  Proof Pack
                                </button>
                              )}
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
      </div>
    </ProtectedRoute>
  )
}
