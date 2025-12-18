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
import type { DemoRole, DemoScenario } from '@/lib/demo/demoData'

interface TourStep {
  id: string
  title: string
  description: string
  target: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const tourSteps: TourStep[] = [
  {
    id: 'role-switcher',
    title: 'Role-Based Capabilities',
    description: 'Watch capabilities change instantly. Try switching to "Member" and notice which actions disappear.',
    target: '[data-tour="role-switcher"]',
    position: 'bottom',
  },
  {
    id: 'flagged-job',
    title: 'Flagged for Review',
    description: 'Safety Leads and Executives see all flagged jobs automatically. This is a governance signal, not a workflow.',
    target: '[data-tour="flagged-job"]',
    position: 'right',
  },
  {
    id: 'audit-logs',
    title: 'Audit Trail',
    description: 'Every action is logged, including capability violations. See auth.role_violation events proving enforcement.',
    target: '[data-tour="audit-logs"]',
    position: 'top',
  },
  {
    id: 'billing',
    title: 'Billing Integration',
    description: 'Managed by Stripe. Source of truth is external, but all operational data is in RiskMate.',
    target: '[data-tour="billing"]',
    position: 'top',
  },
  {
    id: 'security',
    title: 'Security Events',
    description: 'Password changes, logins, and session management are all tracked for compliance.',
    target: '[data-tour="security"]',
    position: 'top',
  },
]

function DemoContent() {
  const searchParams = useSearchParams()
  const { data, currentRole, currentScenario, showDemoMessage } = useDemo()
  const [activeSection, setActiveSection] = useState<'jobs' | 'team' | 'account'>('jobs')
  const [tourStep, setTourStep] = useState<number | null>(null)
  const [localJobs, setLocalJobs] = useState(data.jobs)
  
  // Update local jobs when scenario changes
  useEffect(() => {
    setLocalJobs(data.jobs)
  }, [data.jobs])

  // Start tour if ?tour=1 in URL
  useEffect(() => {
    if (searchParams?.get('tour') === '1') {
      setTourStep(0)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <DemoBanner />
      <DashboardNavbar />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header with Role Switcher */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`${typography.h1} mb-2`}>RiskMate Demo</h1>
            <p className="text-white/60 text-sm">
              Interactive product walkthrough — no authentication required
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTourStep(0)}
              className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Tour
            </button>
            <div data-tour="role-switcher">
              <RoleSwitcher />
            </div>
          </div>
        </div>

        <GuidedTour
          step={tourStep}
          steps={tourSteps}
          onClose={() => setTourStep(null)}
          onNext={() => setTourStep(tourStep !== null ? tourStep + 1 : 0)}
          onPrevious={() => setTourStep(tourStep !== null ? Math.max(0, tourStep - 1) : 0)}
        />

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
            <div className={cardStyles.base}>
              <h2 className={`${typography.h2} mb-4`}>Job Roster</h2>
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
                        {(currentRole === 'owner' || currentRole === 'admin' || currentRole === 'safety_lead') && (
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
                        )}
                        {currentRole !== 'executive' && (
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
                  <h3 className="font-semibold mb-3">Plan & Billing</h3>
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
  const initialRole = (searchParams?.get('role') as DemoRole) || 'owner'
  const initialScenario = (searchParams?.get('scenario') as DemoScenario) || 'normal'

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
