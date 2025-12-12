'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cardStyles, buttonStyles, typography, spacing, badgeStyles, emptyStateStyles } from '@/lib/styles/design-system'
import { EditableText } from '@/components/dashboard/EditableText'
import { GenerationProgressModal } from '@/components/dashboard/GenerationProgressModal'

// Hardcoded demo data (safe, no real data)
const DEMO_JOB = {
  id: 'demo-job-123',
  client_name: 'Acme Construction',
  client_type: 'commercial',
  job_type: 'renovation',
  location: '123 Main St, Toronto, ON',
  description: 'Office renovation with asbestos abatement',
  risk_score: 78,
  risk_level: 'high',
  status: 'active',
  created_at: new Date().toISOString(),
  mitigation_items: [
    { id: '1', title: 'Install fall protection', done: false },
    { id: '2', title: 'Asbestos containment barriers', done: false },
    { id: '3', title: 'Ventilation system setup', done: false },
  ],
  hazards: [
    { id: '1', code: 'FALL-001', name: 'Working at height', severity: 'high' },
    { id: '2', code: 'HAZ-002', name: 'Asbestos exposure', severity: 'critical' },
  ],
}

const DEMO_WORKERS = [
  { id: '1', name: 'John Smith', email: 'john@demo.com', role: 'Foreman', jobsAssigned: 0 },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@demo.com', role: 'Safety Manager', jobsAssigned: 0 },
]

const DEMO_EVIDENCE = [
  {
    id: '1',
    type: 'photo' as const,
    name: 'Site condition - Before',
    status: 'pending' as const,
    submittedBy: 'John Smith',
    submittedAt: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'document' as const,
    name: 'Asbestos test report',
    status: 'pending' as const,
    submittedBy: 'Sarah Johnson',
    submittedAt: new Date().toISOString(),
  },
]

const DEMO_TEMPLATES = [
  { id: '1', name: 'Commercial Renovation', type: 'job' as const },
  { id: '2', name: 'Asbestos Work', type: 'hazard' as const },
]

interface DemoJobDetailProps {
  jobId: string
  currentStep: number | null
  onStepComplete: (step: number) => void
}

