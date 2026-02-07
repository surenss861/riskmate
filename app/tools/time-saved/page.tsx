'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskmateLogo from '@/components/RiskmateLogo'
import Link from 'next/link'

export default function TimeSavedPage() {
  const router = useRouter()
  const [jobsPerMonth, setJobsPerMonth] = useState(10)
  const [hoursPerJob, setHoursPerJob] = useState(2.5)
  const [hourlyRate, setHourlyRate] = useState(50)

  const timeSavedPerJob = useMemo(() => {
    // Riskmate saves 40-60% of documentation time
    // Using 50% as average
    return hoursPerJob * 0.5
  }, [hoursPerJob])

  const monthlySavings = useMemo(() => {
    const totalTimeSaved = jobsPerMonth * timeSavedPerJob
    const monetarySavings = totalTimeSaved * hourlyRate
    return { hours: totalTimeSaved, dollars: monetarySavings }
  }, [jobsPerMonth, timeSavedPerJob, hourlyRate])

  const annualSavings = useMemo(() => {
    return {
      hours: monthlySavings.hours * 12,
      dollars: monthlySavings.dollars * 12,
    }
  }, [monthlySavings])

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
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 font-display">Time Saved Calculator</h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            See how much time and money Riskmate saves you per job, per month, and per year. Riskmate reduces documentation time by 40-60%.
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
              <label className="block text-sm font-medium mb-2 text-white">
                Jobs per Month
              </label>
              <input
                type="number"
                value={jobsPerMonth}
                onChange={(e) => setJobsPerMonth(Number(e.target.value))}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Hours Spent on Documentation per Job
              </label>
              <input
                type="number"
                value={hoursPerJob}
                onChange={(e) => setHoursPerJob(Number(e.target.value))}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                min="0"
                step="0.5"
              />
              <p className="text-xs text-[#A1A1A1] mt-2">
                Includes: hazard forms, photo organization, report creation, client documentation
              </p>
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

            <div className="p-4 bg-[#F97316]/10 rounded-lg border border-[#F97316]/20">
              <p className="text-sm text-white/80">
                <strong>Riskmate saves 40-60%</strong> of documentation time through automation, templates, and one-click PDF generation.
              </p>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-[#121212] rounded-xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-semibold mb-6">Your Time & Money Savings</h2>

            {/* Per Job */}
            <div className="mb-6">
              <div className="text-sm text-[#A1A1A1] mb-2">Time Saved Per Job</div>
              <div className="text-4xl font-bold text-[#F97316] mb-1">
                {timeSavedPerJob.toFixed(1)} hours
              </div>
              <div className="text-sm text-white/60">
                ${(timeSavedPerJob * hourlyRate).toLocaleString()} saved per job
              </div>
            </div>

            {/* Monthly */}
            <div className="mb-6 p-6 bg-gradient-to-br from-[#F97316]/10 to-transparent rounded-xl border border-[#F97316]/20">
              <div className="text-sm text-[#A1A1A1] mb-2">Monthly Savings</div>
              <div className="text-5xl font-bold text-[#F97316] mb-2">
                {monthlySavings.hours.toFixed(1)} hours
              </div>
              <div className="text-2xl font-semibold text-white mb-1">
                ${monthlySavings.dollars.toLocaleString()}
              </div>
              <div className="text-sm text-white/60">
                Based on {jobsPerMonth} jobs/month
              </div>
            </div>

            {/* Annual */}
            <div className="mb-6 p-6 bg-gradient-to-br from-green-500/10 to-transparent rounded-xl border border-green-500/20">
              <div className="text-sm text-[#A1A1A1] mb-2">Annual Savings</div>
              <div className="text-5xl font-bold text-green-400 mb-2">
                {annualSavings.hours.toFixed(0)} hours
              </div>
              <div className="text-2xl font-semibold text-white mb-1">
                ${annualSavings.dollars.toLocaleString()}
              </div>
              <div className="text-sm text-white/60">
                That&apos;s {Math.round(annualSavings.hours / 40)} weeks of work saved per year
              </div>
            </div>

            {/* ROI */}
            <div className="p-4 bg-black/20 rounded-lg border border-white/5">
              <div className="text-sm text-white/70 mb-1">Riskmate Cost (Pro Plan)</div>
              <div className="text-2xl font-bold text-white mb-2">$59/month</div>
              <div className="text-sm text-green-400 font-semibold">
                ROI: {Math.round((monthlySavings.dollars / 59) * 100)}% — Pays for itself {Math.round(monthlySavings.dollars / 59)}x over
              </div>
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
          <h2 className="text-3xl font-bold mb-4 font-display">Start Saving Time Today</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            Riskmate automates your safety documentation, saving you hours per job and thousands per year.
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

