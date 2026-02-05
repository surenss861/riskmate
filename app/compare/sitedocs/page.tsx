'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import Link from 'next/link'

export default function SiteDocsComparisonPage() {
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
            Riskmate vs SiteDocs
          </h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            Why contractors choose Riskmate over SiteDocs for streamlined job documentation and compliance reporting.
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
                  <th className="pb-4 px-8 font-semibold text-center">SiteDocs</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  { feature: 'Job-specific workflows', riskmate: '✅ Complete job lifecycle', sitedocs: '⚠️ Document-focused' },
                  { feature: 'Automatic risk scoring', riskmate: '✅ AI-powered calculation', sitedocs: '❌ Manual only' },
                  { feature: 'PDF report generation', riskmate: '✅ One-click branded PDFs', sitedocs: '⚠️ Basic reports' },
                  { feature: 'Permit Pack Generator', riskmate: '✅ ZIP bundles (Business)', sitedocs: '❌ Not available' },
                  { feature: 'Pricing (monthly)', riskmate: '$29-$129/mo per business', sitedocs: '$49-$149/user/mo' },
                  { feature: 'Setup complexity', riskmate: '5 minutes', sitedocs: 'Hours of configuration' },
                  { feature: 'Contractor-focused', riskmate: '✅ Built for service contractors', sitedocs: '⚠️ General construction' },
                  { feature: 'Mobile app', riskmate: '✅ Coming soon', sitedocs: '✅ Available' },
                  { feature: 'Offline mode', riskmate: '✅ Coming soon', sitedocs: '✅ Available' },
                  { feature: 'Team collaboration', riskmate: '✅ Real-time job updates', sitedocs: '✅ Document sharing' },
                ].map((row, index) => (
                  <tr key={index} className="border-b border-white/5">
                    <td className="py-4 pr-8 font-medium">{row.feature}</td>
                    <td className="py-4 px-8 text-center text-green-400">{row.riskmate}</td>
                    <td className="py-4 px-8 text-center text-white/40">{row.sitedocs}</td>
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
                title: 'Job-Centric, Not Document-Centric',
                description: 'Riskmate organizes everything around jobs (before, during, after). SiteDocs is document-focused, which means you\'re managing files instead of jobs. Riskmate matches how contractors actually think and work.',
              },
              {
                title: 'Automatic Risk Scoring',
                description: 'Riskmate automatically calculates risk scores based on hazards. SiteDocs requires manual risk assessment. Riskmate saves time and ensures consistency across all jobs.',
              },
              {
                title: 'Better Pricing Model',
                description: 'Riskmate charges per business ($29-129/month), not per user. SiteDocs charges $49-149 per user per month. For a 5-person team, that\'s $245-745/month vs Riskmate\'s $59/month (Pro plan).',
              },
              {
                title: 'Faster Setup',
                description: 'Riskmate works immediately—no configuration needed. SiteDocs requires setting up document templates, workflows, and user permissions. Riskmate gets you documenting jobs in 5 minutes.',
              },
              {
                title: 'Purpose-Built for Service Contractors',
                description: 'Riskmate is built specifically for electrical, roofing, HVAC, and renovation contractors. SiteDocs is a general construction document management tool. Riskmate understands your specific workflow.',
              },
            ].map((item, index) => (
              <div key={index} className="p-6 bg-[#121212] rounded-xl border border-white/10">
                <h3 className="text-xl font-semibold mb-2 text-[#F97316]">{item.title}</h3>
                <p className="text-white/70">{item.description}</p>
              </div>
            ))}
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
            See why contractors choose Riskmate over SiteDocs for job-specific safety documentation.
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

