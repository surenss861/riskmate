'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { DemoGuide } from '@/components/demo/DemoGuide'
import { DemoJobDetail } from '@/components/demo/DemoJobDetail'
import { DemoNavbar } from '@/components/demo/DemoNavbar'
import { DemoProtection } from '@/components/demo/DemoProtection'
import { typography, buttonStyles, spacing } from '@/lib/styles/design-system'

// Demo data (hardcoded, safe)
const DEMO_ORG_ID = 'demo-org-123'
const DEMO_JOB_ID = 'demo-job-123'

export default function DemoPage() {
  const router = useRouter()
  const [demoStarted, setDemoStarted] = useState(false)
  const [currentStep, setCurrentStep] = useState<number | null>(null)

  const handleStartDemo = () => {
    setDemoStarted(true)
    setCurrentStep(1)
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
          <button
            onClick={handleStartDemo}
            className={`${buttonStyles.primary} ${buttonStyles.sizes.lg} ${spacing.normal}`}
          >
            Start Interactive Demo
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
        <DemoNavbar />
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
      </div>
    </DemoProtection>
  )
}
