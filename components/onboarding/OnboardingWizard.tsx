'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface OnboardingStep {
  id: string
  title: string
  description: string
  component: React.ReactNode
}

interface OnboardingWizardProps {
  isOpen: boolean
  onComplete: () => void
  onSkip: () => void
}

export function OnboardingWizard({ isOpen, onComplete, onSkip }: OnboardingWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [organizationName, setOrganizationName] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to RiskMate',
      description: 'Let\'s get you set up in just a few steps',
      component: (
        <div className="space-y-4">
          <p className="text-white/70">
            RiskMate helps you document every job with hazard checklists, risk assessments, photos, and signatures.
          </p>
          <p className="text-white/70">
            Everything gets timestamped and saved automatically, ready for clients, insurers, and auditors.
          </p>
        </div>
      ),
    },
    {
      id: 'organization',
      title: 'Set Up Your Organization',
      description: 'Tell us about your company',
      component: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-2">Organization Name</label>
            <input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Your Company Name"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            />
          </div>
        </div>
      ),
    },
    {
      id: 'logo',
      title: 'Upload Your Logo',
      description: 'Your logo will appear on all PDFs and Permit Packs',
      component: (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="hidden"
              id="logo-upload"
            />
            <label
              htmlFor="logo-upload"
              className="cursor-pointer block"
            >
              {logoFile ? (
                <div>
                  <p className="text-white/80">{logoFile.name}</p>
                  <p className="text-sm text-white/50 mt-2">Click to change</p>
                </div>
              ) : (
                <div>
                  <p className="text-white/80 mb-2">Click to upload logo</p>
                  <p className="text-sm text-white/50">PNG, JPG up to 5MB</p>
                </div>
              )}
            </label>
          </div>
          <p className="text-xs text-white/50">
            Your logo appears on all PDFs and Permit Packs.
          </p>
        </div>
      ),
    },
    {
      id: 'first-job',
      title: 'Create Your First Job',
      description: 'Let\'s create a job to see how RiskMate works',
      component: (
        <div className="space-y-4">
          <p className="text-white/70">
            You can create your first job now, or skip this step and do it later from the dashboard.
          </p>
          <button
            onClick={() => {
              router.push('/operations/jobs/new')
              onComplete()
            }}
            className="w-full px-6 py-3 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
          >
            Create First Job →
          </button>
        </div>
      ),
    },
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (!isOpen) return null

  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onSkip}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#121212] p-8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#F97316] to-[#FF8A3D]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-white/50 mt-2 text-center">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-semibold text-white mb-2">
                {steps[currentStep].title}
              </h2>
              <p className="text-white/60 mb-6">
                {steps[currentStep].description}
              </p>
              {steps[currentStep].component}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <button
              onClick={currentStep === 0 ? onSkip : handleBack}
              className="text-white/60 hover:text-white transition-colors"
            >
              {currentStep === 0 ? 'Skip' : 'Back'}
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
            >
              {currentStep === steps.length - 1 ? 'Complete' : 'Next →'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

