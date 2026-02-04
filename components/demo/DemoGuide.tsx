'use client'

import { motion } from 'framer-motion'
import { buttonStyles, spacing } from '@/lib/styles/design-system'

interface DemoGuideProps {
  currentStep: number | null
  onComplete: () => void
}

const DEMO_STEPS = [
  {
    id: 1,
    title: 'Create a Job',
    description: 'Every job starts with a documented risk record.',
    cta: 'Create Job',
  },
  {
    id: 2,
    title: 'Apply Template',
    description: 'Templates standardize safety across repeat work.',
    cta: 'Quick-Load Template',
  },
  {
    id: 3,
    title: 'Assign Worker',
    description: 'Accountability is logged with timestamps.',
    cta: 'Assign Worker',
  },
  {
    id: 4,
    title: 'Approve Evidence',
    description: 'Evidence approval is logged and immutable.',
    cta: 'Approve Evidence',
  },
  {
    id: 5,
    title: 'Generate Permit Pack',
    description: 'This is what inspectors and insurers receive.',
    cta: 'Generate Permit Pack',
  },
  {
    id: 6,
    title: 'View Version History',
    description: 'Every critical action is traceable.',
    cta: 'View History',
  },
]

export function DemoGuide({ currentStep, onComplete }: DemoGuideProps) {
  const currentStepData = currentStep ? DEMO_STEPS[currentStep - 1] : null
  const isComplete = currentStep === 6

  return (
    <div className="w-80 border-l border-white/10 bg-[#121212]/40 backdrop-blur-sm p-6 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto flex flex-col">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white mb-1">Demo Guide</h3>
        <p className="text-xs text-white/50">
          {currentStep ? `Step ${currentStep} of ${DEMO_STEPS.length}` : 'Getting started...'}
        </p>
      </div>

      {isComplete ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mb-4">
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
            <h4 className="text-lg font-semibold text-white mb-2">Demo Complete</h4>
            <p className="text-sm text-white/60 mb-6">
              You&apos;ve seen how Riskmate documents risk with complete audit trails.
            </p>
          </div>
          <div className="space-y-3">
            <a
              href="/pricing?from=demo"
              className={`${buttonStyles.primary} ${buttonStyles.sizes.lg} w-full block text-center`}
            >
              View Pricing
            </a>
            <a
              href="mailto:sales@riskmate.com"
              className={`${buttonStyles.secondary} ${buttonStyles.sizes.lg} w-full block text-center`}
            >
              Talk to Us
            </a>
          </div>
        </motion.div>
      ) : currentStepData ? (
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#F97316]/20 flex items-center justify-center text-sm font-semibold text-[#F97316]">
                {currentStep}
              </div>
              <h4 className="text-base font-semibold text-white">{currentStepData.title}</h4>
            </div>
            <p className="text-sm text-white/60 mb-4">{currentStepData.description}</p>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <p className="text-xs text-white/50 mb-1">Action:</p>
              <p className="text-sm font-medium text-white">{currentStepData.cta}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-white/50 mb-2">
              <span>Progress</span>
              <span>{currentStep} / {DEMO_STEPS.length}</span>
            </div>
            <div className="w-full bg-black/40 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep || 0) / DEMO_STEPS.length) * 100}%` }}
                className="bg-[#F97316] h-2 rounded-full"
              />
            </div>
          </div>

          {/* Step List */}
          <div className="space-y-2">
            {DEMO_STEPS.map((step, index) => {
              const stepNum = currentStep || 0
              return (
              <div
                key={step.id}
                className={`flex items-center gap-2 text-xs ${
                  index + 1 < stepNum
                    ? 'text-white/40'
                    : index + 1 === stepNum
                    ? 'text-white'
                    : 'text-white/30'
                }`}
              >
                {index + 1 < stepNum ? (
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-green-400"
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
                ) : (
                  <div
                    className={`w-5 h-5 rounded-full border ${
                      index + 1 === stepNum
                        ? 'bg-[#F97316]/20 border-[#F97316]/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  />
                )}
                <span>{step.title}</span>
              </div>
              )
            })}
          </div>
        </motion.div>
      ) : (
        <div className="text-center text-white/50 text-sm">
          <p>Starting demo...</p>
        </div>
      )}

      {/* Trust Footer */}
      <div className="mt-auto pt-6 border-t border-white/10 space-y-2">
        <p className="text-xs text-white/40 text-center leading-relaxed">
          Demo mode simulates actions locally. Real Riskmate logs every action with timestamps and actor names.
        </p>
        <p className="text-xs text-white/50 text-center leading-relaxed font-medium">
          This demo simulates the workflow. In production, these actions are saved, permissioned, and logged to an immutable audit trail.
        </p>
      </div>
    </div>
  )
}

