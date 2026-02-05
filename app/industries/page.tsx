'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import { operationPresets } from '@/lib/demo/demoData'

export default function IndustriesPage() {
  const router = useRouter()

  const industries = [
    {
      slug: 'residential-trades',
      ...operationPresets.residential_trades,
      examples: 'Electrical, Plumbing, HVAC, Roofing, Landscaping, Handyman, Renovation',
      risks: 'High volume jobs, multiple crews, insurance documentation needs',
      proof: 'Insurance packets, incident documentation, basic audit trails',
      roles: 'Owner, Ops Manager',
    },
    {
      slug: 'commercial-contractors',
      ...operationPresets.commercial_contractors,
      examples: 'Commercial construction, Multi-trade, Facilities contractors, Tenant improvements',
      risks: 'Role complexity, subcontractor accountability, client compliance',
      proof: 'Audit packets, role enforcement logs, client compliance documentation',
      roles: 'VP Ops, Safety Lead',
    },
    {
      slug: 'facilities-services',
      ...operationPresets.facilities_services,
      examples: 'Janitorial, Window cleaning, Building maintenance, Elevators, Security systems',
      risks: 'Multi-site operations, service logs, client compliance, SLAs',
      proof: 'Service logs, compliance history, security event logs',
      roles: 'Director Ops, Compliance Manager',
    },
    {
      slug: 'fire-life-safety',
      ...operationPresets.fire_life_safety,
      examples: 'Fire protection, Sprinklers, Fire & security systems, Life safety inspections',
      risks: 'Regulation pressure, accountability chain, constant documentation needs',
      proof: 'Inspection logs, compliance trails, immutable audit history',
      roles: 'Owner, Compliance Manager',
    },
    {
      slug: 'infrastructure-heavy-civil',
      ...operationPresets.infrastructure_heavy_civil,
      examples: 'Heavy civil, Utilities, Pipeline, Hydrovac, Rail/transit, Environmental/hazmat',
      risks: 'High liability, multiple stakeholders, incident/insurance packets routine',
      proof: 'Insurance packets, incident packets, executive oversight reports',
      roles: 'Risk Manager, Compliance, VP Ops',
    },
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 backdrop-blur-xl border-b border-white/10 bg-black/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between py-5 px-6">
          <button onClick={() => router.push('/')} className="flex items-center gap-3">
            <RiskMateLogo size="sm" showText={true} />
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/demo')}
              className="text-white/70 hover:text-white transition-colors text-sm"
            >
              Demo
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-white rounded-md font-medium text-sm transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6 font-display">
              Built for Your Industry
            </h1>
            <p className="text-xl text-white/70 max-w-3xl mx-auto">
              One core product. Five vertical configurations. Each industry sees their jobs, their risks, their compliance proof—without building 10 different apps.
            </p>
          </motion.div>

          {/* Industry Cards */}
          <div className="space-y-8">
            {industries.map((industry, index) => (
              <motion.div
                key={industry.slug}
                className="bg-[#121212] rounded-xl border border-white/5 p-8 hover:border-[#F97316]/30 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h2 className="text-3xl font-bold mb-4">{industry.label}</h2>
                    <p className="text-white/60 mb-6">{industry.description}</p>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-white/50 mb-2">Examples:</p>
                        <p className="text-sm text-white/80">{industry.examples}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/50 mb-2">Risks You Cover:</p>
                        <p className="text-sm text-white/80">{industry.risks}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/50 mb-2">What Gets Logged:</p>
                        <p className="text-sm text-white/80">Every job, every risk score, every flag, every role action, every audit event</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/50 mb-2">What Gets Exported:</p>
                        <p className="text-sm text-white/80">{industry.proof}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/50 mb-2">Who Uses It:</p>
                        <p className="text-sm text-white/80">{industry.roles}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between">
                    <div className="bg-black/20 rounded-lg p-6 border border-white/5 mb-4">
                      <p className="text-sm text-white/50 mb-2">Value Message:</p>
                      <p className="text-lg font-semibold text-[#F97316] italic">&ldquo;{industry.message}&rdquo;</p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => router.push(`/demo?operation=${industry.type}`)}
                        className="flex-1 px-6 py-3 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
                      >
                        Try Demo →
                      </button>
                      <button
                        onClick={() => router.push('/login')}
                        className="px-6 py-3 border border-white/10 hover:border-white/20 rounded-lg font-semibold transition-colors"
                      >
                        Get Started
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA Section */}
          <motion.div
            className="mt-20 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold mb-4">Ready to see Riskmate for your industry?</h2>
            <p className="text-white/60 mb-8">Try the interactive demo configured for your vertical.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/demo')}
                className="px-8 py-4 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold text-lg transition-colors"
              >
                Try Interactive Demo →
              </button>
              <button
                onClick={() => router.push('/login')}
                className="px-8 py-4 border border-white/10 hover:border-white/20 rounded-lg font-semibold text-lg transition-colors"
              >
                Get Started
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

