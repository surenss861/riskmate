'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { subscriptionsApi } from '@/lib/api'
import { ErrorModal } from '@/components/dashboard/ErrorModal'
import RiskMateLogo from '@/components/RiskMateLogo'

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
    price: 0,
    priceLabel: 'Free',
    description: 'Perfect for trying out RiskMate',
    features: [
      '3 jobs per month',
      '1 team seat (solo operator)',
      'Unlimited PDF reports',
      'Automatic risk scores',
      'Photo uploads',
      'Job timelines',
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    price: 29,
    priceLabel: '$29/mo',
    description: 'For small contractor crews',
    features: [
      'Everything in Starter',
      'Unlimited jobs',
      'Up to 5 team seats',
      'Team invites & activity tracking',
      'More photo storage',
      'Advanced controls list',
      'Job-level timeline logs',
    ],
    popular: true,
  },
  {
    code: 'business',
    name: 'Business',
    price: 129,
    priceLabel: '$129/mo',
    description: 'For established contractors',
    features: [
      'Everything in Pro',
      'Unlimited team seats',
      'Advanced team management',
      'Detailed hazard analytics',
      'Trend reports',
      'Unlimited photo storage',
      'Supervisor dashboard',
      'Priority support',
    ],
  },
]

export default function ChangePlanPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<PlanCode | null>(null)
  const [switching, setSwitching] = useState<PlanCode | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        const subscriptionResponse = await subscriptionsApi.get()
        const tier = subscriptionResponse.data?.tier as PlanCode | null
        const plan = tier || 'starter'
        setCurrentPlan(plan)

        // Track plan view and set user plan property
        if (typeof window !== 'undefined' && (window as any).posthog) {
          (window as any).posthog.capture('change_plan_page_viewed', {
            current_plan: plan,
          })
          // Set user plan as a property for all future events
          (window as any).posthog.identify(user?.id, {
            plan: plan,
            email: user?.email,
          })
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

    // Track plan switch attempt
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('plan_switch_initiated', {
        from_plan: currentPlan,
        to_plan: plan,
        is_upgrade: plan === 'pro' || plan === 'business',
        is_downgrade: plan === 'starter' && currentPlan !== 'starter',
      })
    }

    try {
      // If switching to starter (free), confirm cancellation
      if (plan === 'starter' && currentPlan !== 'starter') {
        if (!confirm('Switch to Starter (free) plan? Your subscription will be cancelled and you\'ll lose access to paid features.')) {
          setSwitching(null)
          // Track cancellation
          if (typeof window !== 'undefined' && (window as any).posthog) {
            (window as any).posthog.capture('plan_switch_cancelled', {
              from_plan: currentPlan,
              to_plan: plan,
            })
          }
          return
        }
      }

      const response = await subscriptionsApi.switchPlan(plan)
      
      if (response.url) {
        // Track redirect to checkout
        if (typeof window !== 'undefined' && (window as any).posthog) {
          (window as any).posthog.capture('plan_switch_checkout_redirect', {
            from_plan: currentPlan,
            to_plan: plan,
          })
        }
        // Redirect to Stripe checkout
        window.location.href = response.url
      } else if (response.success) {
        // Track successful plan switch
        if (typeof window !== 'undefined' && (window as any).posthog) {
          (window as any).posthog.capture('plan_switched', {
            from_plan: currentPlan,
            to_plan: plan,
          })
          // Update user plan property
          (window as any).posthog.identify(user?.id, {
            plan: plan,
            email: user?.email,
          })
        }
        // Plan switched successfully (e.g., to free)
        router.push('/dashboard/account')
      } else {
        throw new Error('Failed to switch plan')
      }
    } catch (err: any) {
      console.error('Failed to switch plan:', err)
      // Track plan switch error
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.capture('plan_switch_failed', {
          from_plan: currentPlan,
          to_plan: plan,
          error: err?.message || 'Unknown error',
        })
      }
      setError(err?.message || 'Failed to switch plan. Please try again.')
      setSwitching(null)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#F97316]" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#050505] text-white">
        <DashboardNavbar email={user?.email} onLogout={() => router.push('/logout')} />

        <div className="relative mx-auto max-w-7xl px-6 py-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-8"
          >
            <button
              onClick={() => router.push('/dashboard/account')}
              className="text-white/60 hover:text-white mb-4 flex items-center gap-2 transition-colors"
            >
              ← Back to Account
            </button>
            <h1 className="font-display text-4xl font-bold text-white">Change Plan</h1>
            <p className="text-white/60 mt-2">
              {currentPlan ? `You're currently on the ${PLANS.find(p => p.code === currentPlan)?.name} plan.` : 'Select a plan that works for you.'}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, index) => {
              const isCurrent = plan.code === currentPlan
              const isSwitching = switching === plan.code

              return (
                <motion.div
                  key={plan.code}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className={`bg-[#121212] border rounded-xl p-8 relative ${
                    plan.popular
                      ? 'border-2 border-[#F97316]'
                      : isCurrent
                      ? 'border-2 border-green-500'
                      : 'border-white/10'
                  }`}
                  style={plan.popular ? { boxShadow: '0 0 40px rgba(249, 115, 22, 0.25)' } : {}}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#F97316] text-black text-xs font-semibold rounded-full">
                      Most Popular
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
                    {plan.price > 0 && <span className="text-white/60">/mo</span>}
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

                  <button
                    onClick={() => handleSwitchPlan(plan.code)}
                    disabled={isCurrent || isSwitching || switching !== null}
                    className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isCurrent
                        ? 'border border-green-500 text-green-400 bg-green-500/10'
                        : plan.popular
                        ? 'bg-[#F97316] text-black hover:bg-[#FB923C]'
                        : 'border border-white/10 text-white hover:bg-white/10'
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
                  </button>
                </motion.div>
              )
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.45 }}
            className="mt-12 text-center"
          >
            <p className="text-white/60 mb-4">
              Need help choosing a plan? <a href="mailto:support@riskmate.com" className="text-[#F97316] hover:underline">Contact support</a>
            </p>
          </motion.div>
        </div>

        <ErrorModal
          isOpen={error !== null}
          title="Plan Switch Error"
          message={error || ''}
          onClose={() => setError(null)}
        />
      </div>
    </ProtectedRoute>
  )
}

