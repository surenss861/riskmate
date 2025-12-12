'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { modalStyles, spacing, shadows } from '@/lib/styles/design-system'

interface GenerationStep {
  id: string
  label: string
  status: 'pending' | 'processing' | 'complete' | 'error'
}

interface GenerationProgressModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
  type: 'pdf' | 'permit-pack'
}

const PDF_STEPS: GenerationStep[] = [
  { id: '1', label: 'Compiling job data...', status: 'pending' },
  { id: '2', label: 'Processing photos...', status: 'pending' },
  { id: '3', label: 'Generating PDF layout...', status: 'pending' },
  { id: '4', label: 'Applying branding...', status: 'pending' },
  { id: '5', label: 'Finalizing document...', status: 'pending' },
]

const PERMIT_PACK_STEPS: GenerationStep[] = [
  { id: '1', label: 'Compiling job data...', status: 'pending' },
  { id: '2', label: 'Processing photos...', status: 'pending' },
  { id: '3', label: 'Generating PDF report...', status: 'pending' },
  { id: '4', label: 'Collecting documents...', status: 'pending' },
  { id: '5', label: 'Creating ZIP archive...', status: 'pending' },
  { id: '6', label: 'Uploading to storage...', status: 'pending' },
]

export function GenerationProgressModal({
  isOpen,
  onClose,
  onComplete,
  type,
}: GenerationProgressModalProps) {
  const [steps, setSteps] = useState<GenerationStep[]>(
    type === 'pdf' ? PDF_STEPS : PERMIT_PACK_STEPS
  )
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      // Reset on close
      setCurrentStep(0)
      setSteps((prev) =>
        prev.map((step) => ({ ...step, status: 'pending' as const }))
      )
      return
    }

    // Simulate progress
    const interval = setInterval(() => {
      setSteps((prev) => {
        const newSteps = [...prev]
        if (currentStep < newSteps.length) {
          // Mark current step as processing
          if (newSteps[currentStep].status === 'pending') {
            newSteps[currentStep] = {
              ...newSteps[currentStep],
              status: 'processing',
            }
          }
          // Mark previous step as complete
          if (currentStep > 0 && newSteps[currentStep - 1].status === 'processing') {
            newSteps[currentStep - 1] = {
              ...newSteps[currentStep - 1],
              status: 'complete',
            }
          }
        }
        return newSteps
      })

      if (currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1)
      } else {
        // All steps complete
        clearInterval(interval)
        setTimeout(() => {
          if (onComplete) onComplete()
          onClose()
        }, 500)
      }
    }, 800)

    return () => clearInterval(interval)
  }, [isOpen, currentStep, steps.length, onComplete, onClose])

  const completedSteps = steps.filter((s) => s.status === 'complete').length
  const progress = (completedSteps / steps.length) * 100

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`${modalStyles.backdrop} z-[80]`}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-md ${modalStyles.container} ${shadows.raised} pointer-events-auto`}
            >
              <div className={`${spacing.relaxed} text-center`}>
                <h3 className={`${modalStyles.title} ${spacing.tight}`}>
                  Generating {type === 'pdf' ? 'PDF Report' : 'Permit Pack'}
                </h3>
                <p className="text-sm text-white/60">
                  This may take a few moments...
                </p>
              </div>

              {/* Progress Bar */}
              <div className={spacing.section}>
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#F97316] to-[#FF8A3D]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-xs text-white/50 mt-2 text-center">
                  {Math.round(progress)}% complete
                </p>
              </div>

              {/* Steps List */}
              <div className={spacing.gap.normal}>
                {steps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    {/* Status Icon */}
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                      {step.status === 'complete' ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
                        >
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </motion.div>
                      ) : step.status === 'processing' ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 rounded-full border-2 border-[#F97316] border-t-transparent"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-white/20" />
                      )}
                    </div>

                    {/* Step Label */}
                    <span
                      className={`text-sm ${
                        step.status === 'complete'
                          ? 'text-white'
                          : step.status === 'processing'
                          ? 'text-[#F97316]'
                          : 'text-white/40'
                      }`}
                    >
                      {step.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

