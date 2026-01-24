'use client'

import React, { useEffect, useState, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'

// Track funnel events (one-shot guard)
const funnelLogRef: Record<string, boolean> = {}
function trackFunnelEvent(eventName: string, metadata?: Record<string, any>) {
  const key = `${eventName}_${JSON.stringify(metadata)}`
  if (funnelLogRef[key]) {
    return // Already logged
  }
  funnelLogRef[key] = true
  console.info(`[Funnel] ${eventName}`, metadata || {})
  // TODO: Add analytics tracking
}

type VerificationStatus = 'loading' | 'active' | 'processing' | 'error'

function ThankYouContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<VerificationStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [planCode, setPlanCode] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3
  const didFinalize = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Extract sessionId as a stable string (not object)
  const sessionId = useMemo(() => {
    return searchParams.get('session_id') ?? ''
  }, [searchParams])

  useEffect(() => {
    // Hard one-shot guard - if we already finalized (redirected), don't run again
    if (didFinalize.current) {
      return
    }

    // If no sessionId, error immediately
    if (!sessionId) {
      setError('Missing session ID. If you just completed a purchase, your subscription may still be processing. Please check your email for confirmation.')
      setStatus('error')
      return
    }

    // One-shot funnel log
    trackFunnelEvent('checkout_return_success', { session_id: sessionId })

    const verifyPurchase = async () => {

      // Verify session with backend (optional auth, works without login)
      try {
        const verifyResponse = await fetch(`/api/subscriptions/verify?session_id=${sessionId}`)
        
        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to verify session')
        }

        const verifyData = await verifyResponse.json()
        
        // Check for new state field (complete/processing/failed) or fallback to status
        const state = verifyData.state || (verifyData.status === 'active' || verifyData.status === 'trialing' ? 'complete' : 'processing')
        const redirectTo = verifyData.redirectTo || '/operations'

        if (state === 'complete' || verifyData.status === 'active' || verifyData.status === 'trialing') {
          // One-shot funnel log
          trackFunnelEvent('subscription_activated', { 
            plan_code: verifyData.plan_code,
            session_id: sessionId,
          })
          setStatus('active')
          setPlanCode(verifyData.plan_code)
          
          // Mark as finalized and redirect after 3 seconds
          didFinalize.current = true
          timeoutRef.current = setTimeout(() => {
            router.push(redirectTo)
          }, 3000)
        } else if (state === 'processing' || verifyData.status === 'pending' || verifyData.status === 'processing') {
          // Webhook is still processing - retry with exponential backoff
          setStatus('processing')
          setPlanCode(verifyData.plan_code || null)
          
          // Auto-retry with exponential backoff (3s, 6s, 9s)
          if (retryCount < maxRetries) {
            const delay = 3000 * (retryCount + 1) // 3s, 6s, 9s
            timeoutRef.current = setTimeout(() => {
              setRetryCount(prev => prev + 1)
              verifyPurchase() // Retry
            }, delay)
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

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [sessionId, router, retryCount]) // Include retryCount to satisfy exhaustive-deps

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

export default function ThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#F97316] mx-auto mb-6" />
            <h1 className="text-4xl font-bold mb-4">Loading...</h1>
            <p className="text-white/60">Please wait...</p>
          </div>
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  )
}


