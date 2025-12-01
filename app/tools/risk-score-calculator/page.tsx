'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import Link from 'next/link'

export default function RiskScoreCalculatorPage() {
  const router = useRouter()
  const [selectedFactors, setSelectedFactors] = useState<string[]>([])
  const [calculatedScore, setCalculatedScore] = useState<number | null>(null)
  const [riskLevel, setRiskLevel] = useState<string | null>(null)

  const riskFactors = [
    { code: 'HEIGHT', name: 'Height work (over 6 feet)', weight: 15 },
    { code: 'ELECTRICAL', name: 'Live electrical work', weight: 20 },
    { code: 'CONFINED', name: 'Confined space entry', weight: 18 },
    { code: 'HEAVY', name: 'Heavy equipment operation', weight: 12 },
    { code: 'PUBLIC', name: 'Public access area', weight: 10 },
    { code: 'WEATHER', name: 'Weather exposure (wind, rain)', weight: 8 },
    { code: 'SUBCONTRACTOR', name: 'Multiple subcontractors', weight: 10 },
    { code: 'HAZMAT', name: 'Hazardous materials', weight: 15 },
    { code: 'EXCAVATION', name: 'Excavation/trenching', weight: 12 },
    { code: 'OVERHEAD', name: 'Overhead work', weight: 10 },
  ]

  const calculateRisk = () => {
    if (selectedFactors.length === 0) {
      setCalculatedScore(null)
      setRiskLevel(null)
      return
    }

    // Base score
    let score = 20

    // Add weights for selected factors
    selectedFactors.forEach((factorCode) => {
      const factor = riskFactors.find((f) => f.code === factorCode)
      if (factor) {
        score += factor.weight
      }
    })

    // Cap at 100
    score = Math.min(score, 100)

    // Determine risk level
    let level = 'low'
    if (score >= 71) level = 'critical'
    else if (score >= 51) level = 'high'
    else if (score >= 31) level = 'medium'
    else level = 'low'

    setCalculatedScore(score)
    setRiskLevel(level)
  }

  const toggleFactor = (code: string) => {
    setSelectedFactors((prev) => {
      const newFactors = prev.includes(code) ? prev.filter((f) => f !== code) : [...prev, code]
      // Recalculate after state update
      setTimeout(() => {
        let score = 20
        newFactors.forEach((factorCode) => {
          const factor = riskFactors.find((f) => f.code === factorCode)
          if (factor) {
            score += factor.weight
          }
        })
        score = Math.min(score, 100)
        let level = 'low'
        if (score >= 71) level = 'critical'
        else if (score >= 51) level = 'high'
        else if (score >= 31) level = 'medium'
        else level = 'low'
        setCalculatedScore(score)
        setRiskLevel(level)
      }, 0)
      return newFactors
    })
  }

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-white/40'
    if (score >= 71) return 'text-red-400'
    if (score >= 51) return 'text-orange-400'
    if (score >= 31) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getScoreBg = (score: number | null) => {
    if (!score) return 'bg-white/5 border-white/10'
    if (score >= 71) return 'bg-red-500/10 border-red-500/30'
    if (score >= 51) return 'bg-orange-500/10 border-orange-500/30'
    if (score >= 31) return 'bg-yellow-500/10 border-yellow-500/30'
    return 'bg-green-500/10 border-green-500/30'
  }

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
          <h1 className="text-5xl font-bold mb-4 font-display">Risk Score Calculator</h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            Estimate your job&apos;s risk score by selecting the hazards present. This calculator uses the same algorithm as RiskMate.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Calculator Input */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-[#121212] rounded-xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-semibold mb-6">Select Hazards Present</h2>
            <div className="space-y-3 mb-6">
              {riskFactors.map((factor) => (
                <label
                  key={factor.code}
                  className="flex items-start gap-3 p-4 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selectedFactors.includes(factor.code)}
                    onChange={() => {
                      toggleFactor(factor.code)
                      setTimeout(calculateRisk, 0)
                    }}
                    className="mt-1 w-5 h-5 rounded border-white/20 bg-black/40 text-[#F97316] focus:ring-[#F97316] focus:ring-2"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-white">{factor.name}</span>
                    <span className="text-xs text-[#A1A1A1] ml-2">(+{factor.weight} points)</span>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={calculateRisk}
              className="w-full px-6 py-3 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
            >
              Calculate Risk Score
            </button>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-[#121212] rounded-xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-semibold mb-6">Your Risk Score</h2>
            {calculatedScore !== null ? (
              <div className={`p-8 rounded-xl border ${getScoreBg(calculatedScore)} text-center mb-6`}>
                <div className={`text-8xl font-bold mb-3 ${getScoreColor(calculatedScore)}`}>
                  {calculatedScore}
                </div>
                <div className="text-2xl font-semibold mb-2 text-white">
                  {riskLevel?.toUpperCase()} RISK
                </div>
                <div className="text-sm text-[#A1A1A1]">
                  Based on {selectedFactors.length} hazard{selectedFactors.length !== 1 ? 's' : ''}
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-white/10 text-center mb-6">
                <div className="text-4xl font-bold mb-3 text-white/40">—</div>
                <div className="text-lg text-[#A1A1A1]">Select hazards to calculate</div>
              </div>
            )}

            {/* Interpretation */}
            {calculatedScore !== null && (
              <div className="space-y-4">
                <div className="p-4 bg-black/20 rounded-lg border border-white/5">
                  <h3 className="font-semibold mb-2 text-white">What This Means:</h3>
                  {calculatedScore >= 71 ? (
                    <p className="text-sm text-white/70">
                      <strong className="text-red-400">CRITICAL RISK:</strong> This job requires immediate attention. Complete all required mitigations before starting work. Consider additional safety measures.
                    </p>
                  ) : calculatedScore >= 51 ? (
                    <p className="text-sm text-white/70">
                      <strong className="text-orange-400">HIGH RISK:</strong> This job has significant hazards. Ensure all safety controls are in place and verified before proceeding.
                    </p>
                  ) : calculatedScore >= 31 ? (
                    <p className="text-sm text-white/70">
                      <strong className="text-yellow-400">MEDIUM RISK:</strong> This job has moderate hazards. Follow standard safety protocols and complete required mitigations.
                    </p>
                  ) : (
                    <p className="text-sm text-white/70">
                      <strong className="text-green-400">LOW RISK:</strong> This job has minimal hazards. Standard safety precautions should be sufficient.
                    </p>
                  )}
                </div>

                <div className="p-4 bg-[#F97316]/10 rounded-lg border border-[#F97316]/20">
                  <p className="text-sm text-white/80">
                    <strong>In RiskMate:</strong> This score is calculated automatically when you document hazards. RiskMate also generates a mitigation checklist based on your risk factors.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center bg-[#121212] rounded-xl border border-white/10 p-12"
        >
          <h2 className="text-3xl font-bold mb-4 font-display">Get Automatic Risk Scoring</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            RiskMate automatically calculates risk scores and generates mitigation checklists for every job. No manual calculation needed.
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

