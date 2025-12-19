'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DemoProvider, useDemo } from '@/lib/demo/useDemo'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { DemoBanner } from '@/components/demo/DemoBanner'
import { RoleSwitcher } from '@/components/demo/RoleSwitcher'
import { GuidedTour } from '@/components/demo/GuidedTour'
import { cardStyles, typography, spacing } from '@/lib/styles/design-system'
import { Users, FileText, Settings, AlertTriangle, Play } from 'lucide-react'
import type { DemoRole, DemoScenario, OperationType } from '@/lib/demo/demoData'
import { operationPresets } from '@/lib/demo/demoData'

interface TourStep {
  id: string
  title: string
  description: string
  target: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const getTourSteps = (role: DemoRole): TourStep[] => {
  const baseSteps: TourStep[] = [
    {
      id: 'role-switcher',
      title: 'Why unauthorized actions are impossible',
      description: 'Watch capabilities change instantly. Try switching to "Member" and notice which actions disappear. This is server-enforced, not UI hiding.',
      target: '[data-tour="role-switcher"]',
      position: 'bottom',
    },
    {
      id: 'flagged-job',
      title: 'Governance signals, not workflow noise',
      description: 'Safety Leads and Executives see all flagged jobs automatically. This creates institutional memory without blocking work.',
      target: '[data-tour="flagged-job"]',
      position: 'right',
    },
  ]

  // Role-specific steps
  if (role === 'executive') {
    return [
      ...baseSteps,
      {
        id: 'audit-logs',
        title: 'This is what protects you during inspections',
        description: 'Every action is logged, including capability violations. See auth.role_violation events proving enforcement is active, not theoretical.',
        target: '[data-tour="audit-logs"]',
        position: 'top',
      },
      {
        id: 'flagged-job',
      title: 'Risk visibility without interference',
      description: 'You see all flagged jobs automatically. This is read-only oversight — you observe risk, you don&apos;t edit history.',
        target: '[data-tour="flagged-job"]',
        position: 'right',
      },
    ]
  }

  if (role === 'owner') {
    return [
      ...baseSteps,
      {
        id: 'billing',
        title: 'Billing is external by design',
        description: 'Operational data stays tamper-proof. Stripe manages billing; RiskMate governs operations. This separation protects you.',
        target: '[data-tour="billing"]',
        position: 'top',
      },
      {
        id: 'security',
        title: 'Access changes are auditable',
        description: 'Password changes, logins, and session management are all tracked. This is what insurers and auditors want to see.',
        target: '[data-tour="security"]',
        position: 'top',
      },
    ]
  }

  if (role === 'safety_lead') {
    return [
      ...baseSteps,
      {
        id: 'flagged-job',
        title: 'You own operational risk',
        description: 'You see all flagged jobs automatically. This is your escalation surface — risk signals come to you, not scattered across tools.',
        target: '[data-tour="flagged-job"]',
        position: 'right',
      },
      {
        id: 'audit-logs',
      title: 'Every escalation is provable',
      description: 'When you flag a job, it&apos;s logged. When someone tries to flag without permission, that&apos;s logged too. This is audit-ready.',
        target: '[data-tour="audit-logs"]',
        position: 'top',
      },
    ]
  }

  // Default steps for member/admin
  return [
    ...baseSteps,
    {
      id: 'audit-logs',
      title: 'This is what protects you during inspections',
      description: 'Every action is logged, including capability violations. See auth.role_violation events proving enforcement is active, not theoretical.',
      target: '[data-tour="audit-logs"]',
      position: 'top',
    },
    {
      id: 'billing',
      title: 'Billing is external by design',
      description: 'Operational data stays tamper-proof. Stripe manages billing; RiskMate governs operations. This separation protects you.',
      target: '[data-tour="billing"]',
      position: 'top',
    },
    {
      id: 'security',
      title: 'Access changes are auditable',
      description: 'Password changes, logins, and session management are all tracked. This is what insurers and auditors want to see.',
      target: '[data-tour="security"]',
      position: 'top',
    },
  ]
}

function DemoContent() {
  const searchParams = useSearchParams()
  const { data, currentRole, currentScenario, showDemoMessage, setCurrentRole, setCurrentScenario } = useDemo()
  const [activeSection, setActiveSection] = useState<'jobs' | 'team' | 'account'>('jobs')
  const [tourStep, setTourStep] = useState<number | null>(null)
  const [localJobs, setLocalJobs] = useState(data.jobs)
  const [showConversionCard, setShowConversionCard] = useState(false)
  
  const tourSteps = getTourSteps(currentRole)
  
  // Update local jobs when scenario changes
  useEffect(() => {
    setLocalJobs(data.jobs)
  }, [data.jobs])

  // Start tour if ?tour=1 in URL, with graceful fallback
  useEffect(() => {
    if (searchParams?.get('tour') === '1') {
      // Check if tour targets exist before starting
      const firstStep = tourSteps[0]
      if (firstStep && document.querySelector(firstStep.target)) {
        setTourStep(0)
      } else {
        // Skip tour if targets don't exist (graceful degradation)
        console.warn('Tour targets not found, skipping tour')
      }
    }
  }, [searchParams, tourSteps])

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <DemoBanner />
      <DashboardNavbar />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header with Enhanced Copy */}
        <div className="mb-8">
          <div className="mb-6">
            <h1 className={`${typography.h1} mb-3`}>RiskMate Interactive Demo</h1>
            <p className="text-white text-lg mb-2">
              See how real risk governance actually works — live, role by role
            </p>
            <p className="text-white/60 text-sm mb-1">
              Explore live risk scoring, role-based enforcement, and audit trails — no login, no backend, no data saved.
            </p>
            {searchParams?.get('operation') && operationPresets[searchParams.get('operation') as OperationType] && (
              <div className="mt-3 p-3 bg-[#F97316]/10 border border-[#F97316]/30 rounded-lg">
                <p className="text-sm text-[#F97316] font-medium">
                  Viewing as: {operationPresets[searchParams.get('operation') as OperationType].label}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {operationPresets[searchParams.get('operation') as OperationType].message}
                </p>
              </div>
            )}
            <p className="text-white/40 text-xs italic mt-2">
              This demo mirrors production behavior, permissions, and audit logic. Only persistence is disabled.
            </p>
          </div>

