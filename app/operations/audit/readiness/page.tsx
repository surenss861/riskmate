'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, Clock, FileText, Shield, User, XCircle } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { jobsApi, auditApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { cardStyles, buttonStyles, typography } from '@/lib/styles/design-system'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { useRouter } from 'next/navigation'
import { terms } from '@/lib/terms'

interface ReadinessItem {
  id: string
  type: 'missing_evidence' | 'unsigned_attestation' | 'overdue_control' | 'violation_attempt'
  title: string
  description: string
  severity: 'critical' | 'material' | 'info'
  job_id?: string
  job_name?: string
  action_url: string
}

export default function AuditReadinessPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ReadinessItem[]>([])
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    material: 0,
    resolved: 0,
  })
  const [oldestOverdueDate, setOldestOverdueDate] = useState<Date | null>(null)
  const [exportingPack, setExportingPack] = useState(false)

  useEffect(() => {
    loadReadinessData()
  }, [])

  const loadReadinessData = async () => {
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

      const readinessItems: ReadinessItem[] = []

      // 1. Missing evidence (jobs without documents)
      const { data: jobsWithoutDocs } = await supabase
        .from('jobs')
        .select('id, client_name, risk_score, risk_level')
        .eq('organization_id', orgData.id)
        .is('deleted_at', null)
        .gt('risk_score', 50) // Only high-risk jobs need evidence

      if (jobsWithoutDocs) {
        for (const job of jobsWithoutDocs) {
          const { data: docs } = await supabase
            .from('documents')
            .select('id')
            .eq('job_id', job.id)
            .limit(1)

          if (!docs || docs.length === 0) {
            readinessItems.push({
              id: `missing-evidence-${job.id}`,
              type: 'missing_evidence',
              title: `Missing ${terms.evidence.singular.toLowerCase()} for high-risk ${terms.workRecord.singular.toLowerCase()}`,
              description: `${job.client_name} (Risk: ${job.risk_score || 'N/A'}) has no ${terms.evidence.singular.toLowerCase()} attached`,
              severity: job.risk_score && job.risk_score > 75 ? 'critical' : 'material',
              job_id: job.id,
              job_name: job.client_name,
              action_url: `/operations/jobs/${job.id}?view=packet`,
            })
          }
        }
      }

      // 2. Unsigned attestations (jobs without sign-offs)
      const { data: highRiskJobs } = await supabase
        .from('jobs')
        .select('id, client_name, risk_score')
        .eq('organization_id', orgData.id)
        .is('deleted_at', null)
        .gt('risk_score', 75)

      if (highRiskJobs) {
        for (const job of highRiskJobs) {
          const { data: signoffs } = await supabase
            .from('job_signoffs')
            .select('id')
            .eq('job_id', job.id)
            .eq('status', 'signed')
            .limit(1)

          if (!signoffs || signoffs.length === 0) {
            readinessItems.push({
              id: `unsigned-${job.id}`,
              type: 'unsigned_attestation',
              title: `Missing ${terms.attestation.singular.toLowerCase()} for high-risk ${terms.workRecord.singular.toLowerCase()}`,
              description: `${job.client_name} requires role-based ${terms.attestation.singular.toLowerCase()}`,
              severity: 'material',
              job_id: job.id,
              job_name: job.client_name,
              action_url: `/operations/jobs/${job.id}?view=packet`,
            })
          }
        }
      }

      // 3. Overdue controls (mitigations not completed)
      const { data: jobsWithMitigations } = await supabase
        .from('jobs')
        .select('id, client_name, risk_score, created_at')
        .eq('organization_id', orgData.id)
        .is('deleted_at', null)
        .gt('risk_score', 50)

      let oldestOverdue: Date | null = null
      if (jobsWithMitigations) {
        for (const job of jobsWithMitigations) {
          const { data: mitigations } = await supabase
            .from('mitigation_items')
            .select('id, done, is_completed, created_at')
            .eq('job_id', job.id)

          if (mitigations) {
            const incomplete = mitigations.filter(m => !m.done && !m.is_completed)
            if (incomplete.length > 0) {
              // Track oldest overdue date
              incomplete.forEach(m => {
                if (m.created_at) {
                  const createdDate = new Date(m.created_at)
                  if (!oldestOverdue || createdDate < oldestOverdue) {
                    oldestOverdue = createdDate
                  }
                }
              })

              readinessItems.push({
                id: `overdue-control-${job.id}`,
                type: 'overdue_control',
                title: `${incomplete.length} overdue ${terms.control.singular.toLowerCase()}${incomplete.length > 1 ? 's' : ''} for ${terms.workRecord.singular.toLowerCase()}`,
                description: `${job.client_name} has ${incomplete.length} incomplete ${terms.control.singular.toLowerCase()}${incomplete.length > 1 ? 's' : ''}`,
                severity: job.risk_score && job.risk_score > 75 ? 'critical' : 'material',
                job_id: job.id,
                job_name: job.client_name,
                action_url: `/operations/jobs/${job.id}`,
              })
            }
          }
        }
      }
      setOldestOverdueDate(oldestOverdue)

      // 4. Role violation attempts
      const { data: violations } = await supabase
        .from('audit_logs')
        .select('id, job_id, job_title, created_at, summary')
        .eq('organization_id', orgData.id)
        .eq('event_name', 'auth.role_violation')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10)

      if (violations) {
        violations.forEach((violation) => {
          readinessItems.push({
            id: `violation-${violation.id}`,
            type: 'violation_attempt',
            title: 'Role violation attempt logged',
            description: violation.summary || 'Unauthorized action attempt',
            severity: 'critical',
            job_id: violation.job_id || undefined,
            job_name: violation.job_title || undefined,
            action_url: violation.job_id ? `/operations/audit?job_id=${violation.job_id}` : '/operations/audit?view=governance-enforcement',
          })
        })
      }

      setItems(readinessItems)
      setStats({
        total: readinessItems.length,
        critical: readinessItems.filter(i => i.severity === 'critical').length,
        material: readinessItems.filter(i => i.severity === 'material').length,
        resolved: 0, // Would track resolved items
      })
    } catch (err) {
      console.error('Failed to load audit readiness data:', err)
    } finally {
      setLoading(false)
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'missing_evidence':
        return `Missing ${terms.evidence.singular}`
      case 'unsigned_attestation':
        return `Missing ${terms.attestation.singular}`
      case 'overdue_control':
        return `Overdue ${terms.control.singular}`
      case 'violation_attempt':
        return 'Violation Attempt'
      default:
        return 'Issue'
    }
  }

  if (loading) {
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
                <h1 className={`${typography.h1}`}>Audit Readiness</h1>
                <p className="text-white/60 text-sm mt-2">
                  What&apos;s missing for audit? Complete these items to make your governance record audit-ready.
                </p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className={cardStyles.base + ' p-4'}>
              <div className="text-sm text-white/60 mb-1">Total Items</div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
            </div>
            <div className={cardStyles.base + ' p-4 border-red-500/30 bg-red-500/10'}>
              <div className="text-sm text-white/60 mb-1">Critical Blockers</div>
              <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
            </div>
            <div className={cardStyles.base + ' p-4 border-yellow-500/30 bg-yellow-500/10'}>
              <div className="text-sm text-white/60 mb-1">Material</div>
              <div className="text-2xl font-bold text-yellow-400">{stats.material}</div>
            </div>
            <div className={cardStyles.base + ' p-4 border-blue-500/30 bg-blue-500/10'}>
              <div className="text-sm text-white/60 mb-1">Oldest Overdue</div>
              <div className="text-lg font-bold text-blue-400">
                {oldestOverdueDate 
                  ? `${Math.floor((Date.now() - oldestOverdueDate.getTime()) / (1000 * 60 * 60 * 24))}d`
                  : '—'}
              </div>
              {oldestOverdueDate && (
                <div className="text-xs text-white/50 mt-1">
                  {oldestOverdueDate.toLocaleDateString()}
                </div>
              )}
            </div>
            <div className={cardStyles.base + ' p-4 border-green-500/30 bg-green-500/10'}>
              <div className="text-sm text-white/60 mb-1">Resolved</div>
              <div className="text-2xl font-bold text-green-400">{stats.resolved}</div>
            </div>
          </div>

          {/* Readiness Checklist */}
          {items.length === 0 ? (
            <div className={cardStyles.base + ' p-12 text-center'}>
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className={`${typography.h2} mb-2`}>All Clear</h3>
              <p className="text-white/60 mb-6">
                Your governance record is audit-ready. All {terms.evidence.plural.toLowerCase()}, {terms.attestation.plural.toLowerCase()}, and {terms.control.plural.toLowerCase()} are complete.
              </p>
              <button
                onClick={() => router.push('/operations/audit')}
                className={buttonStyles.primary}
              >
                View Compliance Ledger
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
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
                          {getTypeLabel(item.type)}
                        </span>
                        <span className="text-xs text-white/50 uppercase tracking-wide">
                          {item.severity}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                      <p className="text-sm text-white/70 mb-4">{item.description}</p>
                      {item.job_name && (
                        <p className="text-xs text-white/50 mb-4">
                          {terms.workRecord.singular}: {item.job_name}
                        </p>
                      )}
                      <button
                        onClick={() => router.push(item.action_url)}
                        className={buttonStyles.secondary + ' text-sm'}
                      >
                        Resolve →
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Footer CTA */}
          <div className={`${cardStyles.base} p-6 mt-8 border-2 border-[#F97316]/30`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-sm text-white/70 mb-2">
                  {stats.total === 0 
                    ? 'Your governance record is audit-ready for export.'
                    : `Resolve ${stats.critical > 0 ? `${stats.critical} critical blocker${stats.critical > 1 ? 's' : ''} ` : ''}to make your record audit-ready.`}
                </p>
                {stats.critical > 0 && (
                  <p className="text-xs text-yellow-400">
                    {oldestOverdueDate && `Oldest overdue item: ${Math.floor((Date.now() - oldestOverdueDate.getTime()) / (1000 * 60 * 60 * 24))} days`}
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
                        body: JSON.stringify({ time_range: '30d' }),
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
      </div>
    </ProtectedRoute>
  )
}

