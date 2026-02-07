'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskmateLogo from '@/components/RiskmateLogo'
import Link from 'next/link'
import Image from 'next/image'

export default function ElectricalCaseStudyPage() {
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
              onClick={() => router.push('/sample-report')}
              className="px-4 py-2 border border-white/10 hover:border-white/20 rounded-lg transition-colors text-sm"
            >
              View Sample Report
            </button>
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
            Electrical Contractor Case Study
          </div>
          <h1 className="text-5xl font-bold mb-6 font-display">
            How an Electrical Contractor Uses Riskmate for Commercial Installations
          </h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            See how James, an electrical contractor in Toronto, documents high-risk commercial electrical work with Riskmate—from hazard identification to client-ready reports.
          </p>
        </motion.div>

        {/* The Challenge */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">The Challenge</h2>
          <div className="bg-[#121212] rounded-xl border border-white/10 p-8">
            <p className="text-lg text-white/80 leading-relaxed mb-4">
              James runs a 5-person electrical contracting company specializing in commercial installations. Before Riskmate, he was:
            </p>
            <ul className="space-y-3 text-white/70">
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>Taking photos in iMessage, losing them, then scrambling to recreate reports when clients asked</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>Filling out paper hazard forms that got lost or damaged on-site</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>Spending 2-3 hours per job creating PDF reports manually in Word</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>No audit trail when clients questioned safety protocols months later</span>
              </li>
            </ul>
          </div>
        </motion.section>

        {/* Sample Job */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">Sample High-Risk Job: Commercial Panel Upgrade</h2>
          <div className="bg-[#121212] rounded-xl border border-white/10 p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">Job Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-[#A1A1A1]">Client:</span>
                    <span className="ml-2 text-white">ABC Manufacturing Inc.</span>
                  </div>
                  <div>
                    <span className="text-[#A1A1A1]">Location:</span>
                    <span className="ml-2 text-white">Toronto, ON - Industrial Facility</span>
                  </div>
                  <div>
                    <span className="text-[#A1A1A1]">Job Type:</span>
                    <span className="ml-2 text-white">Main Electrical Panel Upgrade</span>
                  </div>
                  <div>
                    <span className="text-[#A1A1A1]">Risk Score:</span>
                    <span className="ml-2 text-[#F97316] font-bold text-lg">78 (HIGH RISK)</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">Risk Factors Detected</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                    <span>Live electrical work (480V)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    <span>Confined space access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    <span>Overhead work required</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    <span>Multiple subcontractors on-site</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Sample Hazards */}
            <div className="border-t border-white/10 pt-8">
              <h3 className="text-xl font-semibold mb-4">Hazards Identified & Documented</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  {
                    hazard: 'Exposed live conductors',
                    severity: 'Critical',
                    mitigation: 'Lockout/tagout procedures verified, PPE required',
                    photo: 'Before: Exposed panel',
                  },
                  {
                    hazard: 'Limited egress in electrical room',
                    severity: 'High',
                    mitigation: 'Clear exit path maintained, emergency lighting checked',
                    photo: 'During: Work in progress',
                  },
                  {
                    hazard: 'Arc flash risk during panel connection',
                    severity: 'High',
                    mitigation: 'Arc-rated PPE, de-energized where possible',
                    photo: 'After: Completed installation',
                  },
                ].map((item, index) => (
                  <div key={index} className="p-4 bg-black/20 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.severity === 'Critical' ? 'bg-red-500/20 text-red-400' :
                        item.severity === 'High' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {item.severity}
                      </span>
                      <span className="text-sm font-semibold">{item.hazard}</span>
                    </div>
                    <p className="text-sm text-white/70 mb-2">{item.mitigation}</p>
                    <p className="text-xs text-[#A1A1A1] italic">{item.photo}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* The Solution */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">How Riskmate Solved It</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: 'Before the job',
                action: 'James completes the hazard checklist on his phone. Riskmate automatically calculates a risk score of 78 (HIGH RISK) and generates 12 required mitigations.',
                time: '5 minutes',
              },
              {
                step: 'During the job',
                action: 'James and his team take photos of exposed panels, lockout procedures, and completed work. Everything is timestamped and linked to the job automatically.',
                time: '2 minutes',
              },
              {
                step: 'After the job',
                action: 'James clicks "Generate Report" and gets a professional PDF with all hazards, mitigations, photos, and signatures—ready to send to the client.',
                time: '30 seconds',
              },
            ].map((item, index) => (
              <div key={index} className="p-6 bg-[#121212] rounded-xl border border-white/10">
                <div className="w-12 h-12 rounded-lg bg-[#F97316]/20 flex items-center justify-center text-2xl font-bold text-[#F97316] mb-4">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.step}</h3>
                <p className="text-sm text-white/70 mb-4">{item.action}</p>
                <div className="text-xs text-[#A1A1A1] bg-black/20 px-3 py-1 rounded inline-block">
                  {item.time}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Results */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">The Results</h2>
          <div className="bg-gradient-to-br from-[#F97316]/10 to-transparent rounded-xl border border-[#F97316]/20 p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4 text-[#F97316]">Time Saved</h3>
                <ul className="space-y-3 text-white/80">
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Report generation: <strong>2.5 hours → 30 seconds</strong></span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Photo organization: <strong>Manual → Automatic</strong></span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Client approvals: <strong>Faster with professional PDFs</strong></span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4 text-[#F97316]">Business Impact</h3>
                <ul className="space-y-3 text-white/80">
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Zero lost photos or documents</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Complete audit trail for insurance</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Clients trust the professional documentation</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Sample PDF Preview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">Sample PDF Report</h2>
          <div className="bg-[#121212] rounded-xl border border-white/10 p-8">
            <p className="text-white/70 mb-6">
              Here&apos;s what the client receives—a professional, audit-ready PDF report generated automatically by Riskmate.
            </p>
            <div className="bg-black/20 rounded-lg p-6 border border-white/5 mb-6">
              <div className="aspect-[8.5/11] bg-white/5 rounded border border-white/10 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-[#F97316]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p className="text-white/60 text-sm">PDF Preview</p>
                  <p className="text-white/40 text-xs mt-2">Sample Risk Report - Commercial Panel Upgrade</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push('/sample-report')}
              className="w-full px-8 py-4 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Sample PDF Report
            </button>
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
          <h2 className="text-3xl font-bold mb-4 font-display">Ready to document your electrical work like this?</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            Join electrical contractors across Canada who use Riskmate to create professional, audit-ready safety documentation.
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