          {/* Choose Your Operation Type Entry Card */}
          {!searchParams?.get('role') && !searchParams?.get('dismissed') && (
            <div className="mb-6 p-6 bg-white/5 border border-white/10 rounded-lg">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white mb-1">What do you run?</h3>
                  <p className="text-sm text-white/60">Choose your operation type to see RiskMate configured for your needs</p>
                </div>
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams?.toString() || '')
                    params.set('dismissed', 'true')
                    window.history.replaceState({}, '', `?${params.toString()}`)
                  }}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(operationPresets).map((preset) => (
                  <button
                    key={preset.type}
                    onClick={() => {
                      setCurrentRole(preset.role)
                      setCurrentScenario(preset.scenario)
                      setTourStep(0)
                      const params = new URLSearchParams(searchParams?.toString() || '')
                      params.set('role', preset.role)
                      params.set('scenario', preset.scenario)
                      params.set('operation', preset.type)
                      params.delete('dismissed')
                      window.history.replaceState({}, '', `?${params.toString()}`)
                    }}
                    className="px-4 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors group"
                  >
                    <div className="font-medium text-white mb-1 group-hover:text-[#F97316] transition-colors">
                      {preset.label}
                    </div>
                    <div className="text-xs text-white/60 mb-2">{preset.description}</div>
                    <div className="text-xs text-white/40 italic border-t border-white/10 pt-2 mt-2">
                      {preset.message}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Demo Command Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setTourStep(0)}
              className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Guided Tour
            </button>
            <div data-tour="role-switcher">
              <RoleSwitcher />
            </div>
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams?.toString() || '')
                params.set('role', currentRole)
                params.set('scenario', currentScenario)
                const url = `${window.location.origin}/demo?${params.toString()}`
                navigator.clipboard.writeText(url)
                showDemoMessage('Demo link copied to clipboard')
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm transition-colors"
            >
              Share Scenario
            </button>
          </div>
        </div>

        <GuidedTour
          step={tourStep}
          steps={tourSteps}
          onClose={() => {
            setTourStep(null)
            // Show conversion card after tour completion
            if (tourStep === tourSteps.length - 1) {
              setShowConversionCard(true)
            }
          }}
          onNext={() => {
            const nextStep = tourStep !== null ? tourStep + 1 : 0
            setTourStep(nextStep)
            // Show conversion card after last step
            if (nextStep >= tourSteps.length) {
              setTourStep(null)
              setShowConversionCard(true)
            }
          }}
          onPrevious={() => setTourStep(tourStep !== null ? Math.max(0, tourStep - 1) : 0)}
        />

        {/* Post-Tour Conversion Card */}
        {showConversionCard && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur">
            <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0B0C14] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
              <button
                onClick={() => setShowConversionCard(false)}
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              >
                ✕
              </button>
              <h2 className="text-2xl font-semibold text-white mb-4">
                You&apos;ve just seen RiskMate enforce risk — not just track it
              </h2>
              <div className="space-y-4 text-sm text-white/80 mb-6">
                <p>
                  What you experienced isn&apos;t a walkthrough — it&apos;s the actual governance model in action.
                </p>
                <ul className="space-y-2 list-disc list-inside">
                  <li>Roles weren&apos;t cosmetic — permissions were enforced</li>
                  <li>Flagged jobs triggered visibility, not workflow noise</li>
                  <li>Every action created an audit trail, including violations</li>
                  <li>Billing, access, and security were intentionally separated</li>
                </ul>
                <p className="text-white/90 font-medium">
                  That&apos;s how RiskMate protects teams during audits, incidents, and insurance reviews.
                </p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-white/70 mb-4">
                  Continue in your own workspace. Get started with demo data or connect your organization.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="/signup"
                    className="px-6 py-3 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg text-sm font-medium transition-colors text-center"
                  >
                    Create Account
                  </a>
                  <a
                    href="/login"
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm transition-colors text-center"
                  >
                    Sign In
                  </a>
                </div>
              </div>
              <p className="text-xs text-white/40 text-center">
                Designed for construction, trades, and regulated operations where liability is real.
              </p>
            </div>
          </div>
        )}

        {/* Section Navigation */}
        <div className="flex gap-4 mb-8 border-b border-white/10">
          <button
            onClick={() => setActiveSection('jobs')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeSection === 'jobs'
                ? 'border-[#F97316] text-[#F97316]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Job Roster
          </button>
          <button
            onClick={() => setActiveSection('team')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeSection === 'team'
                ? 'border-[#F97316] text-[#F97316]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Access & Accountability
          </button>
          <button
            onClick={() => setActiveSection('account')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeSection === 'account'
                ? 'border-[#F97316] text-[#F97316]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Account Settings
          </button>
        </div>

        {/* Jobs Section */}
        {activeSection === 'jobs' && (
          <div className="space-y-6">
            {/* Scenario Proof Cards */}
            {currentScenario === 'incident' && (
              <div className={cardStyles.base}>
                <h3 className="font-semibold text-yellow-200 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Escalation Trail
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span>Job flagged for review by Safety Lead</span>
                    <span className="text-white/40">(2025-01-12 10:00 AM)</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    <span>High risk score detected (87)</span>
                    <span className="text-white/40">(2025-01-10 08:00 AM)</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Mitigation checklist generated</span>
                    <span className="text-white/40">(2025-01-10 08:15 AM)</span>
                  </div>
                </div>
              </div>
            )}

            {currentScenario === 'insurance_packet' && (
              <div className={cardStyles.base}>
                <h3 className="font-semibold text-blue-200 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Packet Contents
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-white/80">Risk Assessment Reports</span>
                    <span className="text-white/40">2 PDFs</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-white/80">Audit Trail Log</span>
                    <span className="text-white/40">CSV Export</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-white/80">Security Events</span>
                    <span className="text-white/40">3 events logged</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-white/80">Capability Violations</span>
                    <span className="text-white/40">2 violations logged</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <button
                      onClick={() => showDemoMessage('Download insurance packet')}
                      className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded text-sm font-medium transition-colors"
                    >
                      Download Packet (ZIP)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentScenario === 'normal' && (
              <div className={cardStyles.base}>
                <h3 className="font-semibold text-white mb-3">Operational Snapshot</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-white/60">Total Jobs</div>
                    <div className="text-2xl font-bold text-white">{localJobs.length}</div>
                  </div>
                  <div>
                    <div className="text-white/60">In Progress</div>
                    <div className="text-2xl font-bold text-[#F97316]">
                      {localJobs.filter(j => j.status === 'in_progress').length}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60">High Risk</div>
                    <div className="text-2xl font-bold text-red-400">
                      {localJobs.filter(j => j.risk_level === 'high').length}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60">Flagged</div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {localJobs.filter(j => j.review_flag).length}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={cardStyles.base}>
              <div className="mb-4">
                <h2 className={`${typography.h2} mb-2`}>Job Roster</h2>
                <p className="text-white/70 text-sm italic">
                  Every job is continuously risk-scored and logged for legal defensibility.
                </p>
              </div>
              <p className="text-white/60 text-sm mb-6">
                View and manage risk assessments. Flagged jobs are visible to Safety Leads and Executives.
              </p>
              
              <div className="space-y-3">
                {localJobs.map((job) => (
                  <div
                    key={job.id}
                    data-tour={job.review_flag ? 'flagged-job' : undefined}
                    className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-white">{job.client_name}</h3>
                          <span className="px-2 py-0.5 text-xs rounded bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30">
                            {job.risk_level?.toUpperCase()}
                          </span>
                          {job.review_flag && (
                            <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400 border border-red-500/30">
                              Flagged
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/60 mb-1">{job.job_type}</p>
                        <p className="text-xs text-white/40">{job.location}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-white/50">
                          <span>Risk Score: {job.risk_score}</span>
                          <span>Status: {job.status}</span>
                          <span>Created: {new Date(job.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => showDemoMessage('View job details')}
                          className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded transition-colors"
                        >
                          View
                        </button>
                        {(currentRole === 'owner' || currentRole === 'admin' || currentRole === 'safety_lead') ? (
                          <button
                            onClick={() => {
                              // Simulate flagging - update local state
                              setLocalJobs(localJobs.map(j => {
                                if (j.id === job.id) {
                                  const newFlagged = !j.review_flag
                                  return {
                                    ...j,
                                    review_flag: newFlagged,
                                    flagged_at: newFlagged ? new Date().toISOString() : null,
                                  } as typeof j
                                }
                                return j
                              }))
                              showDemoMessage('Flag job for review')
                            }}
                            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded transition-colors"
                          >
                            {job.review_flag ? 'Unflag' : 'Flag'}
                          </button>
                        ) : (
                          <div className="px-3 py-1.5 text-xs text-white/40 italic" title="Requires Safety Lead/Admin/Owner role">
                            Requires Safety Lead/Admin/Owner
                          </div>
                        )}
                        {currentRole !== 'executive' ? (
                          <button
                            onClick={() => {
                              // Simulate archiving - remove from list
                              setLocalJobs(localJobs.filter(j => j.id !== job.id))
                              showDemoMessage('Archive job')
                            }}
                            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded transition-colors"
                          >
                            Archive
                          </button>
                        ) : (
                          <div className="px-3 py-1.5 text-xs text-white/40 italic">
                            Read-only (Executive)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {currentRole === 'member' && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-200">
                  <strong>Member Role:</strong> You cannot flag jobs. Only Safety Leads, Admins, and Owners can flag jobs for review.
                </div>
              )}
              {currentRole === 'executive' && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-200">
                  <strong>Executive Role:</strong> Read-only access. You can view all jobs and flagged items, but cannot modify data.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team Section */}
        {activeSection === 'team' && (
          <div className="space-y-6">
            <div className={cardStyles.base}>
              <h2 className={`${typography.h2} mb-2`}>Access & Accountability</h2>
              <p className="text-white/60 text-sm mb-6">
                Define who can view, manage, and approve risk. All access changes are recorded for compliance.
              </p>

              <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
                <h3 className="font-semibold mb-3">Risk Coverage</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-white/60">Owners</div>
                    <div className="text-2xl font-bold text-[#F97316]">1</div>
                  </div>
                  <div>
                    <div className="text-white/60">Safety Leads</div>
                    <div className="text-2xl font-bold text-[#F97316]">1</div>
                  </div>
                  <div>
                    <div className="text-white/60">Admins</div>
                    <div className="text-2xl font-bold text-[#F97316]">1</div>
                  </div>
                  <div>
                    <div className="text-white/60">Executives</div>
                    <div className="text-2xl font-bold text-[#F97316]">1</div>
                  </div>
                  <div>
                    <div className="text-white/60">Members</div>
                    <div className="text-2xl font-bold text-[#F97316]">1</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold mb-3">Team Members</h3>
                {data.teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{member.full_name || member.email}</span>
                          <span className="px-2 py-0.5 text-xs rounded bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30">
                            {member.role}
                          </span>
                        </div>
                        <p className="text-sm text-white/60">{member.email}</p>
                        {(member.role === 'safety_lead' || member.role === 'executive') && (
                          <p className="text-xs text-white/40 mt-1">
                            Risk visibility: {member.role === 'safety_lead' ? 'Flagged jobs, Executive view' : 'Executive view, read-only'}
                          </p>
                        )}
                      </div>
                      {(currentRole === 'owner' || currentRole === 'admin') && member.id !== 'demo-user-001' && (
                        <button
                          onClick={() => showDemoMessage('Deactivate access')}
                          className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded transition-colors"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-xs text-white/40 text-center">
                  All access changes are recorded for compliance and audit review.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Account Section */}
        {activeSection === 'account' && (
          <div className="space-y-6">
            <div className={cardStyles.base}>
              <h2 className={`${typography.h2} mb-4`}>Account Settings</h2>
              
              <div className="space-y-6">
                {/* Audit Summary Card */}
                {currentScenario === 'audit_review' && (
                  <div data-tour="audit-logs" className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <h3 className="font-semibold text-yellow-200 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Audit Summary
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-yellow-200/60">Capability Violations</div>
                        <div className="text-2xl font-bold text-yellow-200">
                          {data.auditLogs.filter(log => log.event_name === 'auth.role_violation').length}
                        </div>
                      </div>
                      <div>
                        <div className="text-yellow-200/60">Flagged Jobs</div>
                        <div className="text-2xl font-bold text-yellow-200">
                          {data.jobs.filter(job => job.review_flag).length}
                        </div>
                      </div>
                      <div>
                        <div className="text-yellow-200/60">Security Events</div>
                        <div className="text-2xl font-bold text-yellow-200">
                          {data.securityEvents.length}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Profile */}
                <div>
                  <h3 className="font-semibold mb-3">Profile</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-white/60">Email</label>
                      <div className="mt-1 p-3 bg-white/5 border border-white/10 rounded">
                        {data.profile.email}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-white/60">Full Name</label>
                      <div className="mt-1 p-3 bg-white/5 border border-white/10 rounded">
                        {data.profile.full_name}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-white/60">Phone</label>
                      <div className="mt-1 p-3 bg-white/5 border border-white/10 rounded">
                        {data.profile.phone}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Organization */}
                <div>
                  <h3 className="font-semibold mb-3">Organization</h3>
                  <div>
                    <label className="text-sm text-white/60">Organization Name</label>
                    <div className="mt-1 p-3 bg-white/5 border border-white/10 rounded">
                      {data.organization.name}
                    </div>
                    {currentRole !== 'owner' && (
                      <p className="mt-2 text-xs text-yellow-200">
                        Only owners can update organization name
                      </p>
                    )}
                  </div>
                </div>

                {/* Billing */}
                <div data-tour="billing">
                  <div className="mb-3">
                    <h3 className="font-semibold mb-1">Plan & Billing</h3>
                    <p className="text-white/60 text-xs italic">
                      Billing is external by design. Operational data stays tamper-proof.
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-white/60">Plan</span>
                      <span className="font-medium">{data.billing.tier.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Status</span>
                      <span className="font-medium capitalize">{data.billing.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Renewal Date</span>
                      <span className="font-medium">{new Date(data.billing.renewal_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Seats</span>
                      <span className="font-medium">{data.billing.seats_used} / {data.billing.seats_limit || 'Unlimited'}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs text-white/40">
                        Managed by Stripe • Source of truth: External billing provider
                      </p>
                    </div>
                  </div>
                </div>

                {/* Security */}
                <div data-tour="security">
                  <h3 className="font-semibold mb-3">Security</h3>
                  <div className="space-y-2">
                    <div className="p-3 bg-white/5 border border-white/10 rounded">
                      <div className="text-sm text-white/60">Last password change</div>
                      <div className="text-white mt-1">
                        {new Date(data.securityEvents[0]?.created_at || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 border border-white/10 rounded">
                      <div className="text-sm text-white/60">Active sessions</div>
                      <div className="text-white mt-1">2 active</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DemoPageContent() {
  const searchParams = useSearchParams()
  const rawRole = searchParams?.get('role') || 'owner'
  const rawScenario = searchParams?.get('scenario') || 'normal'
  
  // Validate and fallback to safe defaults
  const validRoles: DemoRole[] = ['owner', 'admin', 'safety_lead', 'executive', 'member']
  const validScenarios: DemoScenario[] = ['normal', 'audit_review', 'incident', 'insurance_packet']
  
  const initialRole = validRoles.includes(rawRole as DemoRole) ? (rawRole as DemoRole) : 'member'
  const initialScenario = validScenarios.includes(rawScenario as DemoScenario) ? (rawScenario as DemoScenario) : 'normal'

  return (
    <DemoProvider initialRole={initialRole} initialScenario={initialScenario}>
      <DemoContent />
    </DemoProvider>
  )
}

export default function DemoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]"></div>
      </div>
    }>
      <DemoPageContent />
    </Suspense>
  )
}
