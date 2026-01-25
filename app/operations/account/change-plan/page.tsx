'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { subscriptionsApi } from '@/lib/api'
import { ErrorModal } from '@/components/dashboard/ErrorModal'
import { AppBackground, AppShell, PageSection, GlassCard, Button, PageHeader } from '@/components/shared'

type PlanCode = 'starter' | 'pro' | 'business'

interface Plan {
  code: PlanCode
  name: string
  price: number
  priceLabel: string
  description: string
  features: string[]
  popular?: boolean
}

const PLANS: Plan[] = [
  {
    code: 'starter',
    name: 'Starter',
    price: 29,
    priceLabel: '$29',
    description: 'per business',
    features: [
      '10 jobs per month',
      'Automatic risk scores',
      'Branded watermark PDFs',
      'Shareable job reports (view-only links)',
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    price: 59,
    priceLabel: '$59',
    description: 'per business',
    features: [
      'Unlimited jobs',
      'Up to 5 team seats',
      'Branded PDFs + notifications',
      'Live reports + client share links',
      'Priority email support',
    ],
    popular: true,
  },
  {
    code: 'business',
    name: 'Business',
    price: 129,
    priceLabel: '$129',
    description: 'per business',
    features: [
      'Unlimited seats',
      'Permit Pack Generator (ZIP bundle)',
      'Org-level dashboard analytics',
      'Versioned audit logs (compliance history)',
      'Dedicated onboarding & phone support',
    ],
  },
]

export default function ChangePlanPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<PlanCode | 'none' | null>(null)
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(false)
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null)
  const [switching, setSwitching] = useState<PlanCode | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        const subscriptionResponse = await subscriptionsApi.get()
        const tier = subscriptionResponse.data?.tier as PlanCode | 'none' | null
        setCurrentPlan(tier || 'none')
        setCancelAtPeriodEnd(subscriptionResponse.data?.cancel_at_period_end ?? false)
        setCurrentPeriodEnd(subscriptionResponse.data?.current_period_end ?? null)

        // Track plan view in backend
        try {
          await fetch('/api/subscriptions/track-view', {
            method: 'POST',
          })
        } catch (err) {
          // Silently fail - tracking shouldn't break the UI
          console.warn('Failed to track plan view:', err)
        }
      } catch (err: any) {
        console.error('Failed to load subscription:', err)
        setError('Failed to load your current plan')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSwitchPlan = async (plan: PlanCode) => {
    if (plan === currentPlan) {
      return // Already on this plan
    }

    setSwitching(plan)
    setError(null)

    try {
      // If switching to starter (free), confirm cancellation
      if (plan === 'starter' && currentPlan !== 'starter' && currentPlan !== 'none') {
        if (!confirm('Switch to Starter (free) plan? Your subscription will be cancelled and you\'ll lose access to paid features.')) {
          setSwitching(null)
          return
        }
      }

      const response = await subscriptionsApi.switchPlan(plan)
      
      // Check for checkout URL (backend may return 'url' or 'checkout_url')
      const checkoutUrl = response.url || (response as any).checkout_url
      
      if (checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = checkoutUrl
        return // Important: return early to prevent navigation below
      } else if (response.success) {
        // Plan switched successfully (e.g., immediate downgrade)
        // Redirect to account page (it will reload subscription data)
        router.push('/operations/account')
      } else {
        throw new Error('Failed to switch plan')
      }
    } catch (err: any) {
      console.error('Failed to switch plan:', err)
      setError('Couldn\'t switch your plan. Your current plan is still active — try again in a moment.')
      setSwitching(null)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your billing period.')) {
      return
    }

    setCanceling(true)
    setError(null)

    try {
      const cancelResponse = await subscriptionsApi.cancel()
      
      // Handle noop case (already canceled or no subscription)
      if (cancelResponse.noop || cancelResponse.alreadyCanceled) {
        setError('No active subscription to cancel')
        setTimeout(() => setError(null), 3000)
      } else if (cancelResponse.alreadyScheduled) {
        setError('Cancellation is already scheduled')
        setTimeout(() => setError(null), 3000)
      } else if (cancelResponse.current_period_end) {
        // Success - show cancellation date
        const cancelDate = new Date(cancelResponse.current_period_end * 1000).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
        setError(`Cancellation scheduled for ${cancelDate}`)
        setTimeout(() => setError(null), 5000)
      } else {
        // Clear error after 3 seconds for other success cases
        setTimeout(() => setError(null), 3000)
      }
      
      // Reload subscription data to update UI
      const subscriptionResponse = await subscriptionsApi.get()
      setCancelAtPeriodEnd(subscriptionResponse.data?.cancel_at_period_end ?? false)
      setCurrentPeriodEnd(subscriptionResponse.data?.current_period_end ?? null)
      setCurrentPlan(subscriptionResponse.data?.tier as PlanCode | 'none' | null)
    } catch (err: any) {
      console.error('Failed to cancel subscription:', err)
      setError(err?.message || 'Failed to cancel subscription')
    } finally {
      setCanceling(false)
    }
  }

  const handleResume = async () => {
    setResuming(true)
    setError(null)

    try {
      const resumeResponse = await subscriptionsApi.resume()
      
      // Handle noop case
      if (resumeResponse.noop || resumeResponse.alreadyResumed) {
        setError('Subscription is already active')
        setTimeout(() => setError(null), 3000)
      } else {
        setError('Subscription resumed successfully')
        setTimeout(() => setError(null), 5000)
      }
      
      // Reload subscription data to update UI
      const subscriptionResponse = await subscriptionsApi.get()
      setCancelAtPeriodEnd(subscriptionResponse.data?.cancel_at_period_end ?? false)
      setCurrentPeriodEnd(subscriptionResponse.data?.current_period_end ?? null)
      setCurrentPlan(subscriptionResponse.data?.tier as PlanCode | 'none' | null)
    } catch (err: any) {
      console.error('Failed to resume subscription:', err)
      setError(err?.message || 'Failed to resume subscription')
    } finally {
      setResuming(false)
    }
  }

  const canCancel = currentPlan && currentPlan !== 'none' && !cancelAtPeriodEnd
  const canResume = currentPlan && currentPlan !== 'none' && cancelAtPeriodEnd

  if (loading) {
    return (
      <ProtectedRoute>
        <AppBackground>
          <AppShell>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#F97316]" />
            </div>
          </AppShell>
        </AppBackground>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppBackground>
        <DashboardNavbar email={user?.email} onLogout={() => router.push('/logout')} />
        <AppShell>
          <PageSection>
            <PageHeader
              title="Change Plan"
              subtitle={
                currentPlan === 'none' || !currentPlan
                  ? 'Select a plan that works for you.'
                  : cancelAtPeriodEnd && currentPeriodEnd
                  ? `You're currently on the ${PLANS.find(p => p.code === currentPlan)?.name} plan. Cancels on ${new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
                  : `You're currently on the ${PLANS.find(p => p.code === currentPlan)?.name} plan.`
              }
            />
          </PageSection>

          {/* Cancel/Resume buttons - show above plan cards */}
          {(canCancel || canResume) && (
            <PageSection>
              <div className="space-y-4">
                {/* Show error/success message */}
                {error && (
                  <div className={`p-4 rounded-lg border ${
                    error.includes('successfully') || error.includes('scheduled')
                      ? 'bg-green-500/10 border-green-500/50 text-green-400'
                      : 'bg-red-500/10 border-red-500/50 text-red-400'
                  }`}>
                    <p className="text-sm text-center">{error}</p>
                  </div>
                )}
                
                <div className="flex gap-3 justify-center">
                  {canCancel && (
                    <Button
                      variant="secondary"
                      onClick={handleCancel}
                      disabled={canceling || resuming}
                      className="text-red-400 hover:text-red-300 border-red-400/50 hover:border-red-300/50"
                    >
                      {canceling ? 'Canceling...' : 'Cancel Plan'}
                    </Button>
                  )}
                  {canResume && (
                    <Button
                      variant="primary"
                      onClick={handleResume}
                      disabled={canceling || resuming}
                    >
                      {resuming ? 'Resuming...' : 'Resume Plan'}
                    </Button>
                  )}
                </div>
              </div>
            </PageSection>
          )}

          {/* No Plan Card */}
          {(!currentPlan || currentPlan === 'none') && (
            <PageSection>
              <GlassCard className="p-8 text-center">
                <h3 className="text-2xl font-semibold mb-2 text-white">No plan</h3>
                <p className="text-white/70 mb-6">
                  Start with Starter to unlock audits, exports, and compliance packs.
                </p>
                <Button
                  variant="primary"
                  onClick={() => handleSwitchPlan('starter')}
                  disabled={switching !== null}
                >
                  {switching === 'starter' ? 'Starting...' : 'Choose Starter Plan'}
                </Button>
              </GlassCard>
            </PageSection>
          )}

          {/* Plan Cards - only show if user has a plan */}
          {currentPlan && currentPlan !== 'none' && (
            <PageSection>
              <div className="grid md:grid-cols-3 gap-6">
                {PLANS.map((plan) => {
                  const isCurrent = plan.code === currentPlan
                  const isSwitching = switching === plan.code

                return (
                  <GlassCard
                    key={plan.code}
                    className={`p-8 relative ${
                      plan.popular
                        ? 'border-2 border-[#F97316] shadow-[0_0_40px_rgba(249,115,22,0.25)]'
                        : isCurrent
                        ? 'border-2 border-green-500'
                        : ''
                    }`}
                  >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#F97316] text-black text-xs font-semibold rounded-full">
                      Most Popular
                    </div>
                  )}
                  {plan.code === 'business' && !isCurrent && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-white/10 text-white text-xs font-semibold rounded-full border border-white/20">
                      Audit-Ready
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-4 right-4 px-3 py-1 bg-green-500 text-black text-xs font-semibold rounded-full">
                      Current Plan
                    </div>
                  )}

                  <h3 className="text-2xl font-semibold mb-2 mt-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold">{plan.priceLabel}</span>
                    <span className="text-white/60">/mo</span>
                  </div>
                  <p className="text-sm text-white/60 mb-6">{plan.description}</p>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-[#F97316] mr-2">✓</span>
                        <span className="text-white/70 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                    <Button
                      onClick={() => handleSwitchPlan(plan.code)}
                      disabled={isCurrent || isSwitching || switching !== null}
                      variant={isCurrent ? 'secondary' : plan.popular ? 'primary' : 'secondary'}
                      className={`w-full ${
                        isCurrent
                          ? 'border border-green-500 text-green-400 bg-green-500/10 hover:bg-green-500/20'
                          : ''
                      }`}
                    >
                      {isCurrent
                        ? 'Current Plan'
                        : isSwitching
                        ? 'Switching...'
                        : plan.code === 'starter' && currentPlan !== 'starter'
                        ? 'Switch to Starter'
                        : plan.code !== 'starter' && currentPlan === 'starter'
                        ? `Upgrade to ${plan.name}`
                        : `Switch to ${plan.name}`}
                    </Button>
                  </GlassCard>
                )
              })}
              </div>
            </PageSection>
          )}
        </AppShell>

        <ErrorModal
          isOpen={error !== null}
          title="Plan Switch Error"
          message={error || ''}
          onClose={() => setError(null)}
        />
      </AppBackground>
    </ProtectedRoute>
  )
}
