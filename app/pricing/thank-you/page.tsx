'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import { subscriptionsApi } from '@/lib/api'

function ThankYouContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const confirmPurchase = async () => {
      const sessionId = searchParams.get('session_id')
      if (!sessionId) {
        // Check if user might have completed checkout but session_id is missing
        // This can happen if Stripe redirects without the parameter
        // Try to check subscription status instead
        try {
          const subscription = await subscriptionsApi.get()
          if (subscription.data?.status === 'active' || subscription.data?.status === 'trialing') {
            // Subscription is already active, treat as success
            setLoading(false)
            setTimeout(() => {
              router.push('/operations')
            }, 3000)
            return
          }
        } catch (err) {
          // If we can't check subscription, show the error
        }
        
        setError('Missing session ID. If you just completed a purchase, your subscription may still be processing. Please check your dashboard or try again.')
        setLoading(false)
        return
      }

      try {
        await subscriptionsApi.confirmCheckout(sessionId)
        setLoading(false)
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push('/operations')
        }, 3000)
      } catch (err: any) {
        console.error('Failed to confirm checkout:', err)
        setError(err?.message || 'Failed to confirm purchase. Your payment may have been processed. Please check your dashboard.')
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
              <p className="text-white/60 mb-6 max-w-md mx-auto">{error}</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => router.push('/operations')}
                  className="rounded-lg bg-[#F97316] px-8 py-4 text-black font-semibold hover:bg-[#FB923C]"
                >
                  Check Dashboard
                </button>
                <button
                  onClick={() => router.push('/pricing')}
                  className="rounded-lg border border-white/20 px-8 py-4 text-white font-semibold hover:bg-white/10"
                >
                  Back to Pricing
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl mb-6">✓</div>
              <h1 className="text-4xl font-bold mb-4">Thank you for your purchase!</h1>
              <p className="text-white/60 mb-8">
                Your subscription has been activated. You&apos;ll be redirected to your dashboard shortly.
              </p>
              <button
                onClick={() => router.push('/operations')}
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

export default function ThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#F97316] mx-auto mb-6" />
            <h1 className="text-4xl font-bold mb-4">Loading...</h1>
          </div>
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  )
}


