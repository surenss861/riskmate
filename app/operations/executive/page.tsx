'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle, FileCheck, TrendingUp, Lock } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { jobsApi } from '@/lib/api'
import { cardStyles, typography, spacing } from '@/lib/styles/design-system'

interface ExecutiveSnapshot {
  flaggedJobs: number
  highRiskJobs: number
  openIncidents: number
  signedJobs: number
  unsignedJobs: number
  recentViolations: number
}

export default function ExecutiveSnapshotPage() {
  const [loading, setLoading] = useState(true)
  const [snapshot, setSnapshot] = useState<ExecutiveSnapshot>({
    flaggedJobs: 0,
    highRiskJobs: 0,
    openIncidents: 0,
    signedJobs: 0,
    unsignedJobs: 0,
    recentViolations: 0,
  })
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    loadSnapshot()
  }, [])

  const loadSnapshot = async () => {
    try {
      setLoading(true)
      const supabase = createSupabaseBrowserClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      if (!authUser) return

      // Get organization
      const { data: userRow } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('id', authUser.id)
        .single()

      if (!userRow?.organization_id) return

      // Verify executive role (read-only access)
      if (userRow.role !== 'executive' && userRow.role !== 'owner' && userRow.role !== 'admin') {
        // Redirect non-executives
        window.location.href = '/operations'
        return
      }

      const orgId = userRow.organization_id

      // Load all jobs for snapshot
      const jobsResponse = await jobsApi.list({ limit: 1000 })
      const jobs = jobsResponse?.data || []

      // Count flagged jobs
      const flaggedJobs = jobs.filter((j: any) => j.review_flag === true).length

      // Count high-risk jobs (risk_score > 75)
      const highRiskJobs = jobs.filter((j: any) => j.risk_score !== null && j.risk_score > 75).length

      // Count open incidents (jobs with status 'incident' or flagged with high risk)
      const openIncidents = jobs.filter(
        (j: any) => j.status === 'incident' || (j.review_flag === true && j.risk_score !== null && j.risk_score > 75)
      ).length

      // Load sign-offs to count signed vs unsigned
      const { data: signoffs } = await supabase
        .from('job_signoffs')
        .select('job_id, status')
        .in('job_id', jobs.map((j: any) => j.id))

      const signedJobIds = new Set(
        signoffs?.filter((s) => s.status === 'signed').map((s) => s.job_id) || []
      )
      const signedJobs = signedJobIds.size
      const unsignedJobs = jobs.length - signedJobs

      // Count recent violations (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { count: violationsCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('event_type', 'auth.role_violation')
        .gte('created_at', thirtyDaysAgo.toISOString())

      setSnapshot({
        flaggedJobs,
        highRiskJobs,
        openIncidents,
        signedJobs,
        unsignedJobs,
        recentViolations: violationsCount || 0,
      })

      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load executive snapshot:', err)
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60">Loading executive snapshot...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen overflow-hidden bg-[#0A0A0A] text-white">
        {/* Ambient Gradient Backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.05),_transparent_55%)]" />
        </div>

        <DashboardNavbar email={user?.email} onLogout={handleLogout} />

        {/* Executive Snapshot Content */}
        <div className="relative mx-auto max-w-7xl px-6 py-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-[#F97316]" />
              <div>
                <p className="text-xs uppercase tracking-[0.42em] text-white/50">
                  Executive View
                </p>
                <h1 className={`${typography.h1} mt-2`}>
                  Risk Governance Snapshot
                </h1>
              </div>
            </div>
            <p className="text-white/60 max-w-2xl">
              Read-only oversight view. All actions are logged and immutable.
            </p>
          </motion.div>

          {/* Snapshot Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Flagged Jobs */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`${cardStyles.base} p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <Shield className="w-5 h-5 text-[#F97316]" />
                <span className="text-xs text-white/50 uppercase tracking-wide">Flagged</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{snapshot.flaggedJobs}</div>
              <div className="text-sm text-white/60">Jobs flagged for review</div>
            </motion.div>

            {/* High-Risk Jobs */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={`${cardStyles.base} p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="text-xs text-white/50 uppercase tracking-wide">High Risk</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{snapshot.highRiskJobs}</div>
              <div className="text-sm text-white/60">Jobs scoring above 75</div>
            </motion.div>

            {/* Open Incidents */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`${cardStyles.base} p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                <span className="text-xs text-white/50 uppercase tracking-wide">Incidents</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{snapshot.openIncidents}</div>
              <div className="text-sm text-white/60">Active incidents requiring attention</div>
            </motion.div>

            {/* Signed Jobs */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`${cardStyles.base} p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <FileCheck className="w-5 h-5 text-green-400" />
                <span className="text-xs text-white/50 uppercase tracking-wide">Signed</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{snapshot.signedJobs}</div>
              <div className="text-sm text-white/60">Jobs with completed sign-offs</div>
            </motion.div>

            {/* Unsigned Jobs */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`${cardStyles.base} p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <FileCheck className="w-5 h-5 text-yellow-400" />
                <span className="text-xs text-white/50 uppercase tracking-wide">Pending</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{snapshot.unsignedJobs}</div>
              <div className="text-sm text-white/60">Jobs awaiting sign-offs</div>
            </motion.div>

            {/* Recent Violations */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className={`${cardStyles.base} p-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-5 h-5 text-red-400" />
                <span className="text-xs text-white/50 uppercase tracking-wide">Violations</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{snapshot.recentViolations}</div>
              <div className="text-sm text-white/60">Role violations (last 30 days)</div>
            </motion.div>
          </div>

          {/* Footer Note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={`${cardStyles.base} p-6 text-center`}
          >
            <p className="text-sm text-white/60">
              This view is read-only. All data is timestamped and audit-logged. For detailed analysis, contact your Safety Lead or Operations Manager.
              <div className="mt-4">
                <a
                  href="/operations/audit?view=review-queue&severity=material"
                  className="text-sm text-[#F97316] hover:text-[#FB923C] underline"
                >
                  View complete evidence in Compliance Ledger →
                </a>
              </div>
            </p>
          </motion.div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

