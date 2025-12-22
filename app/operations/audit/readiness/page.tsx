'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, Clock, FileText, Shield, User, XCircle, Upload, UserCheck, CheckSquare, ArrowRight } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { cardStyles, buttonStyles, typography } from '@/lib/styles/design-system'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { useRouter, useSearchParams } from 'next/navigation'
import { terms } from '@/lib/terms'
import { UploadEvidenceModal } from '@/components/audit/UploadEvidenceModal'
import { RequestAttestationModal } from '@/components/audit/RequestAttestationModal'
import { FixQueueSidebar } from '@/components/audit/FixQueueSidebar'

type ReadinessCategory = 'evidence' | 'controls' | 'attestations' | 'incidents' | 'access'
type ReadinessSeverity = 'critical' | 'material' | 'info'
type FixActionType = 'upload_evidence' | 'request_attestation' | 'complete_controls' | 'resolve_incident' | 'review_item'

interface ReadinessItem {
  id: string
  rule_code: string
  rule_name: string
  category: ReadinessCategory
  severity: ReadinessSeverity
  affected_type: 'work_record' | 'control' | 'attestation' | 'incident' | 'review_item'
  affected_id: string
  affected_name?: string
  work_record_id?: string
  work_record_name?: string
  site_id?: string
  site_name?: string
  owner_id?: string
  owner_name?: string
  due_date?: string
  status: 'open' | 'in_progress' | 'waived' | 'resolved'
  why_it_matters: string
  fix_action_type: FixActionType
  metadata?: any
  created_at?: string
  updated_at?: string
}

interface ReadinessSummary {
  total_items: number
  critical_blockers: number
  material: number
  info: number
  resolved: number
  audit_ready_score: number
  estimated_time_to_clear_hours?: number
  oldest_overdue_date?: string
  category_breakdown: {
    evidence: number
    controls: number
    attestations: number
    incidents: number
    access: number
  }
}

interface ReadinessResponse {
  ok: true
  data: {
    summary: ReadinessSummary
    items: ReadinessItem[]
  }
  requestId?: string
}

interface ApiError {
  ok: false
  code: string
  message: string
  requestId?: string
}

function buildQuery(params: Record<string, any>): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === 'all') return
    sp.set(k, String(v))
  })
  return sp.toString()
}

function fixActionLabel(type: FixActionType): string {
  switch (type) {
    case 'upload_evidence':
      return 'Upload Evidence'
    case 'request_attestation':
      return 'Request Attestation'
    case 'complete_controls':
      return 'Complete Controls'
    case 'resolve_incident':
      return 'Resolve Incident'
    case 'review_item':
      return 'Review Item'
    default:
      return 'Resolve'
  }
}

