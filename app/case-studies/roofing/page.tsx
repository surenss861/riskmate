'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import Link from 'next/link'

export default function RoofingCaseStudyPage() {
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
            Roofing Contractor Case Study
          </div>
          <h1 className="text-5xl font-bold mb-6 font-display">
            How a Roofing Company Uses RiskMate for High-Rise Repairs
          </h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            See how Hector&apos;s roofing company documents fall protection, weather hazards, and permit compliance for commercial roof repairs—all in one place.
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
              Hector runs a 12-person roofing company specializing in commercial flat roofs. Before RiskMate:
            </p>
            <ul className="space-y-3 text-white/70">
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>Permit packs required compiling 20+ documents from different folders</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>Fall protection documentation scattered across paper forms and photos</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>Weather delays meant re-doing entire documentation packages</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>Inspectors asking for specific photos that were lost or never taken</span>
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
          <h2 className="text-3xl font-bold mb-6">Sample High-Risk Job: Commercial Flat Roof Replacement</h2>
          <div className="bg-[#121212] rounded-xl border border-white/10 p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">Job Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-[#A1A1A1]">Client:</span>
                    <span className="ml-2 text-white">Metro Office Complex</span>
                  </div>
                  <div>
                    <span className="text-[#A1A1A1]">Location:</span>
                    <span className="ml-2 text-white">Vancouver, BC - 8-Story Building</span>
                  </div>
                  <div>
                    <span className="text-[#A1A1A1]">Job Type:</span>
                    <span className="ml-2 text-white">EPDM Membrane Replacement</span>
                  </div>
                  <div>
                    <span className="text-[#A1A1A1]">Risk Score:</span>
                    <span className="ml-2 text-red-400 font-bold text-lg">85 (CRITICAL RISK)</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">Risk Factors Detected</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                    <span>Fall from height (8 stories)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                    <span>Weather exposure (wind, rain)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    <span>Heavy equipment operation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    <span>Permit compliance required</span>
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
                    hazard: 'Fall from height (8 stories)',
                    severity: 'Critical',
                    mitigation: 'Guardrails installed, fall arrest systems verified, safety harnesses required',
                    photo: 'Before: Edge protection setup',
                  },
                  {
                    hazard: 'Weather exposure (wind gusts)',
                    severity: 'High',
                    mitigation: 'Daily weather checks, work suspended if winds exceed 40 km/h',
                    photo: 'During: Weather monitoring',
                  },
                  {
                    hazard: 'Permit compliance documentation',
                    severity: 'High',
                    mitigation: 'All permits verified, inspector sign-offs documented, photos timestamped',
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
          <h2 className="text-3xl font-bold mb-6">How RiskMate Solved It</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: 'Before the job',
                action: 'Hector documents fall protection setup, weather conditions, and permit requirements. RiskMate calculates risk score of 85 (CRITICAL) and generates 15 required safety controls.',
                time: '8 minutes',
              },
              {
                step: 'During the job',
                action: 'Team members take photos of guardrails, safety equipment, and work progress. Everything is automatically timestamped and linked to the job. Weather conditions logged daily.',
                time: '3 minutes/day',
              },
              {
                step: 'After the job',
                action: 'Hector generates a Permit Pack (ZIP file) with PDF report, all photos, permits, and compliance logs—ready for inspector review. No more scrambling for documents.',
                time: '1 minute',
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
                    <span>Permit Pack creation: <strong>4 hours → 1 minute</strong></span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Inspector documentation: <strong>Complete & organized</strong></span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Weather logging: <strong>Automatic timestamps</strong></span>
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
                    <span>Inspectors approve faster with organized documentation</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Zero lost permits or compliance documents</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Permit Pack feature pays for itself weekly</span>
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
          <h2 className="text-3xl font-bold mb-4 font-display">Ready to streamline your roofing documentation?</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            Join roofing companies across Canada who use RiskMate to create professional permit packs and compliance documentation.
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

