'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import { subscriptionsApi } from '@/lib/api'

// Track funnel events
function trackFunnelEvent(eventName: string, metadata?: Record<string, any>) {
  console.info(`[Funnel] ${eventName}`, metadata || {})
  // TODO: Add analytics tracking
}

type VerificationStatus = 'loading' | 'active' | 'processing' | 'error'

export default function ThankYouPage() {
  const router = useRouter()
  const [status, setStatus] = useState<VerificationStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [planCode, setPlanCode] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

  useEffect(() => {
    const verifyPurchase = async () => {
      // Get session_id from URL (no Suspense needed)
      const params = new URLSearchParams(window.location.search)
      const sessionId = params.get('session_id')

      trackFunnelEvent('checkout_return_success', { session_id: sessionId })

      if (!sessionId) {
        // Fallback: check subscription status directly
        try {
          const planResponse = await fetch('/api/me/plan')
          if (planResponse.ok) {
            const planData = await planResponse.json()
            if (planData.is_active) {
              trackFunnelEvent('subscription_activated', { plan_code: planData.plan_code })
              setStatus('active')
              setPlanCode(planData.plan_code)
              setTimeout(() => router.push('/operations'), 3000)
              return
            }
          }
        } catch (err) {
          console.error('Failed to check plan status:', err)
        }

        setError('Missing session ID. If you just completed a purchase, your subscription may still be processing.')
        setStatus('error')
        return
      }

      // Verify session with backend
      try {
        const verifyResponse = await fetch(`/api/subscriptions/verify?session_id=${sessionId}`)
        
        if (!verifyResponse.ok) {
          throw new Error('Failed to verify session')
        }

        const verifyData = await verifyResponse.json()
        
        if (verifyData.status === 'active' || verifyData.status === 'trialing') {
          trackFunnelEvent('subscription_activated', { 
            plan_code: verifyData.plan_code,
            session_id: sessionId,
          })
          setStatus('active')
          setPlanCode(verifyData.plan_code)
          setTimeout(() => router.push('/operations'), 3000)
        } else if (verifyData.status === 'pending' || verifyData.status === 'processing') {
          // Webhook is still processing
          setStatus('processing')
          setPlanCode(verifyData.plan_code || null)
          
          // Auto-retry after 3 seconds (up to maxRetries)
          if (retryCount < maxRetries) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1)
              verifyPurchase() // Retry
            }, 3000)
          } else {
            // Max retries reached, show pending state
            setError('Your payment is processing. This may take a few minutes. You\'ll receive an email when your subscription is activated.')
            setStatus('processing')
          }
        } else {
          throw new Error(verifyData.error || 'Subscription not found')
        }
      } catch (err: any) {
        console.error('Failed to verify checkout:', err)
        setError(err?.message || 'Failed to verify purchase. Your payment may have been processed. Please check your dashboard.')
        setStatus('error')
      }
    }

    verifyPurchase()
  }, [router, retryCount])

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <RiskMateLogo size="lg" showText className="mb-8" />
          
          {status === 'loading' ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#F97316] mx-auto mb-6" />
              <h1 className="text-4xl font-bold mb-4">Verifying your purchase...</h1>
              <p className="text-white/60">Please wait while we confirm your subscription.</p>
            </>
          ) : status === 'processing' ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#F97316] mx-auto mb-6" />
              <h1 className="text-4xl font-bold mb-4">Processing your payment...</h1>
              <p className="text-white/60 mb-4">
                {error || 'Your payment is being processed. This may take a few moments.'}
              </p>
              {planCode && (
                <p className="text-sm text-white/50 mb-6">
                  Plan: <span className="font-semibold capitalize">{planCode}</span>
                </p>
              )}
              <p className="text-xs text-white/40">
                {retryCount > 0 && `Checking again... (${retryCount}/${maxRetries})`}
              </p>
              <div className="flex gap-4 justify-center mt-6">
                <button
                  onClick={() => router.push('/operations')}
                  className="rounded-lg bg-[#F97316] px-8 py-4 text-black font-semibold hover:bg-[#FB923C]"
                >
                  Check Dashboard
                </button>
              </div>
            </>
          ) : status === 'error' ? (
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
              {planCode && (
                <p className="text-white/80 mb-2 text-lg font-semibold capitalize">
                  {planCode} Plan Activated
                </p>
              )}
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


