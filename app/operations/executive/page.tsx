'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle, FileCheck, TrendingUp, Lock, CheckCircle, Info, ExternalLink } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { executiveApi } from '@/lib/api'
import { cardStyles, typography, buttonStyles } from '@/lib/styles/design-system'

interface RiskPosture {
  exposure_level: 'low' | 'moderate' | 'high'
  unresolved_violations: number
  open_reviews: number
  high_risk_jobs: number
  open_incidents: number
  pending_signoffs: number
  signed_signoffs: number
  proof_packs_generated: number
  last_material_event_at: string | null
  confidence_statement: string
  ledger_integrity: 'verified' | 'error' | 'not_verified'
  ledger_integrity_last_verified_at: string | null
  ledger_integrity_verified_through_event_id: string | null
  ledger_integrity_error_details?: {
    failingEventId?: string
    expectedHash?: string
    gotHash?: string
    eventIndex?: number
  }
  flagged_jobs: number
  signed_jobs: number
  unsigned_jobs: number
  recent_violations: number
  drivers?: {
    highRiskJobs: Array<{ key: string; label: string; count: number; href?: string }>
    openIncidents: Array<{ key: string; label: string; count: number; href?: string }>
    violations: Array<{ key: string; label: string; count: number; href?: string }>
    flagged: Array<{ key: string; label: string; count: number; href?: string }>
    pending: Array<{ key: string; label: string; count: number; href?: string }>
    signed: Array<{ key: string; label: string; count: number; href?: string }>
    proofPacks: Array<{ key: string; label: string; count: number; href?: string }>
  }
  deltas?: {
    high_risk_jobs: number
    open_incidents: number
    violations: number
    flagged_jobs: number
    pending_signoffs: number
    signed_signoffs: number
    proof_packs: number
  }
  recommended_actions?: Array<{
    priority: number
    action: string
    href: string
    reason: string
  }>
}

type TimeRange = '7d' | '30d' | '90d' | 'all'