export function DemoJobDetail({ jobId, currentStep, onStepComplete }: DemoJobDetailProps) {
  const [job, setJob] = useState(DEMO_JOB)
  const [step1Complete, setStep1Complete] = useState(false)
  const [step2Complete, setStep2Complete] = useState(false)
  const [step3Complete, setStep3Complete] = useState(false)
  const [step4Complete, setStep4Complete] = useState(false)
  const [step5Complete, setStep5Complete] = useState(false)
  const [step6Complete, setStep6Complete] = useState(false)
  const [workers, setWorkers] = useState(DEMO_WORKERS)
  const [evidence, setEvidence] = useState(DEMO_EVIDENCE)
  const [generatingPermitPack, setGeneratingPermitPack] = useState(false)
  const [versionHistory, setVersionHistory] = useState<Array<{
    id: string
    action: string
    actor: string
    timestamp: string
  }>>([
    {
      id: '1',
      action: 'Job created',
      actor: 'Demo User',
      timestamp: new Date().toISOString(),
    },
  ])

  // Auto-advance steps when actions complete
  useEffect(() => {
    if (step1Complete && currentStep === 1) {
      setTimeout(() => onStepComplete(1), 500)
    }
    if (step2Complete && currentStep === 2) {
      setTimeout(() => onStepComplete(2), 500)
    }
    if (step3Complete && currentStep === 3) {
      setTimeout(() => onStepComplete(3), 500)
    }
    if (step4Complete && currentStep === 4) {
      setTimeout(() => onStepComplete(4), 500)
    }
    if (step5Complete && currentStep === 5) {
      setTimeout(() => onStepComplete(5), 500)
    }
    if (step6Complete && currentStep === 6) {
      setTimeout(() => onStepComplete(6), 500)
    }
  }, [step1Complete, step2Complete, step3Complete, step4Complete, step5Complete, step6Complete, currentStep, onStepComplete])

  const handleCreateJob = () => {
    // Simulate job creation
    setStep1Complete(true)
    setVersionHistory((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        action: 'Job created',
        actor: 'Demo User',
        timestamp: new Date().toISOString(),
      },
    ])
  }

  const handleApplyTemplate = () => {
    // Simulate template application
    setJob((prev) => ({
      ...prev,
      risk_score: 85,
      risk_level: 'high',
    }))
    setStep2Complete(true)
    setVersionHistory((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        action: 'Template "Commercial Renovation" applied',
        actor: 'Demo User',
        timestamp: new Date().toISOString(),
      },
    ])
  }

  const handleAssignWorker = () => {
    // Simulate worker assignment
    setWorkers((prev) =>
      prev.map((w) => (w.id === '1' ? { ...w, jobsAssigned: 1 } : w))
    )
    setStep3Complete(true)
    setVersionHistory((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        action: 'Worker "John Smith" assigned',
        actor: 'Demo User',
        timestamp: new Date().toISOString(),
      },
    ])
  }

  const handleApproveEvidence = () => {
    // Simulate evidence approval
    setEvidence((prev) =>
      prev.map((e) => (e.id === '1' ? { ...e, status: 'approved' as const } : e))
    )
    setStep4Complete(true)
    setVersionHistory((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        action: 'Evidence "Site condition - Before" approved',
        actor: 'Demo User',
        timestamp: new Date().toISOString(),
      },
    ])
  }

  const handleGeneratePermitPack = () => {
    setGeneratingPermitPack(true)
    // Simulate permit pack generation
    setTimeout(() => {
      setGeneratingPermitPack(false)
      setStep5Complete(true)
      setVersionHistory((prev) => [
        ...prev,
        {
          id: String(prev.length + 1),
          action: 'Permit Pack generated',
          actor: 'Demo User',
          timestamp: new Date().toISOString(),
        },
      ])
    }, 3000)
  }

  const handleViewHistory = () => {
    setStep6Complete(true)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Job Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={spacing.section}>
        <EditableText
          value={job.client_name}
          onSave={() => {}}
          className={`${typography.h1} ${spacing.section}`}
          inputClassName={typography.h1}
          readOnly
        />
        <p className="text-xl text-[#A1A1A1] mb-4">{job.location}</p>
        <div className="flex items-center gap-3">
          <span className={`${badgeStyles.base} ${badgeStyles.risk.high}`}>
            Risk: {job.risk_level}
          </span>
          <span className={`${badgeStyles.base} ${badgeStyles.status.active}`}>
            {job.status}
          </span>
        </div>
      </motion.div>

      {/* Step 1: Create Job */}
      {currentStep === 1 && !step1Complete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardStyles.base} ${cardStyles.padding.lg} ${spacing.section}`}
        >
          <h2 className={`${typography.h2} ${spacing.relaxed}`}>Create a Job</h2>
          <p className="text-sm text-white/60 mb-6">
            Every job starts with a documented risk record. Fill in the details below.
          </p>
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Client Name</label>
              <input
                type="text"
                value={job.client_name}
                readOnly
                className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#121212]/60 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Location</label>
              <input
                type="text"
                value={job.location}
                readOnly
                className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#121212]/60 text-white"
              />
            </div>
          </div>
          <button
            onClick={handleCreateJob}
            className={`${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
          >
            Create Job
          </button>
        </motion.div>
      )}

      {/* Step 2: Apply Template */}
      {currentStep === 2 && !step2Complete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardStyles.base} ${cardStyles.padding.lg} ${spacing.section}`}
        >
          <h2 className={`${typography.h2} ${spacing.relaxed}`}>Apply Template</h2>
          <p className="text-sm text-white/60 mb-6">
            Templates standardize safety across repeat work. Select a template to auto-fill hazards.
          </p>
          <div className="space-y-3 mb-6">
            {DEMO_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className={`p-4 rounded-lg border ${
                  template.id === '1'
                    ? 'border-[#F97316]/30 bg-[#F97316]/10'
                    : 'border-white/10 bg-[#121212]/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{template.name}</h4>
                    <p className="text-xs text-white/50 mt-1">{template.type} template</p>
                  </div>
                  {template.id === '1' && (
                    <span className="text-xs px-2 py-1 bg-[#F97316]/20 text-[#F97316] rounded border border-[#F97316]/30">
                      Suggested
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleApplyTemplate}
            className={`${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
          >
            Quick-Load Template
          </button>
        </motion.div>
      )}

      {/* Step 3: Assign Worker */}
      {currentStep === 3 && !step3Complete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardStyles.base} ${cardStyles.padding.lg} ${spacing.section}`}
        >
          <h2 className={`${typography.h2} ${spacing.relaxed}`}>Assign Worker</h2>
          <p className="text-sm text-white/60 mb-6">
            Accountability is logged with timestamps. Click to assign a worker.
          </p>
          <div className="space-y-3 mb-6">
            {workers.map((worker) => (
              <div
                key={worker.id}
                className="p-4 rounded-lg border border-white/10 bg-[#121212]/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F97316]/20 flex items-center justify-center text-sm font-semibold text-[#F97316]">
                    {worker.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{worker.name}</h4>
                    <p className="text-xs text-white/50">{worker.role}</p>
                  </div>
                </div>
                {worker.jobsAssigned === 0 && (
                  <button
                    onClick={handleAssignWorker}
                    className="px-4 py-2 text-xs bg-[#F97316] text-black rounded-lg hover:bg-[#FB923C] transition-colors"
                  >
                    Assign
                  </button>
                )}
                {worker.jobsAssigned > 0 && (
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded border border-green-500/30">
                    Assigned
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Step 4: Approve Evidence */}
      {currentStep === 4 && !step4Complete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardStyles.base} ${cardStyles.padding.lg} ${spacing.section}`}
        >
          <h2 className={`${typography.h2} ${spacing.relaxed}`}>Approve Evidence</h2>
          <p className="text-sm text-white/60 mb-6">
            Evidence approval is logged and immutable. Click to approve pending evidence.
          </p>
          <div className="space-y-3 mb-6">
            {evidence.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-lg border border-white/10 bg-[#121212]/60 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`${badgeStyles.base} ${
                      item.status === 'approved'
                        ? badgeStyles.verification.approved
                        : badgeStyles.verification.pending
                    }`}>
                      {item.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-lg border border-white/10 bg-[#121212] text-white/70">
                      {item.type}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{item.name}</h4>
                  <p className="text-xs text-white/50">
                    Submitted by {item.submittedBy}
                  </p>
                </div>
                {item.status === 'pending' && (
                  <button
                    onClick={handleApproveEvidence}
                    className="px-4 py-2 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors"
                  >
                    Approve
                  </button>
                )}
                {item.status === 'approved' && (
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded border border-green-500/30">
                    Approved
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Step 5: Generate Permit Pack */}
      {currentStep === 5 && !step5Complete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardStyles.base} ${cardStyles.padding.lg} ${spacing.section}`}
        >
          <h2 className={`${typography.h2} ${spacing.relaxed}`}>Generate Permit Pack</h2>
          <p className="text-sm text-white/60 mb-6">
            This is what inspectors and insurers receive. A complete compliance bundle in one ZIP file.
          </p>
          <button
            onClick={handleGeneratePermitPack}
            disabled={generatingPermitPack}
            className={`${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
          >
            {generatingPermitPack ? 'Generating...' : 'Generate Permit Pack'}
          </button>
          {generatingPermitPack && (
            <GenerationProgressModal
              isOpen={true}
              type="permit-pack"
              onComplete={() => {}}
            />
          )}
        </motion.div>
      )}

      {/* Step 6: View Version History */}
      {currentStep === 6 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardStyles.base} ${cardStyles.padding.lg} ${spacing.section}`}
        >
          <h2 className={`${typography.h2} ${spacing.relaxed}`}>View Version History</h2>
          <p className="text-sm text-white/60 mb-6">
            Every critical action is traceable. This is the complete audit trail.
          </p>
          <div className="space-y-3">
            {versionHistory.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-lg border border-white/10 bg-[#121212]/60"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white mb-1">{entry.action}</p>
                    <p className="text-xs text-white/50">
                      {entry.actor} • {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!step6Complete && (
            <button
              onClick={handleViewHistory}
              className={`${buttonStyles.secondary} ${buttonStyles.sizes.lg} mt-6`}
            >
              Continue
            </button>
          )}
        </motion.div>
      )}

      {/* Demo Complete State */}
      {step6Complete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${cardStyles.base} ${cardStyles.padding.lg} ${spacing.section} text-center`}
        >
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className={`${typography.h2} ${spacing.normal}`}>Demo Complete</h3>
          <p className="text-sm text-white/60 mb-6">
            You&apos;ve seen how RiskMate documents risk with complete audit trails.
          </p>
        </motion.div>
      )}
    </div>
  )
}

