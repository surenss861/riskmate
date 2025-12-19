'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Download, Filter, Shield, AlertTriangle, User, Calendar, FileText } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import RiskMateLogo from '@/components/RiskMateLogo'
import { jobsApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { cardStyles, buttonStyles, typography } from '@/lib/styles/design-system'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'

interface AuditEvent {
  id: string
  event_type: string
  user_name?: string
  user_email?: string
  job_id?: string
  job_name?: string
  created_at: string
  metadata?: any
  organization_id: string
}

export default function AuditViewPage() {
  const router = useRouter()
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    job: '',
    user: '',
    violationType: '',
  })
  const [jobs, setJobs] = useState<Array<{ id: string; client_name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])

  useEffect(() => {
    loadAuditEvents()
    loadJobs()
    loadUsers()
  }, [])

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
        .limit(100)

      if (filters.job) {
        query = query.eq('job_id', filters.job)
      }

      if (filters.user) {
        query = query.eq('user_id', filters.user)
      }

      if (filters.violationType) {
        query = query.eq('event_type', filters.violationType)
      }

      const { data, error } = await query

      if (error) throw error

      // Enrich with job and user names
      const enrichedEvents = await Promise.all(
        (data || []).map(async (event) => {
          let jobName = null
          let userName = null
          let userEmail = null

          if (event.job_id) {
            try {
              const jobResponse = await jobsApi.get(event.job_id)
              jobName = jobResponse.data.client_name
            } catch (e) {
              // Job might not exist
            }
          }

          if (event.user_id) {
            const { data: userData } = await supabase
              .from('users')
              .select('full_name, email')
              .eq('id', event.user_id)
              .single()
            if (userData) {
              userName = userData.full_name
              userEmail = userData.email
            }
          }

          return {
            ...event,
            job_name: jobName,
            user_name: userName,
            user_email: userEmail,
          }
        })
      )

      setEvents(enrichedEvents as AuditEvent[])
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

      // Query users directly from the users table (organization_members might not be accessible)
      // Fallback: get users from the organization
      let usersList: Array<{ id: string; name: string; email: string }> = []
      
      try {
        // Try to query organization_members first
        const { data: members, error: membersError } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', orgData.id)
        
        if (!membersError && members && members.length > 0) {
          // Query users table for user details
          const userIds = members.map((m: any) => m.user_id).filter(Boolean)
          
          if (userIds.length > 0) {
            const { data: users, error: usersError } = await supabase
              .from('users')
              .select('id, full_name, email')
              .in('id', userIds)
            
            if (!usersError && users) {
              usersList = users.map((u: any) => ({
                id: u.id,
                name: u.full_name || 'Unknown',
                email: u.email || '',
              }))
            }
          }
        } else {
          // Fallback: query users directly by organization_id
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('organization_id', orgData.id)
          
          if (!usersError && users) {
            usersList = users.map((u: any) => ({
              id: u.id,
              name: u.full_name || 'Unknown',
              email: u.email || '',
            }))
          }
        }
      } catch (error) {
        console.error('Error fetching users for audit log:', error)
        // Fallback: query users directly by organization_id
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('organization_id', orgData.id)
        
        if (!usersError && users) {
          usersList = users.map((u: any) => ({
            id: u.id,
            name: u.full_name || 'Unknown',
            email: u.email || '',
          }))
        }
      }

      setUsers(usersList)
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  useEffect(() => {
    loadAuditEvents()
  }, [filters])

  const violationEvents = events.filter(e => 
    e.event_type.includes('violation') || 
    e.event_type.includes('role_violation') ||
    e.event_type === 'auth.role_violation'
  )

  const groupedViolations = violationEvents.reduce((acc, event) => {
    const key = event.event_type
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(event)
    return acc
  }, {} as Record<string, AuditEvent[]>)

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('violation')) return AlertTriangle
    if (eventType.includes('role')) return Shield
    if (eventType.includes('flag')) return AlertTriangle
    return FileText
  }

  const getEventColor = (eventType: string) => {
    if (eventType.includes('violation')) return 'text-red-400'
    if (eventType.includes('role')) return 'text-orange-400'
    if (eventType.includes('flag')) return 'text-yellow-400'
    return 'text-white/60'
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <DashboardNavbar />
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className={`${typography.h1} mb-2`}>Audit View</h1>
            <p className="text-white/60 text-sm">
              Complete audit trail of all actions, governance enforcement events, and access changes. Export-ready for compliance, legal discovery, and regulatory review.
            </p>
          </div>

          {/* Filters */}
          <div className={`${cardStyles.base} p-6 mb-6`}>
            <div className="flex items-center gap-4 mb-4">
              <Filter className="w-5 h-5 text-white/60" />
              <h2 className={`${typography.h2}`}>Filters</h2>
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
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-2 block">Violation Type</label>
                <select
                  value={filters.violationType}
                  onChange={(e) => setFilters({ ...filters, violationType: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="">All Events</option>
                  <option value="auth.role_violation">Role Violations</option>
                  <option value="job.flagged">Flagged Jobs</option>
                  <option value="job.updated">Job Updates</option>
                  <option value="team.member_removed">Access Revoked</option>
                </select>
              </div>
            </div>
          </div>

          {/* Capability Violations Grouped View */}
          {violationEvents.length > 0 && (
            <div className={`${cardStyles.base} p-6 mb-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-orange-400" />
                  <div>
                    <h2 className={`${typography.h2}`}>Governance Enforcement Events</h2>
                    <p className="text-xs text-white/50 mt-1">
                      Capability violations — actions blocked by role-based access control
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-lg text-sm">
                    {violationEvents.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    // Export functionality coming in v2
                    alert('Export audit trail coming in v2')
                  }}
                  className={`${buttonStyles.secondary} flex items-center gap-2`}
                >
                  <Download className="w-4 h-4" />
                  Export Audit Trail
                </button>
              </div>
              <div className="space-y-4">
                {Object.entries(groupedViolations).map(([eventType, events]) => {
                  const Icon = getEventIcon(eventType)
                  return (
                    <div key={eventType} className="border border-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className={`w-5 h-5 ${getEventColor(eventType)}`} />
                        <h3 className="font-semibold capitalize">{eventType.replace(/_/g, ' ')}</h3>
                        <span className="text-sm text-white/60">({events.length})</span>
                      </div>
                      <div className="space-y-2">
                        {events.slice(0, 5).map((event) => (
                          <div key={event.id} className="flex items-center gap-4 text-sm">
                            <Calendar className="w-4 h-4 text-white/40" />
                            <span className="text-white/60">
                              {new Date(event.created_at).toLocaleString()}
                            </span>
                            {event.user_name && (
                              <>
                                <User className="w-4 h-4 text-white/40" />
                                <span className="text-white/60">{event.user_name}</span>
                              </>
                            )}
                            {event.job_name && (
                              <span className="text-white/60">• {event.job_name}</span>
                            )}
                          </div>
                        ))}
                        {events.length > 5 && (
                          <p className="text-xs text-white/40 italic">
                            +{events.length - 5} more violations
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* All Audit Events */}
          <div className={`${cardStyles.base} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`${typography.h2}`}>All Audit Events</h2>
              <span className="text-sm text-white/60">{events.length} events</span>
            </div>
            {loading ? (
              <div className="text-center py-12 text-white/60">Loading audit events...</div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 text-white/60">No audit events found</div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const Icon = getEventIcon(event.event_type)
                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <Icon className={`w-5 h-5 mt-0.5 ${getEventColor(event.event_type)}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold capitalize">
                            {event.event_type.replace(/_/g, ' ')}
                          </p>
                          {event.user_name && (
                            <span className="text-sm text-white/60 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {event.user_name}
                            </span>
                          )}
                        </div>
                        {event.job_name && (
                          <p className="text-sm text-white/60 mb-1">Job: {event.job_name}</p>
                        )}
                        <p className="text-xs text-white/40">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <div className="mt-2 p-2 bg-black/20 rounded text-xs text-white/70">
                            <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                          </div>
                        )}
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

