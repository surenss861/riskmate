'use client'

import { useState, useEffect } from 'react'
import { Shield, AlertTriangle, FileCheck, TrendingUp, Lock, CheckCircle, Info, ExternalLink } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { executiveApi } from '@/lib/api'
import { typography } from '@/lib/styles/design-system'
import { AppBackground, AppShell, PageSection, GlassCard, Button, Select, PageHeader, IntegrityBadge, PackCard, EnforcementBanner, Badge } from '@/components/shared'
import { PostureTilesSkeleton } from '@/components/executive/PostureTilesSkeleton'
import { terms } from '@/lib/terms'
import { defensibilityTerms } from '@/lib/copy/terms'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        ledger_integrity: 'not_verified',
        ledger_integrity_last_verified_at: null,
        ledger_integrity_verified_through_event_id: null,
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
        <AppBackground>
          <AppShell>
            <PageSection>
              <PageHeader
                title="Defensibility Posture"
                subtitle="Audit-ready proof from everyday field work. Immutable compliance ledger + evidence chain-of-custody."
              />
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="neutral">Ledger Contract v1.0 (Frozen)</Badge>
              </div>
            </PageSection>
            <PageSection>
              <h2 className="text-sm font-semibold text-white/80 mb-4">
                Defensibility Posture
              </h2>
              <PostureTilesSkeleton />
            </PageSection>
          </AppShell>
        </AppBackground>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppBackground>
        <DashboardNavbar email={user?.email} onLogout={handleLogout} />
        <AppShell>
            <PageSection>
              <div className="flex items-start justify-between mb-4 gap-4">
                <div className="flex-1">
                  <PageHeader
                    title="Defensibility Posture"
                    subtitle="Audit-ready proof from everyday field work. Immutable compliance ledger + evidence chain-of-custody."
                  />
                  {/* Ledger Contract Badge */}
                  <div className="mt-3">
                    <Badge variant="neutral" className="text-xs">
                      Ledger Contract v1.0 (Frozen)
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* IntegrityBadge - Top-right of header */}
                  <IntegrityBadge 
                    status={
                      riskPosture.ledger_integrity === 'verified' ? 'verified' :
                      riskPosture.ledger_integrity === 'error' ? 'mismatch' :
                      'unverified'
                    }
                    verifiedThrough={riskPosture.ledger_integrity_verified_through_event_id || undefined}
                    lastVerified={riskPosture.ledger_integrity_last_verified_at || undefined}
                    errorDetails={riskPosture.ledger_integrity_error_details ? {
                      failingEventId: riskPosture.ledger_integrity_error_details.failingEventId,
                      expectedHash: riskPosture.ledger_integrity_error_details.expectedHash,
                      gotHash: riskPosture.ledger_integrity_error_details.gotHash,
                    } : undefined}
                    showDetails
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-white/60">Time Range:</label>
                    <Select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                    >
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="all">All time</option>
                    </Select>
                  </div>
                </div>
              </div>
            </PageSection>

            {/* Risk Posture Summary Banner - Signed Statement */}
            <PageSection>
              <GlassCard className={`p-6 ${
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
              </GlassCard>
            </PageSection>

            {/* Exposure Assessment */}
            <PageSection>
              <h2 className="text-sm font-semibold text-white/80 mb-4">
                Exposure Assessment
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* High Risk Jobs */}
                <div
                  onMouseEnter={() => setHoveredCard('high-risk')}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                <GlassCard
                  className={`p-6 cursor-pointer hover:border-red-500/40 transition-all ${
                    riskPosture.high_risk_jobs > 0 ? 'bg-red-500/5 border-red-500/30' : ''
                  }`}
                  onClick={() => window.location.href = '/operations/jobs?risk_level=high'}
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
                    ? `All clear — no high-exposure ${terms.workRecord.plural.toLowerCase()} in range`
                    : `${riskPosture.high_risk_jobs} ${terms.workRecord.plural.toLowerCase()} scoring above 75`}
                </div>
                {riskPosture.high_risk_jobs > 0 && riskPosture.drivers?.highRiskJobs?.[0] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.highRiskJobs[0].label} ({riskPosture.drivers.highRiskJobs[0].count})
                  </div>
                )}
                {hoveredCard === 'high-risk' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    {terms.workRecord.plural} above threshold require documented {terms.control.plural.toLowerCase()} to remain defensible.
                  </div>
                )}
              </GlassCard>
              </div>

              {/* Open Incidents */}
              <div
                onMouseEnter={() => setHoveredCard('incidents')}
                onMouseLeave={() => setHoveredCard(null)}
              >
              <GlassCard
                className={`p-6 cursor-pointer hover:border-orange-500/40 transition-all ${
                  riskPosture.open_incidents > 0 ? 'bg-orange-500/5 border-orange-500/30' : ''
                }`}
                onClick={() => window.location.href = '/operations/audit?view=incident-review&status=open'}
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
              </GlassCard>
              </div>

              {/* Governance Violations */}
              <div
                onMouseEnter={() => setHoveredCard('violations')}
                onMouseLeave={() => setHoveredCard(null)}
              >
              <GlassCard
                className={`p-6 cursor-pointer hover:border-red-500/40 transition-all ${
                  riskPosture.recent_violations > 0 ? 'bg-red-500/10 border-red-500/40 shadow-lg shadow-red-500/10' : ''
                }`}
                onClick={() => window.location.href = '/operations/audit?tab=governance&outcome=blocked'}
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
              </GlassCard>
              </div>
              </div>
          </PageSection>

          {/* Controls Status */}
          <PageSection>
            <h2 className="text-sm font-semibold text-white/80 mb-4">
              Controls Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Jobs Flagged for Review */}
              <div
                onMouseEnter={() => setHoveredCard('flagged')}
                onMouseLeave={() => setHoveredCard(null)}
              >
              <GlassCard
                className="p-6 cursor-pointer hover:border-[#F97316]/40 transition-all"
                onClick={() => window.location.href = '/operations/audit?view=review-queue'}
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
                    ? `All clear — no ${terms.workRecord.plural.toLowerCase()} flagged`
                    : `${riskPosture.flagged_jobs} ${terms.workRecord.plural.toLowerCase()} flagged for review`}
                </div>
                {riskPosture.flagged_jobs > 0 && riskPosture.drivers?.flagged?.[0] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.flagged[0].label} ({riskPosture.drivers.flagged[0].count})
                  </div>
                )}
                {hoveredCard === 'flagged' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Flagged {terms.workRecord.plural.toLowerCase()} require safety lead oversight. Review ensures accountability and defensibility.
                  </div>
                )}
              </GlassCard>
              </div>

              {/* Pending Attestations */}
              <div
                onMouseEnter={() => setHoveredCard('pending-signoffs')}
                onMouseLeave={() => setHoveredCard(null)}
              >
              <GlassCard
                className={`p-6 cursor-pointer hover:border-yellow-500/40 transition-all ${
                  riskPosture.pending_signoffs > 3 ? 'bg-yellow-500/5 border-yellow-500/30' : ''
                }`}
                onClick={() => window.location.href = '/operations/audit/readiness?category=attestations&status=open'}
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
                    ? `All clear — no pending ${terms.attestation.plural.toLowerCase()}`
                    : `${riskPosture.pending_signoffs} ${terms.workRecord.plural.toLowerCase()} awaiting ${terms.attestation.plural.toLowerCase()}`}
                </div>
                {riskPosture.pending_signoffs > 0 && riskPosture.drivers?.pending?.[0] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.pending[0].label} ({riskPosture.drivers.pending[0].count})
                  </div>
                )}
                {hoveredCard === 'pending-signoffs' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Pending {terms.attestation.plural.toLowerCase()} require safety lead review to seal the record.
                  </div>
                )}
              </GlassCard>
              </div>

              {/* Completed Attestations */}
              <div
                onMouseEnter={() => setHoveredCard('signed')}
                onMouseLeave={() => setHoveredCard(null)}
              >
              <GlassCard
                className="p-6 cursor-pointer hover:border-green-500/40 transition-all"
                onClick={() => window.location.href = '/operations/audit?tab=operations&event_name=signoff&status=signed'}
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
                    ? `No sealed ${terms.attestation.plural.toLowerCase()} yet`
                    : `${riskPosture.signed_jobs} ${terms.workRecord.plural.toLowerCase()} with sealed ${terms.attestation.plural.toLowerCase()}`}
                </div>
                {riskPosture.signed_jobs > 0 && riskPosture.drivers?.signed?.[0] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50">
                    Top driver: {riskPosture.drivers.signed[0].label} ({riskPosture.drivers.signed[0].count})
                  </div>
                )}
                {hoveredCard === 'signed' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Sealed records provide defensible proof of approval and accountability.
                  </div>
                )}
              </GlassCard>
              </div>
            </div>
          </PageSection>

          {/* Defensibility Posture */}
          <PageSection>
            <h2 className="text-sm font-semibold text-white/80 mb-4">
              Defensibility Posture
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Ledger Integrity */}
              <GlassCard className={`p-6 ${
                riskPosture.ledger_integrity === 'verified' 
                  ? 'bg-green-500/5 border-green-500/30' 
                  : riskPosture.ledger_integrity === 'error'
                  ? 'bg-red-500/5 border-red-500/30'
                  : 'bg-yellow-500/5 border-yellow-500/30'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <Shield className={`w-5 h-5 ${
                    riskPosture.ledger_integrity === 'verified' 
                      ? 'text-green-400' 
                      : riskPosture.ledger_integrity === 'error'
                      ? 'text-red-400'
                      : 'text-yellow-400'
                  }`} />
                  <IntegrityBadge 
                    status={
                      riskPosture.ledger_integrity === 'verified' ? 'verified' :
                      riskPosture.ledger_integrity === 'error' ? 'mismatch' :
                      'unverified'
                    }
                    verifiedThrough={riskPosture.ledger_integrity_verified_through_event_id || undefined}
                    lastVerified={riskPosture.ledger_integrity_last_verified_at || undefined}
                    errorDetails={riskPosture.ledger_integrity_error_details ? {
                      failingEventId: riskPosture.ledger_integrity_error_details.failingEventId,
                      expectedHash: riskPosture.ledger_integrity_error_details.expectedHash,
                      gotHash: riskPosture.ledger_integrity_error_details.gotHash,
                    } : undefined}
                    showDetails
                  />
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wide mb-2">Ledger Integrity</div>
                <div className={`text-lg font-semibold mb-1 truncate min-w-0 ${
                  riskPosture.ledger_integrity === 'verified' 
                    ? 'text-green-400' 
                    : riskPosture.ledger_integrity === 'error'
                    ? 'text-red-400'
                    : 'text-yellow-400'
                }`}>
                  {getIntegrityText(riskPosture.ledger_integrity, riskPosture.ledger_integrity_last_verified_at)}
                </div>
                <div className="text-xs text-white/60 break-words min-w-0">
                  {riskPosture.ledger_integrity === 'verified' && riskPosture.ledger_integrity_verified_through_event_id
                    ? `Verified through event ${riskPosture.ledger_integrity_verified_through_event_id.slice(0, 8)}...`
                    : riskPosture.ledger_integrity === 'error' && riskPosture.ledger_integrity_error_details?.failingEventId
                    ? `Mismatch at event ${riskPosture.ledger_integrity_error_details.failingEventId.slice(0, 8)}...`
                    : 'Hash chain verification pending'}
                </div>
                {riskPosture.ledger_integrity === 'error' && riskPosture.ledger_integrity_error_details?.failingEventId && (
                  <a
                    href={`/operations/audit?event_id=${riskPosture.ledger_integrity_error_details.failingEventId}`}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 underline truncate block min-w-0"
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    View failing event →
                  </a>
                )}
              </GlassCard>

              {/* Proof Packs Generated */}
              <div
                onMouseEnter={() => setHoveredCard('proof-packs')}
                onMouseLeave={() => setHoveredCard(null)}
              >
              <GlassCard
                className="p-6 cursor-pointer hover:border-green-500/40 transition-all"
                onClick={() => window.location.href = '/operations/audit?view=insurance-ready'}
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
                <div className="text-xs text-white/50 uppercase tracking-wide mb-2">Generated</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-white">{riskPosture.proof_packs_generated}</span>
                  {riskPosture.deltas && riskPosture.deltas.proof_packs !== 0 && (
                    <span className={`text-sm font-medium ${riskPosture.deltas.proof_packs > 0 ? 'text-green-400' : 'text-white/40'}`}>
                      {formatDelta(riskPosture.deltas.proof_packs)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/60 mb-3">
                  {riskPosture.proof_packs_generated === 0
                    ? 'No proof packs generated yet. Use Pack History to generate one.'
                    : `${riskPosture.proof_packs_generated} pack${riskPosture.proof_packs_generated > 1 ? 's' : ''} generated (last 30 days)`}
                </div>
                {/* Pack preview (if available) - stub for now, will show when pack history API is ready */}
                {riskPosture.proof_packs_generated > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/50 min-w-0">
                    <a 
                      href="/operations/audit?view=insurance-ready" 
                      className="text-green-400 hover:text-green-300 underline truncate block min-w-0"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      View in Pack History →
                    </a>
                  </div>
                )}
                {hoveredCard === 'proof-packs' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Exportable proof bundles ready for insurer, regulator, or legal review. Each pack includes verification hash.
                  </div>
                )}
              </GlassCard>
              </div>

              {/* Enforcement Actions */}
              <div
                onMouseEnter={() => setHoveredCard('enforcement')}
                onMouseLeave={() => setHoveredCard(null)}
              >
              <GlassCard
                className={`p-6 cursor-pointer hover:border-red-500/40 transition-all ${
                  riskPosture.recent_violations > 0 ? 'bg-red-500/10 border-red-500/40 shadow-lg shadow-red-500/10' : ''
                }`}
                onClick={() => window.location.href = '/operations/audit?tab=governance&outcome=blocked'}
              >
                <div className="flex items-center justify-between mb-4">
                  <Shield className={`w-5 h-5 ${riskPosture.recent_violations > 0 ? 'text-red-400' : 'text-white/40'}`} />
                  <div className="flex items-center gap-2">
                    {hoveredCard === 'enforcement' && (
                      <Info className="w-4 h-4 text-white/40" />
                    )}
                    <span className="text-xs text-white/50 uppercase tracking-wide">Enforcement</span>
                  </div>
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wide mb-2">Actions</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={`text-3xl font-bold ${riskPosture.recent_violations > 0 ? 'text-red-200' : 'text-white'}`}>
                  {riskPosture.recent_violations}
                  </span>
                  <span className="text-xs text-white/50">blocked</span>
                  {riskPosture.deltas && riskPosture.deltas.violations !== 0 && (
                    <span className={`text-sm font-medium ${riskPosture.deltas.violations > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatDelta(riskPosture.deltas.violations)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/60 mb-3">
                  {riskPosture.recent_violations === 0
                    ? 'All actions allowed — no blocked attempts'
                    : `${riskPosture.recent_violations} blocked attempt${riskPosture.recent_violations > 1 ? 's' : ''} (last 30 days)`}
                </div>
                {riskPosture.recent_violations > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/60">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-red-400" />
                      <span>Recent blocked attempts logged in {terms.complianceLedger.short}</span>
                    </div>
                    {/* TODO: Show EnforcementBanner with real blocked event when data is available */}
                  </div>
                )}
                {hoveredCard === 'enforcement' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Blocked actions prove governance enforcement. Each violation is logged and defensible.
                  </div>
                )}
              </GlassCard>
              </div>

              {/* Attestations Coverage */}
              <GlassCard className="p-6 cursor-pointer hover:border-blue-500/40 transition-all"
                onClick={() => window.location.href = '/operations/audit?view=review-queue'}
              >
                <div className="flex items-center justify-between mb-4">
                  <FileCheck className="w-5 h-5 text-blue-400" />
                  <span className="text-xs text-white/50 uppercase tracking-wide">Attestations</span>
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wide mb-2">Coverage</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-bold text-white">{riskPosture.signed_jobs}</span>
                  <span className="text-xs text-white/50">sealed</span>
                  <span className="text-xs text-white/40">/</span>
                  <span className="text-2xl font-bold text-white">{riskPosture.pending_signoffs + riskPosture.signed_jobs}</span>
                  <span className="text-xs text-white/50">total</span>
                </div>
                <div className="text-xs text-white/60 mb-2">
                  {riskPosture.pending_signoffs > 0
                    ? `${riskPosture.pending_signoffs} pending seal${riskPosture.pending_signoffs > 1 ? 's' : ''}`
                    : 'All records sealed'}
                </div>
                {riskPosture.deltas && (riskPosture.deltas.signed_signoffs !== 0 || riskPosture.deltas.pending_signoffs !== 0) && (
                  <div className="text-xs text-white/50">
                    {riskPosture.deltas.signed_signoffs > 0 && (
                      <span className="text-green-400">+{riskPosture.deltas.signed_signoffs} sealed</span>
                    )}
                    {riskPosture.deltas.pending_signoffs > 0 && (
                      <span className="text-yellow-400"> +{riskPosture.deltas.pending_signoffs} pending</span>
                    )}
                  </div>
                )}
                {hoveredCard === 'attestations' && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70">
                    Sealed records provide defensible proof of approval and accountability.
                  </div>
                )}
              </GlassCard>
            </div>
          </PageSection>

          {/* Single CTA - Irreversible */}
          <PageSection>
            <GlassCard className="p-8 text-center border-2 border-[#F97316]/30">
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
              <Button
                variant="primary"
                size="lg"
                onClick={() => window.location.href = '/operations/audit?tab=governance&time_range=90d&severity=material'}
                className="inline-flex items-center gap-2"
              >
                View Compliance Ledger
                <ExternalLink className="w-5 h-5" />
              </Button>
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={async () => {
                      try {
                        const supabase = createSupabaseBrowserClient()
                        const { data: { session } } = await supabase.auth.getSession()
                        
                        // Add cache-buster query param to prevent service worker caching
                        const cacheBuster = `?t=${Date.now()}`
                        const response = await fetch(`/api/executive/brief/pdf${cacheBuster}`, {
                          method: 'POST',
                          cache: 'no-store',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
                          },
                          body: JSON.stringify({ time_range: timeRange }),
                        })
                        
                        if (!response.ok) {
                          throw new Error('Failed to generate PDF')
                        }

                        const blob = await response.blob()
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        const hash = response.headers.get('X-PDF-Hash') || ''
                        a.download = `executive-brief-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                      } catch (err) {
                        console.error('PDF export failed:', err)
                        alert('Failed to generate PDF. Please try again.')
                      }
                    }}
                className="inline-flex items-center gap-2"
                  >
                    Export PDF Brief
                    <FileCheck className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
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
                    title="API payload: For integrations and verification. Humans should use PDF/CSV."
                    className="inline-flex items-center gap-2"
                  >
                    API payload
                  </Button>
                </div>
              </div>
          </GlassCard>
          </PageSection>
        </AppShell>
      </AppBackground>
    </ProtectedRoute>
  )
}

