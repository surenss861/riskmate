'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import Link from 'next/link'

export default function ComplianceScorePage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [score, setScore] = useState<number | null>(null)

  const questions = [
    { id: '1', question: 'Do you document hazards before every job?', weight: 20 },
    { id: '2', question: 'Do you have a written safety program?', weight: 15 },
    { id: '3', question: 'Do you track mitigation completion?', weight: 15 },
    { id: '4', question: 'Do you maintain photo evidence for all jobs?', weight: 15 },
    { id: '5', question: 'Do you generate reports for clients/insurers?', weight: 10 },
    { id: '6', question: 'Do you have an audit trail for all safety actions?', weight: 10 },
    { id: '7', question: 'Do you train team members on safety protocols?', weight: 10 },
    { id: '8', question: 'Do you review and update safety procedures regularly?', weight: 5 },
  ]

  const calculateScore = () => {
    let totalScore = 0
    let totalWeight = 0

    questions.forEach((q) => {
      totalWeight += q.weight
      if (answers[q.id]) {
        totalScore += q.weight
      }
    })

    const percentage = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0
    setScore(percentage)
  }

  const toggleAnswer = (id: string) => {
    setAnswers((prev) => {
      const newAnswers = { ...prev, [id]: !prev[id] }
      // Auto-calculate on change
      setTimeout(() => {
        let totalScore = 0
        let totalWeight = 0
        questions.forEach((q) => {
          totalWeight += q.weight
          if (newAnswers[q.id]) {
            totalScore += q.weight
          }
        })
        const percentage = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0
        setScore(percentage)
      }, 0)
      return newAnswers
    })
  }

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-white/40'
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getScoreBg = (score: number | null) => {
    if (!score) return 'bg-white/5 border-white/10'
    if (score >= 80) return 'bg-green-500/10 border-green-500/30'
    if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/30'
    if (score >= 40) return 'bg-orange-500/10 border-orange-500/30'
    return 'bg-red-500/10 border-red-500/30'
  }

  const getScoreLabel = (score: number | null) => {
    if (!score) return 'Not Calculated'
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Needs Improvement'
    return 'Critical'
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
          <h1 className="text-5xl font-bold mb-4 font-display">Compliance Score Checker</h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            Assess your company&apos;s safety compliance level. Answer these questions to see how you stack up.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Questions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-[#121212] rounded-xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-semibold mb-6">Safety Compliance Checklist</h2>
            <div className="space-y-4">
              {questions.map((q) => (
                <label
                  key={q.id}
                  className="flex items-start gap-3 p-4 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"
                >
                  <input
                    type="checkbox"
                    checked={answers[q.id] || false}
                    onChange={() => toggleAnswer(q.id)}
                    className="mt-1 w-5 h-5 rounded border-white/20 bg-black/40 text-[#F97316] focus:ring-[#F97316] focus:ring-2"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-white">{q.question}</span>
                    <span className="text-xs text-[#A1A1A1] ml-2">({q.weight} points)</span>
                  </div>
                </label>
              ))}
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-[#121212] rounded-xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-semibold mb-6">Your Compliance Score</h2>
            {score !== null ? (
              <div className={`p-8 rounded-xl border ${getScoreBg(score)} text-center mb-6`}>
                <div className={`text-8xl font-bold mb-3 ${getScoreColor(score)}`}>
                  {score}%
                </div>
                <div className="text-2xl font-semibold mb-2 text-white">
                  {getScoreLabel(score)}
                </div>
                <div className="text-sm text-[#A1A1A1]">
                  {Object.values(answers).filter(Boolean).length} of {questions.length} practices in place
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-white/10 text-center mb-6">
                <div className="text-4xl font-bold mb-3 text-white/40">—</div>
                <div className="text-lg text-[#A1A1A1]">Answer questions to calculate</div>
              </div>
            )}

            {/* Interpretation */}
            {score !== null && (
              <div className="space-y-4">
                <div className="p-4 bg-black/20 rounded-lg border border-white/5">
                  <h3 className="font-semibold mb-2 text-white">What This Means:</h3>
                  {score >= 80 ? (
                    <p className="text-sm text-white/70">
                      <strong className="text-green-400">Excellent:</strong> Your company has strong safety compliance practices. RiskMate can help you maintain this level and streamline documentation.
                    </p>
                  ) : score >= 60 ? (
                    <p className="text-sm text-white/70">
                      <strong className="text-yellow-400">Good:</strong> You&apos;re on the right track, but there&apos;s room for improvement. RiskMate can help fill the gaps in documentation and tracking.
                    </p>
                  ) : score >= 40 ? (
                    <p className="text-sm text-white/70">
                      <strong className="text-orange-400">Needs Improvement:</strong> Your compliance practices need work. RiskMate can help you establish proper documentation and safety tracking.
                    </p>
                  ) : (
                    <p className="text-sm text-white/70">
                      <strong className="text-red-400">Critical:</strong> Your company is at significant risk. RiskMate can help you build a proper safety compliance system from the ground up.
                    </p>
                  )}
                </div>

                <div className="p-4 bg-[#F97316]/10 rounded-lg border border-[#F97316]/20">
                  <p className="text-sm text-white/80">
                    <strong>RiskMate helps you:</strong> Document hazards automatically, track mitigations, maintain photo evidence, generate audit-ready reports, and build a complete compliance trail.
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
          <h2 className="text-3xl font-bold mb-4 font-display">Improve Your Compliance Score</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            RiskMate automates safety documentation, making it easy to maintain high compliance scores and pass audits.
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

