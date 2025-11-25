'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import { subscriptionsApi } from '@/lib/api'

export default function ThankYouPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const confirmPurchase = async () => {
      const sessionId = searchParams.get('session_id')
      if (!sessionId) {
        setError('Missing session ID')
        setLoading(false)
        return
      }

      try {
        await subscriptionsApi.confirmCheckout(sessionId)
        setLoading(false)
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push('/dashboard')
        }, 3000)
      } catch (err: any) {
        console.error('Failed to confirm checkout:', err)
        setError(err?.message || 'Failed to confirm purchase')
        setLoading(false)
      }
    }

    confirmPurchase()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <RiskMateLogo size="lg" showText className="mb-8" />
          
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#F97316] mx-auto mb-6" />
              <h1 className="text-4xl font-bold mb-4">Processing your purchase...</h1>
              <p className="text-white/60">Please wait while we set up your account.</p>
            </>
          ) : error ? (
            <>
              <div className="text-6xl mb-6">⚠️</div>
              <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
              <p className="text-white/60 mb-6">{error}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-lg bg-[#F97316] px-8 py-4 text-black font-semibold hover:bg-[#FB923C]"
              >
                Go to Dashboard
              </button>
            </>
          ) : (
            <>
              <div className="text-6xl mb-6">✓</div>
              <h1 className="text-4xl font-bold mb-4">Thank you for your purchase!</h1>
              <p className="text-white/60 mb-8">
                Your subscription has been activated. You&apos;ll be redirected to your dashboard shortly.
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-lg bg-[#F97316] px-8 py-4 text-black font-semibold hover:bg-[#FB923C]"
              >
                Go to Dashboard Now
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}


