'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { DemoGuide } from '@/components/demo/DemoGuide'
import { DemoJobDetail } from '@/components/demo/DemoJobDetail'
import { DemoNavbar } from '@/components/demo/DemoNavbar'
import { DemoProtection } from '@/components/demo/DemoProtection'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { typography, buttonStyles, spacing } from '@/lib/styles/design-system'

// Demo data (hardcoded, safe)
const DEMO_ORG_ID = 'demo-org-123'
const DEMO_JOB_ID = 'demo-job-123'

const DEMO_STORAGE_KEY = 'riskmate-demo-state'

export default function DemoPage() {
  const router = useRouter()
  const [demoStarted, setDemoStarted] = useState(false)
  const [currentStep, setCurrentStep] = useState<number | null>(null)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)

  // Load demo state from localStorage on mount (error-proofed)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DEMO_STORAGE_KEY)
        if (saved) {
          try {
            const { demoStarted: savedStarted, currentStep: savedStep } = JSON.parse(saved)
            if (savedStarted && savedStep) {
              setDemoStarted(true)
              setCurrentStep(savedStep)
            }
          } catch (e) {
            // Invalid saved state, ignore
          }
        }
      } catch (e) {
        // localStorage blocked (private mode, etc.) - demo still works, just doesn't persist
      }
    }
  }, [])

  // Save demo state to localStorage whenever it changes (error-proofed)
  useEffect(() => {
    if (typeof window !== 'undefined' && demoStarted) {
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ demoStarted, currentStep }))
      } catch (e) {
        // localStorage blocked - demo still works, just doesn't persist
      }
    }
  }, [demoStarted, currentStep])

  const handleStartDemo = () => {
    setDemoStarted(true)
    setCurrentStep(1)
  }

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      // Restore state from localStorage on navigation
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(DEMO_STORAGE_KEY)
          if (saved) {
            const { demoStarted: savedStarted, currentStep: savedStep } = JSON.parse(saved)
            if (savedStarted && savedStep) {
              setDemoStarted(true)
              setCurrentStep(savedStep)
            } else {
              setDemoStarted(false)
              setCurrentStep(null)
            }
          }
        } catch (e) {
          // localStorage blocked or invalid - continue
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Optional: Clear demo state on page unload if user explicitly restarted
  // This prevents "half-finished demo" vibes when returning later
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only clear if user explicitly restarted (not just navigating away)
      // We'll track this via a flag set on restart confirm
      // For now, we keep state - user can manually restart if needed
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleRestartClick = () => {
    // Prevent double-trigger by checking if modal is already open
    if (!showRestartConfirm) {
      setShowRestartConfirm(true)
    }
  }

  const handleRestartConfirm = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(DEMO_STORAGE_KEY)
      } catch (e) {
        // localStorage blocked - continue anyway
      }
    }
    setDemoStarted(false)
    setCurrentStep(null)
    setShowRestartConfirm(false)
  }

  if (!demoStarted) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl text-center"
        >
          <h1 className={`${typography.h1} ${spacing.section}`}>
            See how serious contractors document risk.
          </h1>
          <p className={`text-lg text-white/70 ${spacing.relaxed} max-w-xl mx-auto`}>
            A guided walkthrough of RiskMate&apos;s core compliance workflow. No signup required.
          </p>
          <div className={`${spacing.normal} space-y-2`}>
            <p className="text-sm text-white/50 max-w-md mx-auto">
              <strong className="text-white/70">What is this?</strong> An interactive demonstration of RiskMate&apos;s compliance documentation system.
            </p>
            <p className="text-sm text-white/50 max-w-md mx-auto">
              <strong className="text-white/70">What you&apos;ll see:</strong> Complete workflow from job creation to audit-ready reports.
            </p>
            <p className="text-sm text-white/50 max-w-md mx-auto">
              <strong className="text-white/70">Is it safe?</strong> All actions are simulated locally. No data is saved or transmitted.
            </p>
          </div>
          <button
            onClick={handleStartDemo}
            className={`${buttonStyles.primary} ${buttonStyles.sizes.lg} ${spacing.normal}`}
          >
            Start Demo Walkthrough
          </button>
          <p className="text-xs text-white/40 mt-4">
            All actions are simulated. No data is saved.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <DemoProtection>
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <DemoNavbar onRestart={handleRestartClick} />
        <div className="flex">
          {/* Main Demo Content */}
          <div className="flex-1">
            <DemoJobDetail
              jobId={DEMO_JOB_ID}
              currentStep={currentStep}
              onStepComplete={(step) => {
                if (step < 6) {
                  setCurrentStep(step + 1)
                }
              }}
            />
          </div>

          {/* Sticky Demo Guide Panel */}
          <DemoGuide
            currentStep={currentStep}
            onComplete={() => {
              // Demo complete
            }}
          />
        </div>
        <ConfirmModal
          isOpen={showRestartConfirm}
          title="Restart demo?"
          message="This resets demo progress. Nothing is saved."
          confirmLabel="Restart"
          onConfirm={handleRestartConfirm}
          onCancel={() => setShowRestartConfirm(false)}
          destructive={false}
        />
      </div>
    </DemoProtection>
  )
}
