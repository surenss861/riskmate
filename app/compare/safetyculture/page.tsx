'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import Link from 'next/link'

export default function SafetyCultureComparisonPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <RiskMateLogo size="md" showText />
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/signup')}
              className="px-6 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
            >
              Start Free →
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 bg-[#F97316]/20 border border-[#F97316]/30 rounded-full text-[#F97316] text-sm font-medium mb-6">
            Comparison
          </div>
          <h1 className="text-5xl font-bold mb-6 font-display">
            Riskmate vs SafetyCulture
          </h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            Why contractors choose Riskmate over SafetyCulture for job-specific safety documentation and compliance reporting.
          </p>
        </motion.div>

        {/* Quick Comparison */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="bg-[#121212] rounded-xl border border-white/10 p-8 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-4 pr-8 font-semibold">Feature</th>
                  <th className="pb-4 px-8 font-semibold text-center">Riskmate</th>
                  <th className="pb-4 px-8 font-semibold text-center">SafetyCulture</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  { feature: 'Built for contractors', riskmate: '✅ Purpose-built for service contractors', safetyculture: '❌ Generic safety platform' },
                  { feature: 'Job-specific documentation', riskmate: '✅ Complete job workflows (before/during/after)', safetyculture: '⚠️ Generic checklists only' },
                  { feature: 'Automatic risk scoring', riskmate: '✅ AI-powered risk calculation', safetyculture: '❌ Manual assessment' },
                  { feature: 'PDF report generation', riskmate: '✅ One-click branded PDFs', safetyculture: '⚠️ Basic reports, limited customization' },
                  { feature: 'Permit Pack Generator', riskmate: '✅ ZIP bundles (Business plan)', safetyculture: '❌ Not available' },
                  { feature: 'Pricing (monthly)', riskmate: '$29-$129/mo', safetyculture: '$24-$99/user/mo' },
                  { feature: 'Team seats', riskmate: '1-5 seats (Pro), Unlimited (Business)', safetyculture: 'Per-user pricing' },
                  { feature: 'Contractor-focused', riskmate: '✅ Electrical, roofing, HVAC, renovation', safetyculture: '⚠️ All industries' },
                  { feature: 'Offline mobile support', riskmate: '✅ Coming soon', safetyculture: '✅ Available' },
                  { feature: 'Setup time', riskmate: '5 minutes', safetyculture: 'Hours of configuration' },
                ].map((row, index) => (
                  <tr key={index} className="border-b border-white/5">
                    <td className="py-4 pr-8 font-medium">{row.feature}</td>
                    <td className="py-4 px-8 text-center text-green-400">{row.riskmate}</td>
                    <td className="py-4 px-8 text-center text-white/40">{row.safetyculture}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Why Riskmate */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">Why Contractors Choose Riskmate</h2>
          <div className="space-y-6">
            {[
              {
                title: 'Built Specifically for Service Contractors',
                description: 'Riskmate is purpose-built for electrical, roofing, HVAC, and renovation contractors. SafetyCulture is a generic platform trying to serve everyone—from factories to offices to construction sites. Riskmate understands your workflow.',
              },
              {
                title: 'Job-Centric, Not Checklist-Centric',
                description: 'Riskmate organizes everything around jobs (before, during, after). SafetyCulture is checklist-focused, which doesn\'t match how contractors actually work. You think in jobs, not generic safety audits.',
              },
              {
                title: 'Automatic Risk Scoring',
                description: 'Riskmate automatically calculates risk scores based on hazards you identify. SafetyCulture requires manual risk assessment. Riskmate saves time and ensures consistency.',
              },
              {
                title: 'Professional PDF Reports',
                description: 'Riskmate generates branded, audit-ready PDF reports in one click. SafetyCulture reports are basic and require customization. Your clients and insurers need professional documentation.',
              },
              {
                title: 'Better Pricing for Small Teams',
                description: 'Riskmate starts at $29/month for your business (not per user). SafetyCulture charges $24-99 per user per month. For a 5-person team, that\'s $120-495/month vs Riskmate\'s $59/month (Pro plan).',
              },
              {
                title: 'Faster Setup',
                description: 'Riskmate works out of the box. SafetyCulture requires hours of configuration, custom form building, and workflow setup. Riskmate gets you documenting jobs in 5 minutes.',
              },
            ].map((item, index) => (
              <div key={index} className="p-6 bg-[#121212] rounded-xl border border-white/10">
                <h3 className="text-xl font-semibold mb-2 text-[#F97316]">{item.title}</h3>
                <p className="text-white/70">{item.description}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* When to Use Each */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">When to Use Each</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-br from-[#F97316]/10 to-transparent rounded-xl border border-[#F97316]/20">
              <h3 className="text-xl font-semibold mb-4 text-[#F97316]">Choose Riskmate If:</h3>
              <ul className="space-y-3 text-white/80">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>You&apos;re a service contractor (electrical, roofing, HVAC, renovation)</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>You need job-specific documentation (not generic checklists)</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>You want automatic risk scoring and PDF generation</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>You have a small team (1-15 people) and want affordable pricing</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>You need something that works immediately (no configuration)</span>
                </li>
              </ul>
            </div>
            <div className="p-6 bg-[#121212] rounded-xl border border-white/10">
              <h3 className="text-xl font-semibold mb-4">Choose SafetyCulture If:</h3>
              <ul className="space-y-3 text-white/60">
                <li className="flex items-start gap-3">
                  <span className="text-white/40 mt-0.5">•</span>
                  <span>You run a large enterprise with complex safety programs</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-white/40 mt-0.5">•</span>
                  <span>You need extensive customization and workflow building</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-white/40 mt-0.5">•</span>
                  <span>You have budget for per-user pricing ($24-99/user/month)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-white/40 mt-0.5">•</span>
                  <span>You need advanced analytics and reporting dashboards</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-white/40 mt-0.5">•</span>
                  <span>You&apos;re not primarily a service contractor</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center bg-[#121212] rounded-xl border border-white/10 p-12"
        >
          <h2 className="text-3xl font-bold mb-4 font-display">Ready to try Riskmate?</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            See why contractors choose Riskmate over SafetyCulture for job-specific safety documentation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/signup')}
              className="px-8 py-4 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => router.push('/demo')}
              className="px-8 py-4 border border-white/10 hover:border-white/20 text-white rounded-lg font-semibold transition-colors"
            >
              See Live Demo
            </button>
          </div>
        </motion.section>
      </main>
    </div>
  )
}

