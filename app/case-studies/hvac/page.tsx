'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import Link from 'next/link'

export default function HVACCaseStudyPage() {
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
            HVAC Contractor Case Study
          </div>
          <h1 className="text-5xl font-bold mb-6 font-display">
            How an HVAC Company Uses RiskMate for Commercial Installations
          </h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            See how Carla&apos;s HVAC team documents refrigerant handling, confined space work, and equipment safety for commercial HVAC installations.
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
              Carla supervises a 8-person HVAC team doing commercial installations. Before RiskMate:
            </p>
            <ul className="space-y-3 text-white/70">
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>Team members not following safety protocols because documentation was too complicated</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>Refrigerant handling logs kept on paper, often lost or incomplete</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>Confined space entry permits scattered across different systems</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 mt-1">✗</span>
                <span>No way to verify team members completed required safety checks</span>
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
          <h2 className="text-3xl font-bold mb-6">Sample High-Risk Job: Commercial Rooftop Unit Installation</h2>
          <div className="bg-[#121212] rounded-xl border border-white/10 p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">Job Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-[#A1A1A1]">Client:</span>
                    <span className="ml-2 text-white">Shopping Mall Complex</span>
                  </div>
                  <div>
                    <span className="text-[#A1A1A1]">Location:</span>
                    <span className="ml-2 text-white">Calgary, AB - Rooftop Installation</span>
                  </div>
                  <div>
                    <span className="text-[#A1A1A1]">Job Type:</span>
                    <span className="ml-2 text-white">Rooftop HVAC Unit Replacement</span>
                  </div>
                  <div>
                    <span className="text-[#A1A1A1]">Risk Score:</span>
                    <span className="ml-2 text-orange-400 font-bold text-lg">68 (HIGH RISK)</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">Risk Factors Detected</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    <span>Refrigerant handling (R-410A)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    <span>Confined space (equipment room)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    <span>Heavy equipment lifting</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    <span>Rooftop work (fall risk)</span>
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
                    hazard: 'Refrigerant handling (R-410A)',
                    severity: 'High',
                    mitigation: 'Certified technician only, recovery equipment verified, MSDS on-site',
                    photo: 'Before: Refrigerant recovery setup',
                  },
                  {
                    hazard: 'Confined space entry (equipment room)',
                    severity: 'High',
                    mitigation: 'Atmospheric testing completed, entry permit issued, attendant posted',
                    photo: 'During: Confined space entry',
                  },
                  {
                    hazard: 'Rooftop fall protection',
                    severity: 'High',
                    mitigation: 'Guardrails installed, fall arrest systems in place, weather conditions monitored',
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
                action: 'Carla completes the hazard checklist. RiskMate identifies refrigerant handling and confined space risks, calculates risk score of 68 (HIGH), and generates 10 required safety controls.',
                time: '6 minutes',
              },
              {
                step: 'During the job',
                action: 'Team members check off mitigations as they complete them. Photos of safety equipment, refrigerant recovery, and confined space entry are automatically timestamped. Team actually follows protocols because it&apos;s so easy.',
                time: 'Real-time',
              },
              {
                step: 'After the job',
                action: 'Carla generates a professional PDF report with all safety documentation, refrigerant logs, confined space permits, and evidence photos—ready for client and regulatory compliance.',
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
                <h3 className="text-xl font-semibold mb-4 text-[#F97316]">Team Compliance</h3>
                <ul className="space-y-3 text-white/80">
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Team actually follows safety protocols because it&apos;s easy</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>100% completion rate on required mitigations</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Real-time visibility into who completed what</span>
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
                    <span>Complete refrigerant handling logs for compliance</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Confined space permits organized and accessible</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Clients trust the professional safety documentation</span>
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
          <h2 className="text-3xl font-bold mb-4 font-display">Ready to improve your team&apos;s safety compliance?</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            Join HVAC companies across Canada who use RiskMate to ensure their teams follow safety protocols and maintain compliance documentation.
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