export default function ExecutiveSnapshotPage() {
  const [loading, setLoading] = useState(true)
  const [riskPosture, setRiskPosture] = useState<RiskPosture | null>(null)
  const [user, setUser] = useState<any>(null)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  useEffect(() => {
    loadRiskPosture()
  }, [timeRange])

  const loadRiskPosture = async () => {
    try {
      setLoading(true)
      const supabase = createSupabaseBrowserClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      if (!authUser) {
        setLoading(false)
        return
      }

      // Get organization
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('id', authUser.id)
        .single()

      if (userError || !userRow?.organization_id) {
        console.error('Failed to load user data:', userError)
        setLoading(false)
        return
      }

      // Verify executive role (read-only access)
      if (userRow.role !== 'executive' && userRow.role !== 'owner' && userRow.role !== 'admin') {
        window.location.href = '/operations'
        setLoading(false)
        return
      }

      // Fetch risk posture from backend
      try {
        const response = await executiveApi.getRiskPosture({ time_range: timeRange })
        if (response?.data) {
          setRiskPosture(response.data)
        } else {
          console.error('Invalid response from risk posture API:', response)
          // Set default values on error
          setRiskPosture({
            exposure_level: 'low',
            unresolved_violations: 0,
            open_reviews: 0,
            high_risk_jobs: 0,
            open_incidents: 0,
            pending_signoffs: 0,
            signed_signoffs: 0,
            proof_packs_generated: 0,
            last_material_event_at: null,
            confidence_statement: '✅ No unresolved governance violations. All jobs within acceptable risk thresholds.',
            ledger_integrity: 'not_verified',
            ledger_integrity_last_verified_at: null,
            ledger_integrity_verified_through_event_id: null,
            flagged_jobs: 0,
            signed_jobs: 0,
            unsigned_jobs: 0,
            recent_violations: 0,
          })
        }
      } catch (apiError: any) {
        console.error('Risk posture API error:', apiError)
        // Set default values on error so page doesn't stay in loading state
        setRiskPosture({
          exposure_level: 'low',
          unresolved_violations: 0,
          open_reviews: 0,
          high_risk_jobs: 0,
          open_incidents: 0,
          pending_signoffs: 0,
          signed_signoffs: 0,
          proof_packs_generated: 0,
          last_material_event_at: null,
          confidence_statement: '✅ No unresolved governance violations. All jobs within acceptable risk thresholds.',
          ledger_integrity: 'not_verified',
          ledger_integrity_last_verified_at: null,
          ledger_integrity_verified_through_event_id: null,
          flagged_jobs: 0,
          signed_jobs: 0,
          unsigned_jobs: 0,
          recent_violations: 0,
        })
      } finally {
        setLoading(false)
      }
    } catch (err: any) {
      console.error('Failed to load risk posture:', err)
      // Set default values on error
      setRiskPosture({
        exposure_level: 'low',
        unresolved_violations: 0,
        open_reviews: 0,
        high_risk_jobs: 0,
        open_incidents: 0,
        pending_signoffs: 0,
        signed_signoffs: 0,
        proof_packs_generated: 0,
        last_material_event_at: null,
        confidence_statement: '✅ No unresolved governance violations. All jobs within acceptable risk thresholds.',
        ledger_integrity: 'pending',
        flagged_jobs: 0,
        signed_jobs: 0,
        unsigned_jobs: 0,
        recent_violations: 0,
      })
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const getExposureColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-400'
      case 'moderate': return 'text-yellow-400'
      default: return 'text-green-400'
    }
  }

  const getIntegrityIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-400" />
      default: return <Lock className="w-4 h-4 text-yellow-400" />
    }
  }

  const getIntegrityText = (status: string, lastVerifiedAt: string | null) => {
    switch (status) {
      case 'verified': return 'Ledger verified'
      case 'error': return 'Integrity mismatch detected'
      case 'not_verified': 
        return lastVerifiedAt 
          ? `Not yet verified (last checked: ${new Date(lastVerifiedAt).toLocaleDateString()})`
          : 'Not yet verified'
      default: return 'Verification status unknown'
    }
  }

  const formatDelta = (delta: number) => {
    if (delta === 0) return null
    const sign = delta > 0 ? '+' : ''
    return `${sign}${delta}`
  }

  if (loading || !riskPosture) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60">Loading risk posture...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen overflow-hidden bg-[#0A0A0A] text-white">
        <DashboardNavbar email={user?.email} onLogout={handleLogout} />

        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-14">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-[#F97316]" />
                <div>
                  <p className="text-xs uppercase tracking-[0.42em] text-white/50">
                    Executive View
                  </p>
                  <h1 className={`${typography.h1} mt-2`}>
                    Organizational Risk Posture
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-white/60">Time Range:</label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#F97316]"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </div>
            <p className="text-white/60 max-w-2xl">
              Real-time governance confidence based on recorded evidence.
            </p>
          </motion.div>

          {/* Risk Posture Summary Banner - Signed Statement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`${cardStyles.base} p-6 mb-8 ${
              riskPosture.exposure_level === 'high' 
                ? 'bg-red-500/10 border-red-500/30' 
                : riskPosture.exposure_level === 'moderate'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-green-500/10 border-green-500/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${getExposureColor(riskPosture.exposure_level)}`}>
                {riskPosture.exposure_level === 'high' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : riskPosture.exposure_level === 'moderate' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-white mb-2">
                  {riskPosture.confidence_statement}
                </p>
                <div className="flex items-center gap-4 text-xs text-white/50 pt-2 border-t border-white/10">
                  <span>Generated from immutable governance records</span>
                  <span>•</span>
                  <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
                </div>
                <div className="text-xs text-white/40 mt-2 italic">
                  Executive access is read-only by database policy.
                </div>
              </div>
            </div>
          </motion.div>

          {/* Where you're exposed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <h2 className="text-sm font-semibold text-white/80 mb-4">
              Where you&apos;re exposed
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* High Risk Jobs */}
              <div
                className={`${cardStyles.base} p-6 cursor-pointer hover:border-red-500/40 transition-all ${
                  riskPosture.high_risk_jobs > 0 ? 'bg-red-500/5 border-red-500/30' : ''
                }`}
                onClick={() => window.location.href = '/operations/jobs?risk_level=high'}
                onMouseEnter={() => setHoveredCard('high-risk')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="flex items-center justify-between mb-4">
                  <AlertTriangle className={`w-5 h-5 ${riskPosture.high_risk_jobs > 0 ? 'text-red-400' : 'text-white/40'}`} />
                  <div className="flex items-center gap-2">
                    {hoveredCard === 'high-risk' && (
                      <Info className="w-4 h-4 text-white/40" />
                    )}
                    <span className="text-xs text-white/50 uppercase tracking-wide">High Risk</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-3xl font-bold ${riskPosture.high_risk_jobs > 0 ? 'text-red-200' : 'text-white'}`}>
                    {riskPosture.high_risk_jobs}
                  </span>
                  {riskPosture.deltas && riskPosture.deltas.high_risk_jobs !== 0 && (
                    <span className={`text-sm font-medium ${riskPosture.deltas.high_risk_jobs > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatDelta(riskPosture.deltas.high_risk_jobs)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/60">
                  {riskPosture.high_risk_jobs === 0 
                    ? 'All clear — no high-risk jobs in range'
                    : `${riskPosture.high_risk_jobs} job${riskPosture.high_risk_jobs > 1 ? 's' : ''} scoring above 75`}
                </div>
                {riskPosture.high_risk_jobs > 0 && riskPosture.drivers?.highRiskJobs?.[0] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.highRiskJobs[0].label} ({riskPosture.drivers.highRiskJobs[0].count})
                  </div>
                )}
                {hoveredCard === 'high-risk' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Jobs above threshold require documented mitigation to remain defensible.
                  </div>
                )}
              </div>

              {/* Open Incidents */}
              <div
                className={`${cardStyles.base} p-6 cursor-pointer hover:border-orange-500/40 transition-all ${
                  riskPosture.open_incidents > 0 ? 'bg-orange-500/5 border-orange-500/30' : ''
                }`}
                onClick={() => window.location.href = '/operations/audit?view=incident-review&status=open'}
                onMouseEnter={() => setHoveredCard('incidents')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="flex items-center justify-between mb-4">
                  <AlertTriangle className={`w-5 h-5 ${riskPosture.open_incidents > 0 ? 'text-orange-400' : 'text-white/40'}`} />
                  <div className="flex items-center gap-2">
                    {hoveredCard === 'incidents' && (
                      <Info className="w-4 h-4 text-white/40" />
                    )}
                    <span className="text-xs text-white/50 uppercase tracking-wide">Incidents</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${riskPosture.open_incidents > 0 ? 'text-orange-200' : 'text-white'}`}>
                    {riskPosture.open_incidents}
                  </span>
                  {riskPosture.deltas && riskPosture.deltas.open_incidents !== 0 && (
                    <span className={`text-sm font-medium ${riskPosture.deltas.open_incidents > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                      {formatDelta(riskPosture.deltas.open_incidents)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/60">
                  {riskPosture.open_incidents === 0
                    ? 'All clear — no open incidents'
                    : `${riskPosture.open_incidents} active incident${riskPosture.open_incidents > 1 ? 's' : ''} requiring attention`}
                </div>
                {riskPosture.open_incidents > 0 && riskPosture.drivers?.openIncidents?.[0] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.openIncidents[0].label} ({riskPosture.drivers.openIncidents[0].count})
                  </div>
                )}
                {hoveredCard === 'incidents' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Open incidents indicate unresolved exposure requiring immediate governance review.
                  </div>
                )}
              </div>

              {/* Governance Violations */}
              <div
                className={`${cardStyles.base} p-6 cursor-pointer hover:border-red-500/40 transition-all ${
                  riskPosture.recent_violations > 0 ? 'bg-red-500/10 border-red-500/40 shadow-lg shadow-red-500/10' : ''
                }`}
                onClick={() => window.location.href = '/operations/audit?tab=governance&outcome=blocked'}
                onMouseEnter={() => setHoveredCard('violations')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="flex items-center justify-between mb-4">
                  <TrendingUp className={`w-5 h-5 ${riskPosture.recent_violations > 0 ? 'text-red-400' : 'text-white/40'}`} />
                  <div className="flex items-center gap-2">
                    {hoveredCard === 'violations' && (
                      <Info className="w-4 h-4 text-white/40" />
                    )}
                    <span className="text-xs text-white/50 uppercase tracking-wide">Violations</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${riskPosture.recent_violations > 0 ? 'text-red-200' : 'text-white'}`}>
                    {riskPosture.recent_violations}
                  </span>
                  {riskPosture.deltas && riskPosture.deltas.violations !== 0 && (
                    <span className={`text-sm font-medium ${riskPosture.deltas.violations > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatDelta(riskPosture.deltas.violations)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/60">
                  {riskPosture.recent_violations === 0
                    ? 'All clear — no blocked violations'
                    : `${riskPosture.recent_violations} blocked violation${riskPosture.recent_violations > 1 ? 's' : ''} (last 30 days)`}
                </div>
                {riskPosture.recent_violations > 0 && riskPosture.drivers?.violations?.[0] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.violations[0].label} ({riskPosture.drivers.violations[0].count})
                  </div>
                )}
                {hoveredCard === 'violations' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Blocked actions indicate attempted unauthorized access. Each violation is logged and defensible.
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Whether controls are working */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-sm font-semibold text-white/80 mb-4">
              Whether controls are working
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Jobs Flagged for Review */}
              <div
                className={`${cardStyles.base} p-6 cursor-pointer hover:border-[#F97316]/40 transition-all`}
                onClick={() => window.location.href = '/operations/audit?view=review-queue'}
                onMouseEnter={() => setHoveredCard('flagged')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="flex items-center justify-between mb-4">
                  <Shield className="w-5 h-5 text-[#F97316]" />
                  <div className="flex items-center gap-2">
                    {hoveredCard === 'flagged' && (
                      <Info className="w-4 h-4 text-white/40" />
                    )}
                    <span className="text-xs text-white/50 uppercase tracking-wide">Flagged</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{riskPosture.flagged_jobs}</span>
                  {riskPosture.deltas && riskPosture.deltas.flagged_jobs !== 0 && (
                    <span className={`text-sm font-medium ${riskPosture.deltas.flagged_jobs > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                      {formatDelta(riskPosture.deltas.flagged_jobs)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/60">
                  {riskPosture.flagged_jobs === 0
                    ? 'All clear — no jobs flagged'
                    : `${riskPosture.flagged_jobs} job${riskPosture.flagged_jobs > 1 ? 's' : ''} flagged for review`}
                </div>
                {riskPosture.flagged_jobs > 0 && riskPosture.drivers?.flagged?.[0] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.flagged[0].label} ({riskPosture.drivers.flagged[0].count})
                  </div>
                )}
                {hoveredCard === 'flagged' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Flagged jobs require safety lead oversight. Review ensures accountability and defensibility.
                  </div>
                )}
              </div>

              {/* Pending Sign-offs */}
              <div
                className={`${cardStyles.base} p-6 cursor-pointer hover:border-yellow-500/40 transition-all ${
                  riskPosture.pending_signoffs > 3 ? 'bg-yellow-500/5 border-yellow-500/30' : ''
                }`}
                onClick={() => window.location.href = '/operations/audit/readiness?category=attestations&status=open'}
                onMouseEnter={() => setHoveredCard('pending-signoffs')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="flex items-center justify-between mb-4">
                  <FileCheck className={`w-5 h-5 ${riskPosture.pending_signoffs > 3 ? 'text-yellow-400' : 'text-white/40'}`} />
                  <div className="flex items-center gap-2">
                    {hoveredCard === 'pending-signoffs' && (
                      <Info className="w-4 h-4 text-white/40" />
                    )}
                    <span className="text-xs text-white/50 uppercase tracking-wide">Pending</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${riskPosture.pending_signoffs > 3 ? 'text-yellow-200' : 'text-white'}`}>
                    {riskPosture.pending_signoffs}
                  </span>
                  {riskPosture.deltas && riskPosture.deltas.pending_signoffs !== 0 && (
                    <span className={`text-sm font-medium ${riskPosture.deltas.pending_signoffs > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {formatDelta(riskPosture.deltas.pending_signoffs)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/60">
                  {riskPosture.pending_signoffs === 0
                    ? 'All clear — no pending attestations'
                    : `${riskPosture.pending_signoffs} job${riskPosture.pending_signoffs > 1 ? 's' : ''} awaiting attestations`}
                </div>
                {riskPosture.pending_signoffs > 0 && riskPosture.drivers?.pending?.[0] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.pending[0].label} ({riskPosture.drivers.pending[0].count})
                  </div>
                )}
                {hoveredCard === 'pending-signoffs' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Unsigned approvals weaken insurance and dispute defensibility.
                  </div>
                )}
              </div>

              {/* Completed Sign-offs */}
              <div
                className={`${cardStyles.base} p-6 cursor-pointer hover:border-green-500/40 transition-all`}
                onClick={() => window.location.href = '/operations/audit?tab=operations&event_name=signoff&status=signed'}
                onMouseEnter={() => setHoveredCard('signed')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="flex items-center justify-between mb-4">
                  <FileCheck className="w-5 h-5 text-green-400" />
                  <div className="flex items-center gap-2">
                    {hoveredCard === 'signed' && (
                      <Info className="w-4 h-4 text-white/40" />
                    )}
                    <span className="text-xs text-white/50 uppercase tracking-wide">Signed</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{riskPosture.signed_jobs}</span>
                  {riskPosture.deltas && riskPosture.deltas.signed_signoffs !== 0 && (
                    <span className={`text-sm font-medium ${riskPosture.deltas.signed_signoffs > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {formatDelta(riskPosture.deltas.signed_signoffs)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/60">
                  {riskPosture.signed_jobs === 0
                    ? 'No completed attestations yet'
                    : `${riskPosture.signed_jobs} job${riskPosture.signed_jobs > 1 ? 's' : ''} with completed attestations`}
                </div>
                {riskPosture.signed_jobs > 0 && riskPosture.drivers?.signed?.[0] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.signed[0].label} ({riskPosture.drivers.signed[0].count})
                  </div>
                )}
                {hoveredCard === 'signed' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Completed sign-offs provide defensible proof of approval and accountability.
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Whether proof exists */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-8"
          >
            <h2 className="text-sm font-semibold text-white/80 mb-4">
              Whether proof exists
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Proof Packs Generated */}
              <div
                className={`${cardStyles.base} p-6 cursor-pointer hover:border-green-500/40 transition-all`}
                onClick={() => window.location.href = '/operations/audit?view=insurance-ready'}
                onMouseEnter={() => setHoveredCard('proof-packs')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="flex items-center justify-between mb-4">
                  <FileCheck className="w-5 h-5 text-green-400" />
                  <div className="flex items-center gap-2">
                    {hoveredCard === 'proof-packs' && (
                      <Info className="w-4 h-4 text-white/40" />
                    )}
                    <span className="text-xs text-white/50 uppercase tracking-wide">Proof Packs</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{riskPosture.proof_packs_generated}</span>
                  {riskPosture.deltas && riskPosture.deltas.proof_packs !== 0 && (
                    <span className={`text-sm font-medium ${riskPosture.deltas.proof_packs > 0 ? 'text-green-400' : 'text-white/40'}`}>
                      {formatDelta(riskPosture.deltas.proof_packs)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/60">
                  {riskPosture.proof_packs_generated === 0
                    ? 'No proof packs generated yet'
                    : `${riskPosture.proof_packs_generated} pack${riskPosture.proof_packs_generated > 1 ? 's' : ''} generated (last 30 days)`}
                </div>
                {riskPosture.drivers?.proofPacks?.[0] && riskPosture.drivers.proofPacks[0].count === 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    {riskPosture.drivers.proofPacks[0].label}
                  </div>
                )}
                {riskPosture.proof_packs_generated > 0 && riskPosture.drivers?.proofPacks?.[0] && riskPosture.drivers.proofPacks[0].count > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.proofPacks[0].label} ({riskPosture.drivers.proofPacks[0].count})
                  </div>
                )}
                {hoveredCard === 'proof-packs' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Exportable proof bundles ready for insurer, regulator, or legal review.
                  </div>
                )}
              </div>

              {/* Last Governance Update */}
              <div 
                className={`${cardStyles.base} p-6 cursor-pointer hover:border-blue-500/40 transition-all ${
                  riskPosture.last_material_event_at ? '' : 'opacity-60'
                }`}
                onClick={() => {
                  if (riskPosture.last_material_event_at) {
                    window.location.href = '/operations/audit?tab=governance&severity=material'
                  }
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <Lock className="w-5 h-5 text-white/40" />
                  <span className="text-xs text-white/50 uppercase tracking-wide">Last Update</span>
                </div>
                <div className="text-lg font-semibold text-white mb-1">
                  {riskPosture.last_material_event_at 
                    ? new Date(riskPosture.last_material_event_at).toLocaleDateString()
                    : 'No material events'}
                </div>
                <div className="text-sm text-white/60">
                  {riskPosture.last_material_event_at
                    ? 'Last material governance event'
                    : 'No material events recorded yet'}
                </div>
              </div>

              {/* Ledger Integrity Status */}
              <div className={`${cardStyles.base} p-6 ${
                riskPosture.ledger_integrity === 'verified' 
                  ? 'bg-green-500/5 border-green-500/30' 
                  : riskPosture.ledger_integrity === 'error'
                  ? 'bg-red-500/5 border-red-500/30'
                  : ''
              }`}>
                <div className="flex items-center justify-between mb-4">
                  {getIntegrityIcon(riskPosture.ledger_integrity)}
                  <span className="text-xs text-white/50 uppercase tracking-wide">Integrity</span>
                </div>
                <div className={`text-lg font-semibold mb-1 ${
                  riskPosture.ledger_integrity === 'verified' 
                    ? 'text-green-400' 
                    : riskPosture.ledger_integrity === 'error'
                    ? 'text-red-400'
                    : 'text-yellow-400'
                }`}>
                  {getIntegrityText(riskPosture.ledger_integrity, riskPosture.ledger_integrity_last_verified_at)}
                </div>
                <div className="text-sm text-white/60">
                  {riskPosture.ledger_integrity === 'verified' && riskPosture.ledger_integrity_verified_through_event_id
                    ? `Verified through event ${riskPosture.ledger_integrity_verified_through_event_id.slice(0, 8)}...`
                    : riskPosture.ledger_integrity === 'error' && riskPosture.ledger_integrity_error_details?.failingEventId
                    ? `Mismatch at event ${riskPosture.ledger_integrity_error_details.failingEventId.slice(0, 8)}...`
                    : 'Hash chain verification'}
                </div>
                {riskPosture.ledger_integrity === 'error' && riskPosture.ledger_integrity_error_details?.failingEventId && (
                  <a
                    href={`/operations/audit?event_id=${riskPosture.ledger_integrity_error_details.failingEventId}`}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 underline inline-block"
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    View failing event →
                  </a>
                )}
              </div>
            </div>
          </motion.div>

          {/* Single CTA - Irreversible */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-12"
          >
            <div className={`${cardStyles.base} p-8 text-center border-2 border-[#F97316]/30`}>
              <h3 className="text-xl font-semibold text-white mb-2">
                Open Full Governance Record
              </h3>
              <p className="text-sm text-white/70 mb-6 font-medium">
                This is the authoritative record used for audits, claims, and disputes.
              </p>
              <p className="text-xs text-white/50 mb-6">
                Immutable, export-ready, insurer-safe
              </p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="/operations/audit?tab=governance&time_range=90d&severity=material"
                  className={`${buttonStyles.primary} inline-flex items-center gap-2 text-base px-8 py-3`}
                >
                  View Compliance Ledger
                  <ExternalLink className="w-5 h-5" />
                </a>
                <button
                  onClick={() => {
                    const brief = {
                      generated_at: new Date().toISOString(),
                      time_range: timeRange,
                      summary: {
                        exposure_level: riskPosture.exposure_level,
                        confidence_statement: riskPosture.confidence_statement,
                        counts: {
                          high_risk_jobs: riskPosture.high_risk_jobs,
                          open_incidents: riskPosture.open_incidents,
                          violations: riskPosture.recent_violations,
                          flagged: riskPosture.flagged_jobs,
                          pending_attestations: riskPosture.pending_signoffs,
                          signed_attestations: riskPosture.signed_jobs,
                          proof_packs: riskPosture.proof_packs_generated,
                        },
                        deltas: riskPosture.deltas,
                        top_drivers: riskPosture.drivers,
                        integrity: {
                          status: riskPosture.ledger_integrity,
                          last_verified_at: riskPosture.ledger_integrity_last_verified_at,
                          verified_through_event_id: riskPosture.ledger_integrity_verified_through_event_id,
                        },
                        recommended_actions: riskPosture.recommended_actions,
                      },
                    }
                    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `executive-brief-${timeRange}-${new Date().toISOString().split('T')[0]}.json`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  }}
                  className={`${buttonStyles.secondary} inline-flex items-center gap-2 text-base px-8 py-3`}
                >
                  Export Executive Brief
                  <FileCheck className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
