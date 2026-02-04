'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskmateLogo from '@/components/RiskmateLogo'
import Link from 'next/link'

export default function PenAndPaperComparisonPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <RiskmateLogo size="md" showText />
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
            Riskmate vs Pen & Paper
          </h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            Stop losing paperwork, scrambling for photos, and spending hours creating reports. Here&apos;s why contractors switch from pen & paper to Riskmate.
          </p>
        </motion.div>

        {/* The Problem with Pen & Paper */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">The Problem with Pen & Paper</h2>
          <div className="bg-[#121212] rounded-xl border border-white/10 p-8">
            <ul className="space-y-4 text-white/80">
              {[
                'Forms get lost, damaged, or left on-site',
                'Photos scattered across phones, iMessage, and email',
                'No way to search or organize past jobs',
                'Manual report creation takes 2-3 hours per job',
                'No audit trail when clients question safety months later',
                'Can\'t share with clients, insurers, or auditors easily',
                'No automatic risk scoring or mitigation suggestions',
                'Paper forms don\'t work in rain, wind, or dirty conditions',
              ].map((problem, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-red-400 mt-1">✗</span>
                  <span>{problem}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        {/* Side-by-Side Comparison */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">Pen & Paper vs Riskmate</h2>
          <div className="space-y-6">
            {[
              {
                task: 'Document hazards on-site',
                paper: 'Fill out paper form, hope it doesn\'t get lost',
                riskmate: 'Complete digital checklist on phone, automatically saved',
              },
              {
                task: 'Take photos',
                paper: 'Photos in phone camera roll, iMessage, or email—hard to find later',
                riskmate: 'Photos automatically linked to job, timestamped, organized',
              },
              {
                task: 'Calculate risk score',
                paper: 'Manual calculation or guesswork',
                riskmate: 'Automatic AI-powered risk scoring',
              },
              {
                task: 'Create client report',
                paper: '2-3 hours in Word, compiling photos and forms',
                riskmate: '30 seconds—one-click PDF generation',
              },
              {
                task: 'Share with client',
                paper: 'Email large files, hope they don\'t bounce',
                riskmate: 'Share secure link or download PDF instantly',
              },
              {
                task: 'Find old job documentation',
                paper: 'Search through filing cabinets or hope you saved it',
                riskmate: 'Search by client, date, location, or job type—instant',
              },
              {
                task: 'Audit trail',
                paper: 'None—hope you kept the paperwork',
                riskmate: 'Complete version history, timestamps, and compliance logs',
              },
            ].map((item, index) => (
              <div key={index} className="p-6 bg-[#121212] rounded-xl border border-white/10">
                <h3 className="text-lg font-semibold mb-4">{item.task}</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-red-400 font-medium mb-2">Pen & Paper</div>
                    <p className="text-sm text-white/60">{item.paper}</p>
                  </div>
                  <div>
                    <div className="text-sm text-green-400 font-medium mb-2">Riskmate</div>
                    <p className="text-sm text-white/80">{item.riskmate}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Cost Comparison */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">The Real Cost of Pen & Paper</h2>
          <div className="bg-gradient-to-br from-[#F97316]/10 to-transparent rounded-xl border border-[#F97316]/20 p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4 text-[#F97316]">Hidden Costs</h3>
                <ul className="space-y-3 text-white/80">
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 mt-1">•</span>
                    <span><strong>Time:</strong> 2-3 hours per job creating reports manually</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 mt-1">•</span>
                    <span><strong>Lost jobs:</strong> Can&apos;t find documentation when clients ask</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 mt-1">•</span>
                    <span><strong>Liability:</strong> No audit trail if safety is questioned</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 mt-1">•</span>
                    <span><strong>Stress:</strong> Scrambling to recreate lost paperwork</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4 text-[#F97316]">Riskmate Cost</h3>
                <ul className="space-y-3 text-white/80">
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-1">✓</span>
                    <span><strong>$29/month</strong> (Starter) - 3 jobs/month</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-1">✓</span>
                    <span><strong>$59/month</strong> (Pro) - Unlimited jobs, 5 seats</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-1">✓</span>
                    <span><strong>Time saved:</strong> 2+ hours per job = $100+ value</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-1">✓</span>
                    <span><strong>ROI:</strong> Pays for itself after 1-2 jobs per month</span>
                  </li>
                </ul>
              </div>
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
          <h2 className="text-3xl font-bold mb-4 font-display">Ready to leave pen & paper behind?</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            Join contractors who switched from paper forms to Riskmate and never looked back.
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

