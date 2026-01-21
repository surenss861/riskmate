'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'

// Track funnel events
function trackFunnelEvent(eventName: string, metadata?: Record<string, any>) {
  console.info(`[Funnel] ${eventName}`, metadata || {})
  // TODO: Add analytics tracking
}

export default function CancelledPage() {
  const router = useRouter()

  useEffect(() => {
    trackFunnelEvent('checkout_return_cancel')
  }, [])

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <RiskMateLogo size="lg" showText className="mb-8" />
          
          <div className="text-6xl mb-6">ℹ️</div>
          <h1 className="text-4xl font-bold mb-4">Checkout Cancelled</h1>
          <p className="text-white/60 mb-8">
            Your checkout was cancelled. No charges were made to your account.
          </p>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push('/pricing')}
              className="rounded-lg bg-[#F97316] px-8 py-4 text-black font-semibold hover:bg-[#FB923C]"
            >
              View Pricing Again
            </button>
            <button
              onClick={() => router.push('/operations')}
              className="rounded-lg border border-white/10 px-8 py-4 text-white font-semibold hover:border-white/30"
            >
              Back to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}


