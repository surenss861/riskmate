'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, CheckCircle, Clock, Shield, XCircle, CheckSquare, ArrowRight } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { typography } from '@/lib/styles/design-system'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { useRouter } from 'next/navigation'
import { terms } from '@/lib/terms'
import { UploadEvidenceModal } from '@/components/audit/UploadEvidenceModal'
import { RequestAttestationModal } from '@/components/audit/RequestAttestationModal'
import { FixQueueSidebar } from '@/components/audit/FixQueueSidebar'
import { BulkActionResultModal } from '@/components/audit/BulkActionResultModal'
import { ToastContainer } from '@/components/ToastContainer'
import type { FixQueueItem } from '@/components/audit/FixQueueSidebar'
import { auditApi } from '@/lib/api'
import { toast } from '@/lib/utils/toast'
import { AppBackground, AppShell, PageSection, GlassCard, Button, Badge, Select, PageHeader } from '@/components/shared'

type ReadinessCategory = 'evidence' | 'controls' | 'attestations' | 'incidents' | 'access'
type ReadinessSeverity = 'critical' | 'material' | 'info'
type FixActionType = 'upload_evidence' | 'request_attestation' | 'complete_controls' | 'resolve_incident' | 'review_item' | 'create_evidence' | 'create_control' | 'mark_resolved'

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
  const [fixQueue, setFixQueue] = useState<FixQueueItem[]>([])
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
  const [showBulkResult, setShowBulkResult] = useState(false)
  const [bulkResult, setBulkResult] = useState<{
    succeeded: number
    failed: number
    failedItems: Array<{ readiness_item_id: string; rule_code: string; action_type: string; error: string }>
    requestId?: string
  } | null>(null)

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
      setError({ ok: false, code: 'NETWORK_ERROR', message: e?.message || 'Failed to load audit readiness. Backend server may be unreachable.' })
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
      // Convert ReadinessItem to FixQueueItem
      const queueItem: FixQueueItem = {
        id: item.id,
        rule_code: item.rule_code,
        rule_name: item.rule_name,
        category: item.category,
        severity: item.severity,
        work_record_id: item.work_record_id,
        work_record_name: item.work_record_name,
        affected_id: item.affected_id,
        affected_name: item.affected_name,
        fix_action_type: item.fix_action_type,
      }
      setFixQueue([...fixQueue, queueItem])
      setFixQueueOpen(true)
    }
  }

  const handleRemoveFromQueue = (id: string) => {
    setFixQueue(fixQueue.filter(q => q.id !== id))
  }

  const handleClearQueue = () => {
    setFixQueue([])
  }

  const handleFixFromQueue = (queueItem: FixQueueItem) => {
    // Find the full item from the data to get all required fields
    const fullItem = data?.items.find(i => i.id === queueItem.id)
    if (fullItem) {
      handleFix(fullItem)
    } else {
      // If item not found in current data, reconstruct from queue item
      const reconstructedItem: ReadinessItem = {
        id: queueItem.id,
        rule_code: queueItem.rule_code,
        rule_name: queueItem.rule_name,
        category: queueItem.category,
        severity: queueItem.severity,
        affected_type: 'work_record',
        affected_id: queueItem.work_record_id || queueItem.affected_id || queueItem.id,
        affected_name: queueItem.work_record_name || queueItem.affected_name,
        work_record_id: queueItem.work_record_id,
        work_record_name: queueItem.work_record_name,
        status: 'open',
        why_it_matters: '',
        fix_action_type: queueItem.fix_action_type,
      }
      handleFix(reconstructedItem)
    }
  }

  const handleModalComplete = async (result?: { meta?: { replayed?: boolean; requestId?: string } }) => {
    setShowUploadEvidence(false)
    setShowRequestAttestation(false)
    
    // Show replay toast in dev mode
    if (result?.meta?.replayed && process.env.NODE_ENV === 'development') {
      toast.info('Response replayed from cache', result.meta.requestId)
    }
    
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
    
    toast.success('Resolved — readiness updated. Action logged in compliance ledger.', result?.meta?.requestId)
    
    // Refetch in background to sync with backend
    loadReadinessData()
  }

  const handleBulkResolve = async () => {
    if (fixQueue.length === 0) return

    try {
      // Map fix_action_type to API action_type
      const mapActionType = (type: string): 'create_evidence' | 'request_attestation' | 'create_control' | 'mark_resolved' => {
        if (type === 'upload_evidence' || type === 'create_evidence') return 'create_evidence'
        if (type === 'request_attestation') return 'request_attestation'
        if (type === 'complete_controls' || type === 'create_control') return 'create_control'
        return 'mark_resolved'
      }

      // Find full items from data to get rule_code
      const itemsWithData = fixQueue.map(queueItem => {
        const fullItem = data?.items.find(i => i.id === queueItem.id)
        if (!fullItem) {
          throw new Error(`Item ${queueItem.id} not found in data`)
        }
        return {
          readiness_item_id: queueItem.id,
          rule_code: fullItem.rule_code,
          action_type: mapActionType(queueItem.fix_action_type) as 'create_evidence' | 'request_attestation' | 'create_control' | 'mark_resolved',
          payload: {
            job_id: queueItem.work_record_id || queueItem.affected_id,
            // Add other payload fields based on action_type if needed
          },
        }
      })

      const { json: result, meta } = await auditApi.bulkResolveReadiness({
        items: itemsWithData,
      })

      // Remove succeeded items from queue and UI
      const succeededIds = result.results
        .filter(r => r.success)
        .map(r => r.readiness_item_id)

      setFixQueue(prev => prev.filter(q => !succeededIds.includes(q.id)))
      
      if (data) {
        setData({
          ...data,
          items: data.items.filter(i => !succeededIds.includes(i.id)),
          summary: {
            ...data.summary,
            total_items: Math.max(0, data.summary.total_items - succeededIds.length),
          },
        })
      }

      // Show results
      if (result.failed > 0) {
        setBulkResult({
          succeeded: result.successful,
          failed: result.failed,
          failedItems: result.failed_items || [],
          requestId: meta.requestId,
        })
        setShowBulkResult(true)
        toast.warning(`Resolved ${result.successful}, ${result.failed} failed`, meta.requestId)
      } else {
        toast.success(`Resolved ${result.successful} items. Actions logged in compliance ledger.`, meta.requestId)
      }

      // Background refetch
      loadReadinessData()
    } catch (error: any) {
      console.error('Bulk resolve failed:', error)
      toast.error(error.message || 'Failed to resolve items. No ledger events were created.', error.requestId)
    }
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

  // Sort items
  const sortedItems = useMemo(() => {
    const items = data?.items || []
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
  }, [data?.items, sort])

  if (loading && !data) {
    return (
      <ProtectedRoute>
        <AppBackground>
          <DashboardNavbar />
          <AppShell>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/60">Loading audit readiness...</p>
              </div>
            </div>
          </AppShell>
        </AppBackground>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppBackground>
        <DashboardNavbar />
        <AppShell>
          <PageSection>
            <PageHeader
              title="Audit Readiness"
              subtitle="What's missing for audit? Fix these items to make your governance record audit-ready."
            />
          </PageSection>

          {/* Enhanced Summary Cards */}
          <PageSection>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <GlassCard className={`p-4 border-2 ${summary && summary.audit_ready_score >= 80 ? 'border-green-500/30 bg-green-500/10' : summary && summary.audit_ready_score >= 60 ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
              <div className="text-sm text-white/60 mb-1">Audit-Ready Score</div>
              <div className="text-2xl font-bold text-white">
                {summary ? summary.audit_ready_score : '—'}<span className="text-lg text-white/40">/100</span>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-sm text-white/60 mb-1">Total Items</div>
              <div className="text-2xl font-bold text-white">{summary ? summary.total_items : '—'}</div>
            </GlassCard>
            <GlassCard className="p-4 border-red-500/30 bg-red-500/10">
              <div className="text-sm text-white/60 mb-1">Critical Blockers</div>
              <div className="text-2xl font-bold text-red-400">{summary ? summary.critical_blockers : '—'}</div>
            </GlassCard>
            <GlassCard className="p-4 border-yellow-500/30 bg-yellow-500/10">
              <div className="text-sm text-white/60 mb-1">Material</div>
              <div className="text-2xl font-bold text-yellow-400">{summary ? summary.material : '—'}</div>
            </GlassCard>
            <GlassCard className="p-4 border-blue-500/30 bg-blue-500/10">
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
            </GlassCard>
            <GlassCard className="p-4 border-blue-500/30 bg-blue-500/10">
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
            </GlassCard>
          </div>
          </PageSection>

          {/* Category Tabs + Filters */}
          <PageSection>
            <GlassCard className="p-4">
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
              <Button
                variant="secondary"
                size="sm"
                onClick={loadReadinessData}
              >
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Time Range</label>
                <Select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="all">All time</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Severity</label>
                <Select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as ReadinessSeverity | 'all')}
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="material">Material</option>
                  <option value="info">Info</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Status</label>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waived">Waived</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Sort By</label>
                <Select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                >
                  <option value="severity">Severity</option>
                  <option value="oldest">Oldest First</option>
                  <option value="score">Risk Score</option>
                </Select>
              </div>
            </div>
            </GlassCard>
          </PageSection>

          {/* Error State */}
          {error && (
            <PageSection>
            <GlassCard className="p-6 border-red-500/30 bg-red-500/10">
              <div className="flex items-center gap-3 mb-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <div className="font-semibold text-red-400">Failed to load audit readiness</div>
              </div>
              <p className="text-sm text-white/70">{error.message}</p>
              {error.requestId && process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-white/50 mt-2">Request ID: {error.requestId}</p>
              )}
            </GlassCard>
            </PageSection>
          )}

          {/* Readiness Items List */}
          {sortedItems.length === 0 && !loading && !error && (
            <PageSection>
            <GlassCard className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className={typography.h2 + ' mb-2'}>All Clear</h3>
              <p className="text-white/60 mb-6">
                No {category} readiness issues found for {timeRange === 'all' ? 'all time' : `the last ${timeRange}`}.
              </p>
              <Button
                variant="primary"
                onClick={() => router.push('/operations/audit')}
              >
                View Compliance Ledger
              </Button>
            </GlassCard>
            </PageSection>
          )}

          {sortedItems.length > 0 && (
            <PageSection>
            <div className="space-y-4">
              {sortedItems.map((item) => (
                <GlassCard key={item.id} className={`p-6 border-2 ${getSeverityColor(item.severity)}`}>
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5">
                      {getSeverityIcon(item.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={item.severity === 'critical' ? 'critical' : item.severity === 'material' ? 'warning' : 'neutral'}>
                          {item.rule_code}
                        </Badge>
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
                    <Button
                      variant="primary"
                      onClick={() => handleFix(item)}
                      className="whitespace-nowrap"
                    >
                      {fixActionLabel(item.fix_action_type)} <ArrowRight className="w-4 h-4 inline ml-1" />
                    </Button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </PageSection>
          )}

          {/* Footer CTA */}
          <PageSection>
          <GlassCard className="p-6 border-2 border-[#F97316]/30">
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
                <Button
                  variant="secondary"
                  onClick={() => router.push('/operations/audit')}
                >
                  View Compliance Ledger
                </Button>
                <Button
                  variant="primary"
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
                    } catch (err: any) {
                      console.error('Failed to generate proof pack:', err)
                      
                      // Extract structured error details
                      let errorMessage = 'Failed to generate proof pack'
                      let errorId: string | null = null
                      let hint: string | null = null
                      let code: string | null = null
                      
                      try {
                        // If err is a Response object, try to extract from it
                        if (err instanceof Response || err.response) {
                          const response = err instanceof Response ? err : err.response
                          const errorIdFromHeader = response.headers.get('X-Error-ID')
                          
                          try {
                            const errorText = await response.text()
                            try {
                              const errorData = JSON.parse(errorText)
                              errorMessage = errorData.message || errorMessage
                              errorId = errorData.error_id || errorData.errorId || errorIdFromHeader
                              hint = errorData.support_hint || errorData.hint
                              code = errorData.code
                            } catch {
                              // If not JSON, use header error ID
                              errorId = errorIdFromHeader
                            }
                          } catch {
                            // If reading fails, use header error ID
                            errorId = errorIdFromHeader
                          }
                        } else if (err.message) {
                          // If err is an Error object with attached properties
                          errorMessage = err.message
                          errorId = err.error_id || err.errorId
                          hint = err.support_hint || err.hint
                          code = err.code
                        }
                      } catch {
                        // If parsing fails, use the error message as-is
                        errorMessage = err.message || errorMessage
                      }
                      
                      // Build user-friendly error message with code and error ID
                      let displayMessage = errorMessage
                      if (code && errorId) {
                        displayMessage = `${code} • Error ID: ${errorId}`
                      } else if (code) {
                        displayMessage = `${code} • ${errorMessage}`
                      } else if (errorId) {
                        displayMessage = `${errorMessage} • Error ID: ${errorId}`
                      }
                      
                      alert(`${displayMessage}${hint ? `\n\n${hint}` : '\n\nPlease try again or contact support with the Error ID if this persists.'}`)
                    } finally {
                      setExportingPack(false)
                    }
                  }}
                  disabled={exportingPack}
                >
                  {exportingPack ? 'Generating...' : 'Generate Proof Pack'}
                </Button>
              </div>
            </div>
          </GlassCard>
          </PageSection>
        </AppShell>

        {/* Fix Queue Sidebar */}
        <FixQueueSidebar
          isOpen={fixQueueOpen}
          items={fixQueue}
          onRemove={handleRemoveFromQueue}
          onClear={handleClearQueue}
          onFix={handleFixFromQueue}
          onBulkResolve={handleBulkResolve}
        />

        {/* Toast Container */}
        <ToastContainer />

        {/* Bulk Result Modal */}
        {showBulkResult && bulkResult && (
          <BulkActionResultModal
            isOpen={showBulkResult}
            onClose={() => {
              setShowBulkResult(false)
              setBulkResult(null)
            }}
            title="Bulk Resolve Results"
            succeededCount={bulkResult.succeeded}
            failedCount={bulkResult.failed}
            failures={bulkResult.failedItems.map(f => ({
              id: f.readiness_item_id,
              code: f.rule_code,
              message: f.error,
            }))}
            requestId={bulkResult.requestId}
            onShowInTable={(ids) => {
              // Keep failed items selected
              // This could scroll to them or highlight them
              setShowBulkResult(false)
            }}
          />
        )}

        {/* Fix Queue Toggle Button */}
        {fixQueue.length > 0 && (
          <Button
            variant="primary"
            onClick={() => setFixQueueOpen(!fixQueueOpen)}
            className="fixed right-4 bottom-4 shadow-lg flex items-center gap-2 z-30"
          >
            <CheckSquare className="w-5 h-5" />
            Fix Queue ({fixQueue.length})
          </Button>
        )}
      </AppBackground>

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
          readinessItemId={activeItem.id}
          ruleCode={activeItem.rule_code}
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
          readinessItemId={activeItem.id}
          ruleCode={activeItem.rule_code}
        />
      )}
    </ProtectedRoute>
  )
}
