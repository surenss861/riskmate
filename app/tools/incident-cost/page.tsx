'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import Link from 'next/link'

const INCIDENT_TYPES = [
  { value: 'minor', label: 'Minor Injury (First Aid)', baseCost: 2000 },
  { value: 'moderate', label: 'Moderate Injury (Medical Treatment)', baseCost: 15000 },
  { value: 'serious', label: 'Serious Injury (Lost Time)', baseCost: 50000 },
  { value: 'critical', label: 'Critical Injury (Permanent Disability)', baseCost: 250000 },
] as const

export default function IncidentCostPage() {
  const router = useRouter()
  const [incidentType, setIncidentType] = useState<string>('minor')
  const [medicalCosts, setMedicalCosts] = useState(5000)
  const [lostTime, setLostTime] = useState(10)
  const [hourlyRate, setHourlyRate] = useState(50)
  const [legalFees, setLegalFees] = useState(10000)
  const [insuranceIncrease, setInsuranceIncrease] = useState(5000)

  const totalCost = useMemo(() => {
    const base = INCIDENT_TYPES.find((t) => t.value === incidentType)?.baseCost || 0
    const lostTimeCost = lostTime * hourlyRate * 8 // 8 hours per day
    const total = base + medicalCosts + lostTimeCost + legalFees + insuranceIncrease
    return total
  }, [incidentType, medicalCosts, lostTime, hourlyRate, legalFees, insuranceIncrease])

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
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 font-display">Incident Cost Estimator</h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            Calculate the true cost of a workplace incident. This includes medical costs, lost productivity, legal fees, and insurance increases.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Inputs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-[#121212] rounded-xl border border-white/10 p-8 space-y-6"
          >
            <div>
              <label className="block text-sm font-medium mb-2 text-white">Incident Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
              >
                {INCIDENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Medical Costs ($)
              </label>
              <input
                type="number"
                value={medicalCosts}
                onChange={(e) => setMedicalCosts(Number(e.target.value))}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Days of Lost Time
              </label>
              <input
                type="number"
                value={lostTime}
                onChange={(e) => setLostTime(Number(e.target.value))}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Average Hourly Rate ($)
              </label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Legal Fees ($)
              </label>
              <input
                type="number"
                value={legalFees}
                onChange={(e) => setLegalFees(Number(e.target.value))}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Annual Insurance Increase ($)
              </label>
              <input
                type="number"
                value={insuranceIncrease}
                onChange={(e) => setInsuranceIncrease(Number(e.target.value))}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                min="0"
              />
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-[#121212] rounded-xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-semibold mb-6">Estimated Total Cost</h2>
            <div className="p-8 rounded-xl border border-red-500/30 bg-red-500/10 text-center mb-6">
              <div className="text-6xl font-bold mb-3 text-red-400">
                ${totalCost.toLocaleString()}
              </div>
              <div className="text-lg text-white/80">Total Incident Cost</div>
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                <span className="text-sm text-white/70">Base Incident Cost</span>
                <span className="text-sm font-semibold text-white">
                  ${(INCIDENT_TYPES.find((t) => t.value === incidentType)?.baseCost || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                <span className="text-sm text-white/70">Medical Costs</span>
                <span className="text-sm font-semibold text-white">${medicalCosts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                <span className="text-sm text-white/70">Lost Productivity ({lostTime} days)</span>
                <span className="text-sm font-semibold text-white">
                  ${(lostTime * hourlyRate * 8).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                <span className="text-sm text-white/70">Legal Fees</span>
                <span className="text-sm font-semibold text-white">${legalFees.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                <span className="text-sm text-white/70">Insurance Increase (annual)</span>
                <span className="text-sm font-semibold text-white">${insuranceIncrease.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 bg-[#F97316]/10 rounded-lg border border-[#F97316]/20">
              <p className="text-sm text-white/80">
                <strong>Prevent incidents with Riskmate:</strong> Proper hazard documentation, mitigation tracking, and safety protocols reduce the likelihood of workplace incidents by 40-60%.
              </p>
            </div>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center bg-[#121212] rounded-xl border border-white/10 p-12"
        >
          <h2 className="text-3xl font-bold mb-4 font-display">Prevent Incidents Before They Happen</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            Riskmate helps you identify and mitigate hazards before they become incidents. A single prevented incident can save you tens of thousands of dollars.
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
              Try Interactive Demo
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

