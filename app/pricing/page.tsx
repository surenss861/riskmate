'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import { ErrorModal } from '@/components/dashboard/ErrorModal'
import { subscriptionsApi } from '@/lib/api'

type PlanCode = 'starter' | 'pro' | 'business'

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async (plan: PlanCode) => {
    setLoading(plan)
    try {
      const response = await subscriptionsApi.createCheckoutSession({
        plan,
        success_url: `${window.location.origin}/pricing/thank-you`,
        cancel_url: `${window.location.origin}/pricing/cancelled`,
      })
      window.location.href = response.url
    } catch (err: any) {
      console.error('Failed to create checkout session:', err)
      setError(err?.message || 'API request failed')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <RiskMateLogo size="md" showText />
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/login')}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Sign In
            </button>
            <button
              onClick={() => router.push('/signup')}
              className="rounded-lg bg-[#F97316] px-6 py-3 text-sm text-black font-semibold hover:bg-[#FB923C]"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <motion.h1
            className="text-5xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Simple, Transparent Pricing
          </motion.h1>
          <motion.p
            className="text-xl text-white/60"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            For teams that need audit-proof compliance.
          </motion.p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {/* Starter */}
          <motion.div
            className="bg-[#121212] border border-white/10 rounded-xl p-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ y: -3 }}
          >
            <h3 className="text-2xl font-semibold mb-2">Starter</h3>
            <div className="mb-2">
              <span className="text-4xl font-bold">$29</span>
              <span className="text-white/60">/mo</span>
            </div>
            <p className="text-sm text-white/60 mb-6">per business</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">10 jobs per month</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">1 team seat</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Automatic risk scores</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Shareable job reports</span>
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('starter')}
              disabled={loading !== null}
              className="w-full px-6 py-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors font-semibold disabled:opacity-50"
            >
              {loading === 'starter' ? 'Processing...' : 'Get Started'}
            </button>
          </motion.div>

          {/* Pro */}
          <motion.div
            className="bg-[#121212] border-2 border-[#F97316] rounded-xl p-8 relative"
            style={{ boxShadow: '0 0 40px rgba(249, 115, 22, 0.25)' }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            whileHover={{ y: -3 }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#F97316] text-black text-xs font-semibold rounded-full">
              Most Popular
            </div>
            <h3 className="text-2xl font-semibold mb-2 mt-2">Pro</h3>
            <div className="mb-2">
              <span className="text-4xl font-bold">$59</span>
              <span className="text-white/60">/mo</span>
            </div>
            <p className="text-sm text-white/60 mb-6">per business</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Unlimited jobs</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Up to 5 team seats</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Branded PDFs</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Email notifications</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Shareable job reports</span>
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('pro')}
              disabled={loading !== null}
              className="w-full px-6 py-3 bg-[#F97316] text-black rounded-lg font-semibold hover:bg-[#FB923C] disabled:opacity-50"
            >
              {loading === 'pro' ? 'Processing...' : 'Get Started'}
            </button>
          </motion.div>

          {/* Business */}
          <motion.div
            className="bg-[#121212] border border-white/10 rounded-xl p-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ y: -3 }}
          >
            <h3 className="text-2xl font-semibold mb-2">Business</h3>
            <div className="mb-2">
              <span className="text-4xl font-bold">$129</span>
              <span className="text-white/60">/mo</span>
            </div>
            <p className="text-sm text-white/60 mb-6">per business</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Unlimited jobs</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Unlimited team seats</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Everything in Pro</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Advanced analytics</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Permit Pack</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Versioned audit logs</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Priority support</span>
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('business')}
              disabled={loading !== null}
              className="w-full px-6 py-3 border border-[#F97316] text-[#F97316] rounded-lg hover:bg-[#F97316]/10 transition-colors font-semibold disabled:opacity-50"
            >
              {loading === 'business' ? 'Processing...' : 'Get Started'}
            </button>
          </motion.div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Can I change plans later?</h3>
              <p className="text-white/70">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">What happens if I exceed my job limit?</h3>
              <p className="text-white/70">You&apos;ll be notified when you&apos;re approaching your limit. Upgrade your plan to continue creating jobs.</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-white/60 mb-6">Choose a plan above to begin your subscription.</p>
          <button
            onClick={() => router.push('/signup')}
            className="rounded-lg bg-[#F97316] px-8 py-4 text-black font-semibold hover:bg-[#FB923C] text-lg"
          >
            Create Account
          </button>
        </div>
      </main>

      {/* Error Modal */}
      <ErrorModal
        isOpen={error !== null}
        title="Checkout Error"
        message={error || ''}
        onClose={() => setError(null)}
      />
    </div>
  )
}