export default function AuditReadinessPage() {
  const router = useRouter()

  // Initialize from URL params or defaults (read from window.location on mount)
  const [category, setCategory] = useState<ReadinessCategory>('evidence')
  const [timeRange, setTimeRange] = useState('30d')
  const [severity, setSeverity] = useState<ReadinessSeverity | 'all'>('all')
  const [status, setStatus] = useState<'open' | 'in_progress' | 'waived' | 'resolved' | 'all'>('open')
  const [sort, setSort] = useState<'severity' | 'oldest' | 'score'>('severity')

  // Read URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('category')) setCategory(params.get('category') as ReadinessCategory)
      if (params.get('time_range')) setTimeRange(params.get('time_range') || '30d')
      if (params.get('severity')) setSeverity(params.get('severity') as ReadinessSeverity | 'all')
      if (params.get('status')) setStatus(params.get('status') as typeof status)
      if (params.get('sort')) setSort(params.get('sort') as typeof sort)
    }
  }, [])

  // Fix Queue state
  const [fixQueue, setFixQueue] = useState<ReadinessItem[]>([])
  const [fixQueueOpen, setFixQueueOpen] = useState(false)

  // Data state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [data, setData] = useState<ReadinessResponse['data'] | null>(null)

  // Modal state
  const [activeItem, setActiveItem] = useState<ReadinessItem | null>(null)
  const [showUploadEvidence, setShowUploadEvidence] = useState(false)
  const [showRequestAttestation, setShowRequestAttestation] = useState(false)
  const [exportingPack, setExportingPack] = useState(false)

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (category && category !== 'evidence') params.set('category', category)
    if (timeRange && timeRange !== '30d') params.set('time_range', timeRange)
    if (severity && severity !== 'all') params.set('severity', severity)
    if (status && status !== 'open') params.set('status', status)
    if (sort && sort !== 'severity') params.set('sort', sort)

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    window.history.replaceState({}, '', newUrl)
  }, [category, timeRange, severity, status, sort])

  const query = useMemo(() => {
    return buildQuery({
      category,
      time_range: timeRange,
      severity: severity === 'all' ? undefined : severity,
      status: status === 'all' ? undefined : status,
    })
  }, [category, timeRange, severity, status])

  const loadReadinessData = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/audit/readiness?${query}`, { method: 'GET' })
      const json = (await res.json()) as ReadinessResponse | ApiError

      if (!res.ok || ('ok' in json && json.ok === false)) {
        setError(json as ApiError)
        setData(null)
        return
      }

      setData((json as ReadinessResponse).data)
    } catch (e: any) {
      setError({ ok: false, code: 'NETWORK_ERROR', message: e?.message || 'Failed to load readiness' })
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReadinessData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const handleFix = (item: ReadinessItem) => {
    setActiveItem(item)

    switch (item.fix_action_type) {
      case 'upload_evidence':
        setShowUploadEvidence(true)
        break
      case 'request_attestation':
        setShowRequestAttestation(true)
        break
      case 'complete_controls':
        if (item.work_record_id) {
          router.push(`/operations/jobs/${item.work_record_id}?focus=controls`)
        }
        break
      case 'resolve_incident':
        if (item.work_record_id) {
          router.push(`/operations/jobs/${item.work_record_id}?view=incident`)
        }
        break
      case 'review_item':
        router.push(`/operations/audit?eventId=${item.affected_id}`)
        break
      default:
        console.warn('Unhandled fix action:', item.fix_action_type)
    }
  }

  const handleAddToQueue = (item: ReadinessItem) => {
    // Add to queue if not already there
    if (!fixQueue.find(q => q.id === item.id)) {
      setFixQueue([...fixQueue, item])
      setFixQueueOpen(true)
    }
  }

  const handleRemoveFromQueue = (id: string) => {
    setFixQueue(fixQueue.filter(q => q.id !== id))
  }

  const handleClearQueue = () => {
    setFixQueue([])
  }

  const handleModalComplete = () => {
    setShowUploadEvidence(false)
    setShowRequestAttestation(false)
    
    // Optimistically remove resolved item from queue if present
    if (activeItem) {
      setFixQueue(prev => prev.filter(q => q.id !== activeItem.id))
    }
    
    setActiveItem(null)
    
    // Optimistic UI update: remove resolved item from list immediately
    if (activeItem && data) {
      setData({
        ...data,
        items: data.items.filter(i => i.id !== activeItem.id),
        summary: {
          ...data.summary,
          total_items: data.summary.total_items - 1,
          [activeItem.severity === 'critical' ? 'critical_blockers' : activeItem.severity === 'material' ? 'material' : 'info']: 
            Math.max(0, (data.summary[activeItem.severity === 'critical' ? 'critical_blockers' : activeItem.severity === 'material' ? 'material' : 'info'] || 0) - 1),
        },
      })
    }
    
    // Refetch in background to sync with backend
    loadReadinessData()
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'material':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      default:
        return <Clock className="w-5 h-5 text-blue-400" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500/30 bg-red-500/10'
      case 'material':
        return 'border-yellow-500/30 bg-yellow-500/10'
      default:
        return 'border-blue-500/30 bg-blue-500/10'
    }
  }

  const summary = data?.summary
  const items = data?.items || []

  // Sort items
  const sortedItems = useMemo(() => {
    if (!items.length) return []
    const sorted = [...items]
    switch (sort) {
      case 'severity':
        return sorted.sort((a, b) => {
          const severityOrder = { critical: 0, material: 1, info: 2 }
          return severityOrder[a.severity] - severityOrder[b.severity]
        })
      case 'oldest':
        return sorted.sort((a, b) => {
          const aDate = a.created_at || a.due_date || ''
          const bDate = b.created_at || b.due_date || ''
          return aDate.localeCompare(bDate)
        })
      case 'score':
        // Sort by risk score if available in metadata, otherwise by severity
        return sorted.sort((a, b) => {
          const aScore = a.metadata?.risk_score || 0
          const bScore = b.metadata?.risk_score || 0
          return bScore - aScore
        })
      default:
        return sorted
    }
  }, [items, sort])

  if (loading && !data) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60">Loading audit readiness...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <DashboardNavbar />
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-[#F97316]" />
              <div>
                <h1 className={typography.h1}>Audit Readiness</h1>
                <p className="text-white/60 text-sm mt-2">
                  What&apos;s missing for audit? Fix these items to make your governance record audit-ready.
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            <div className={`${cardStyles.base} p-4 border-2 ${summary && summary.audit_ready_score >= 80 ? 'border-green-500/30 bg-green-500/10' : summary && summary.audit_ready_score >= 60 ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
              <div className="text-sm text-white/60 mb-1">Audit-Ready Score</div>
              <div className="text-2xl font-bold text-white">
                {summary ? summary.audit_ready_score : '—'}<span className="text-lg text-white/40">/100</span>
              </div>
            </div>
            <div className={cardStyles.base + ' p-4'}>
              <div className="text-sm text-white/60 mb-1">Total Items</div>
              <div className="text-2xl font-bold text-white">{summary ? summary.total_items : '—'}</div>
            </div>
            <div className={cardStyles.base + ' p-4 border-red-500/30 bg-red-500/10'}>
              <div className="text-sm text-white/60 mb-1">Critical Blockers</div>
              <div className="text-2xl font-bold text-red-400">{summary ? summary.critical_blockers : '—'}</div>
            </div>
            <div className={cardStyles.base + ' p-4 border-yellow-500/30 bg-yellow-500/10'}>
              <div className="text-sm text-white/60 mb-1">Material</div>
              <div className="text-2xl font-bold text-yellow-400">{summary ? summary.material : '—'}</div>
            </div>
            <div className={cardStyles.base + ' p-4 border-blue-500/30 bg-blue-500/10'}>
              <div className="text-sm text-white/60 mb-1">Time to Clear</div>
              <div className="text-lg font-bold text-blue-400">
                {summary?.estimated_time_to_clear_hours 
                  ? `${Math.ceil(summary.estimated_time_to_clear_hours)}h`
                  : '—'}
              </div>
              {summary?.estimated_time_to_clear_hours && summary.estimated_time_to_clear_hours > 0 && (
                <div className="text-xs text-white/50 mt-1">
                  {summary.category_breakdown.evidence > 0 && `Evidence: ~${Math.ceil(summary.category_breakdown.evidence * 0.5)}h `}
                  {summary.category_breakdown.controls > 0 && `Controls: ~${Math.ceil(summary.category_breakdown.controls * 1)}h`}
                </div>
              )}
            </div>
            <div className={cardStyles.base + ' p-4 border-blue-500/30 bg-blue-500/10'}>
              <div className="text-sm text-white/60 mb-1">Oldest Overdue</div>
              <div className="text-lg font-bold text-blue-400">
                {summary?.oldest_overdue_date 
                  ? `${Math.floor((Date.now() - new Date(summary.oldest_overdue_date).getTime()) / (1000 * 60 * 60 * 24))}d`
                  : '—'}
              </div>
              {summary?.oldest_overdue_date && (
                <div className="text-xs text-white/50 mt-1">
                  {new Date(summary.oldest_overdue_date).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Category Tabs + Filters */}
          <div className={cardStyles.base + ' p-4 mb-8'}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategory('evidence')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    category === 'evidence'
                      ? 'bg-[#F97316] text-black'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Evidence ({summary?.category_breakdown.evidence || 0})
                </button>
                <button
                  onClick={() => setCategory('controls')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    category === 'controls'
                      ? 'bg-[#F97316] text-black'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Controls ({summary?.category_breakdown.controls || 0})
                </button>
                <button
                  onClick={() => setCategory('attestations')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    category === 'attestations'
                      ? 'bg-[#F97316] text-black'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Attestations ({summary?.category_breakdown.attestations || 0})
                </button>
                <button
                  onClick={() => setCategory('incidents')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    category === 'incidents'
                      ? 'bg-[#F97316] text-black'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Incidents ({summary?.category_breakdown.incidents || 0})
                </button>
                <button
                  onClick={() => setCategory('access')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    category === 'access'
                      ? 'bg-[#F97316] text-black'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Access ({summary?.category_breakdown.access || 0})
                </button>
              </div>
              <button
                onClick={loadReadinessData}
                className={buttonStyles.secondary + ' text-sm'}
              >
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Time Range</label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#F97316]"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as ReadinessSeverity | 'all')}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#F97316]"
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="material">Material</option>
                  <option value="info">Info</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#F97316]"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waived">Waived</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Sort By</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#F97316]"
                >
                  <option value="severity">Severity</option>
                  <option value="oldest">Oldest First</option>
                  <option value="score">Risk Score</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className={`${cardStyles.base} p-6 border-red-500/30 bg-red-500/10 mb-8`}>
              <div className="flex items-center gap-3 mb-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <div className="font-semibold text-red-400">Failed to load readiness</div>
              </div>
              <p className="text-sm text-white/70">{error.message}</p>
              {error.requestId && process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-white/50 mt-2">Request ID: {error.requestId}</p>
              )}
            </div>
          )}

          {/* Readiness Items List */}
          {sortedItems.length === 0 && !loading && !error && (
            <div className={cardStyles.base + ' p-12 text-center'}>
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className={typography.h2 + ' mb-2'}>All Clear</h3>
              <p className="text-white/60 mb-6">
                No {category} readiness issues found for {timeRange === 'all' ? 'all time' : `the last ${timeRange}`}.
              </p>
              <button
                onClick={() => router.push('/operations/audit')}
                className={buttonStyles.primary}
              >
                View Compliance Ledger
              </button>
            </div>
          )}

          {sortedItems.length > 0 && (
            <div className="space-y-4 mb-8">
              {sortedItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${cardStyles.base} p-6 border-2 ${getSeverityColor(item.severity)}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5">
                      {getSeverityIcon(item.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.severity === 'critical' ? 'bg-red-500/30 text-red-300' :
                          item.severity === 'material' ? 'bg-yellow-500/30 text-yellow-300' :
                          'bg-blue-500/30 text-blue-300'
                        }`}>
                          {item.rule_code}
                        </span>
                        <span className="text-xs text-white/50 uppercase tracking-wide">
                          {item.severity}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white mb-1">{item.rule_name}</h3>
                      <p className="text-sm text-white/70 mb-2">{item.why_it_matters}</p>
                      {item.work_record_name && (
                        <p className="text-xs text-white/50 mb-2">
                          {terms.workRecord.singular}: {item.work_record_name}
                          {item.owner_name && ` • Owner: ${item.owner_name}`}
                          {item.due_date && ` • Due: ${new Date(item.due_date).toLocaleDateString()}`}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleFix(item)}
                      className={buttonStyles.primary + ' whitespace-nowrap'}
                    >
                      {fixActionLabel(item.fix_action_type)} <ArrowRight className="w-4 h-4 inline ml-1" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Footer CTA */}
          <div className={`${cardStyles.base} p-6 border-2 border-[#F97316]/30`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-sm text-white/70 mb-2">
                  {summary && summary.total_items === 0
                    ? 'Your governance record is audit-ready for export.'
                    : `Resolve ${summary && summary.critical_blockers > 0 ? `${summary.critical_blockers} critical blocker${summary.critical_blockers > 1 ? 's' : ''} ` : ''}to make your record audit-ready.`}
                </p>
                {summary?.estimated_time_to_clear_hours && summary.estimated_time_to_clear_hours > 0 && (
                  <p className="text-xs text-white/50">
                    Estimated time to clear: {Math.ceil(summary.estimated_time_to_clear_hours)} hours
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push('/operations/audit')}
                  className={buttonStyles.secondary}
                >
                  View Compliance Ledger
                </button>
                <button
                  onClick={async () => {
                    setExportingPack(true)
                    try {
                      const response = await fetch('/api/audit/export/pack', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ time_range: timeRange }),
                      })
                      if (!response.ok) throw new Error('Export failed')
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `audit-pack-${new Date().toISOString().split('T')[0]}.zip`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                    } catch (err) {
                      console.error('Failed to export audit pack:', err)
                      alert('Failed to export audit pack. Please try again.')
                    } finally {
                      setExportingPack(false)
                    }
                  }}
                  disabled={exportingPack}
                  className={buttonStyles.primary + ' ' + (exportingPack ? 'opacity-50 cursor-not-allowed' : '')}
                >
                  {exportingPack ? 'Generating...' : 'Export Audit Pack'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Fix Queue Sidebar */}
        <FixQueueSidebar
          isOpen={fixQueueOpen}
          items={fixQueue}
          onRemove={handleRemoveFromQueue}
          onClear={handleClearQueue}
          onFix={handleFix}
        />

        {/* Fix Queue Toggle Button */}
        {fixQueue.length > 0 && (
          <button
            onClick={() => setFixQueueOpen(!fixQueueOpen)}
            className="fixed right-4 bottom-4 bg-[#F97316] text-black px-4 py-2 rounded-lg font-semibold shadow-lg hover:bg-[#FB923C] transition-colors flex items-center gap-2 z-30"
          >
            <CheckSquare className="w-5 h-5" />
            Fix Queue ({fixQueue.length})
          </button>
        )}
      </div>

      {/* Modals */}
      {activeItem && showUploadEvidence && (
        <UploadEvidenceModal
          isOpen={showUploadEvidence}
          onClose={() => {
            setShowUploadEvidence(false)
            setActiveItem(null)
          }}
          onComplete={handleModalComplete}
          workRecordId={activeItem.work_record_id || activeItem.affected_id}
          workRecordName={activeItem.work_record_name || activeItem.affected_name}
        />
      )}

      {activeItem && showRequestAttestation && (
        <RequestAttestationModal
          isOpen={showRequestAttestation}
          onClose={() => {
            setShowRequestAttestation(false)
            setActiveItem(null)
          }}
          onComplete={handleModalComplete}
          workRecordId={activeItem.work_record_id || activeItem.affected_id}
          workRecordName={activeItem.work_record_name || activeItem.affected_name}
        />
      )}
    </ProtectedRoute>
  )
}
