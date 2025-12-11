'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import { ErrorModal } from '@/components/dashboard/ErrorModal'
import { subscriptionsApi } from '@/lib/api'
import { cardStyles, buttonStyles } from '@/lib/styles/design-system'

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
            className={`${cardStyles.base} ${cardStyles.padding.lg}`}
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
                <span className="text-white/70">Automatic risk scores</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Branded watermark PDFs</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Shareable job reports (view-only links)</span>
              </li>
            </ul>
            <button
              onClick={() => router.push('/signup')}
              className="w-full px-6 py-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors font-semibold"
            >
              Start Free
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
                <span className="text-white/70">Branded PDFs + notifications</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Live reports + client share links</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Priority email support</span>
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('pro')}
              disabled={loading !== null}
              className="w-full px-6 py-3 bg-[#F97316] text-black rounded-lg font-semibold hover:bg-[#FB923C] disabled:opacity-50"
            >
              {loading === 'pro' ? 'Processing...' : 'Get Started →'}
            </button>
          </motion.div>

          {/* Business */}
          <motion.div
            className="bg-[#121212] border border-white/10 rounded-xl p-8 relative"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ y: -3 }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-white/10 text-white text-xs font-semibold rounded-full border border-white/20">
              Audit-Ready
            </div>
            <h3 className="text-2xl font-semibold mb-2 mt-2">Business</h3>
            <div className="mb-2">
              <span className="text-4xl font-bold">$129</span>
              <span className="text-white/60">/mo</span>
            </div>
            <p className="text-sm text-white/60 mb-6">per business</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Unlimited seats</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Permit Pack Generator (ZIP bundle)</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Org-level dashboard analytics</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Versioned audit logs (compliance history)</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white/70">Dedicated onboarding & phone support</span>
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('business')}
              disabled={loading !== null}
              className="w-full px-6 py-3 border border-[#F97316] text-[#F97316] rounded-lg hover:bg-[#F97316]/10 transition-colors font-semibold disabled:opacity-50"
            >
              {loading === 'business' ? 'Processing...' : 'Upgrade to Business →'}
            </button>
            <p className="text-xs text-white/50 mt-2 text-center">Get advanced compliance & support</p>
          </motion.div>
        </div>

        {/* Feature Comparison Table */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Compare Plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-white/80 font-semibold">Feature</th>
                  <th className="text-center p-4 text-white/80 font-semibold">Starter</th>
                  <th className="text-center p-4 text-white/80 font-semibold">Pro</th>
                  <th className="text-center p-4 text-white/80 font-semibold">Business</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white/70">Jobs per month</td>
                  <td className="p-4 text-center text-white/70">3</td>
                  <td className="p-4 text-center text-white/70">Unlimited</td>
                  <td className="p-4 text-center text-white/70">Unlimited</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white/70">Team seats</td>
                  <td className="p-4 text-center text-white/70">1</td>
                  <td className="p-4 text-center text-white/70">5</td>
                  <td className="p-4 text-center text-white/70">Unlimited</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white/70">Risk scoring engine</td>
                  <td className="p-4 text-center text-[#F97316]">✓</td>
                  <td className="p-4 text-center text-[#F97316]">✓</td>
                  <td className="p-4 text-center text-[#F97316]">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white/70">PDF reports</td>
                  <td className="p-4 text-center text-white/70">Watermarked</td>
                  <td className="p-4 text-center text-[#F97316]">Branded</td>
                  <td className="p-4 text-center text-[#F97316]">Branded</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white/70">Live report links</td>
                  <td className="p-4 text-center text-white/40">—</td>
                  <td className="p-4 text-center text-[#F97316]">✓</td>
                  <td className="p-4 text-center text-[#F97316]">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white/70">Priority support</td>
                  <td className="p-4 text-center text-white/40">—</td>
                  <td className="p-4 text-center text-white/70">Email</td>
                  <td className="p-4 text-center text-[#F97316]">Dedicated</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white/70">Permit Pack Generator</td>
                  <td className="p-4 text-center text-white/40">—</td>
                  <td className="p-4 text-center text-white/40">—</td>
                  <td className="p-4 text-center text-[#F97316]">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white/70">Audit log versioning</td>
                  <td className="p-4 text-center text-white/40">—</td>
                  <td className="p-4 text-center text-white/40">—</td>
                  <td className="p-4 text-center text-[#F97316]">✓</td>
                </tr>
                <tr>
                  <td className="p-4 text-white/70">Organization analytics</td>
                  <td className="p-4 text-center text-white/40">—</td>
                  <td className="p-4 text-center text-white/40">—</td>
                  <td className="p-4 text-center text-[#F97316]">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">What Contractors Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6"
            >
              <p className="text-white/80 mb-4 italic">
                &quot;RiskMate cut my reporting time in half. Clients love the PDFs.&quot;
              </p>
              <p className="text-sm text-white/60">— James L., Electrical Contractor</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6"
            >
              <p className="text-white/80 mb-4 italic">
                &quot;The Permit Pack feature pays for itself every week.&quot;
              </p>
              <p className="text-sm text-white/60">— Hector R., Roofing Company Owner</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6"
            >
              <p className="text-white/80 mb-4 italic">
                &quot;My team actually follows safety now because it&apos;s so easy.&quot;
              </p>
              <p className="text-sm text-white/60">— Carla M., HVAC Supervisor</p>
            </motion.div>
          </div>
        </div>

        {/* ROI Calculator */}
        <div className="mb-16 bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-3xl font-bold text-center mb-4">See How Much RiskMate Saves Your Business</h2>
          <p className="text-center text-white/60 mb-8">
            RiskMate reduces job documentation time by 40–60% per job. Fewer safety mistakes = fewer client disputes.
          </p>
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <label className="block text-sm text-white/70 mb-2">Jobs per month</label>
              <input
                type="number"
                defaultValue="10"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Avg time wasted on paperwork (hours per job)</label>
              <input
                type="number"
                defaultValue="2"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Hourly labor cost ($)</label>
              <input
                type="number"
                defaultValue="50"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
            <div className="pt-4 border-t border-white/10">
              <div className="text-center">
                <p className="text-sm text-white/60 mb-2">Estimated monthly savings</p>
                <p className="text-4xl font-bold text-[#F97316]">$400+</p>
                <p className="text-xs text-white/50 mt-2">
                  Permit Packs help close projects 30% faster.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Can I use RiskMate as a solo contractor?</h3>
              <p className="text-white/70">Absolutely! The Starter plan is perfect for solo contractors. You get 3 jobs per month, automatic risk scoring, and branded PDF reports—everything you need to document your work professionally.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Can I invite subcontractors?</h3>
              <p className="text-white/70">Yes! Pro and Business plans allow you to invite team members. Subcontractors can be added as team members with appropriate permissions. They can document hazards, upload photos, and complete mitigations—all tracked under your organization.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Does every worker need a login?</h3>
              <p className="text-white/70">No. You can document jobs yourself, or invite team members as needed. On the Starter plan, you get 1 seat. Pro gives you up to 5 seats, and Business offers unlimited seats for larger crews.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Are my job reports private?</h3>
              <p className="text-white/70">Yes. All your data is encrypted and stored securely. Each organization&apos;s data is completely isolated. You control who sees your reports—share them with clients via secure links, or keep them private for your records.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Is this tax-deductible?</h3>
              <p className="text-white/70">Yes! RiskMate is a business expense and is tax-deductible for contractors. It&apos;s a software tool for safety documentation and compliance, which qualifies as a business expense in Canada and the US.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Can I change plans later?</h3>
              <p className="text-white/70">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately. If you upgrade mid-month, you&apos;ll be prorated. If you downgrade, you&apos;ll keep access until the end of your billing period.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">What happens if I exceed my job limit?</h3>
              <p className="text-white/70">You&apos;ll be notified when you&apos;re approaching your limit. On the Starter plan (3 jobs/month), you can upgrade to Pro for unlimited jobs. We never delete your data—you just need to upgrade to continue creating new jobs.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Can I export my data?</h3>
              <p className="text-white/70">Yes. You can download PDF reports for any job at any time. Business plan users can also generate Permit Pack ZIP files that include all job documents, photos, and reports in one bundle.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Do you offer refunds?</h3>
              <p className="text-white/70">We offer a satisfaction guarantee. If you&apos;re not happy with RiskMate within the first 30 days, contact us and we&apos;ll work with you to make it right or provide a refund.</p>
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

