'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskmateLogo from '@/components/RiskmateLogo'
import Link from 'next/link'

export default function SpreadsheetsComparisonPage() {
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
            Riskmate vs Spreadsheets
          </h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            Why contractors switch from Excel/Google Sheets to Riskmate for job documentation and compliance reporting.
          </p>
        </motion.div>

        {/* The Problem with Spreadsheets */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">The Problem with Spreadsheets</h2>
          <div className="bg-[#121212] rounded-xl border border-white/10 p-8">
            <ul className="space-y-4 text-white/80">
              {[
                'No automatic risk scoring—you calculate manually',
                'Photos stored separately (Google Drive, email, phone)',
                'No structured workflows—just rows and columns',
                'Creating PDF reports requires manual formatting',
                'No version history or audit trail',
                'Hard to share with clients professionally',
                'No mobile-friendly interface for on-site use',
                'Formulas break, data gets corrupted, files get lost',
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
          <h2 className="text-3xl font-bold mb-6">Spreadsheets vs Riskmate</h2>
          <div className="space-y-6">
            {[
              {
                task: 'Risk scoring',
                spreadsheet: 'Manual calculation using formulas (error-prone)',
                riskmate: 'Automatic AI-powered risk calculation',
              },
              {
                task: 'Photo management',
                spreadsheet: 'Photos in separate folders, hard to link to jobs',
                riskmate: 'Photos automatically linked to jobs, timestamped, organized',
              },
              {
                task: 'PDF reports',
                spreadsheet: 'Export to PDF, manually format, add photos separately',
                riskmate: 'One-click branded PDF with everything included',
              },
              {
                task: 'Mobile access',
                spreadsheet: 'Spreadsheet apps are clunky on phones',
                riskmate: 'Mobile-optimized interface (app coming soon)',
              },
              {
                task: 'Data structure',
                spreadsheet: 'Flat rows—no relationships between hazards, mitigations, photos',
                riskmate: 'Structured job workflow with relationships',
              },
              {
                task: 'Collaboration',
                spreadsheet: 'Multiple people editing can cause conflicts',
                riskmate: 'Real-time collaboration with version history',
              },
              {
                task: 'Audit trail',
                spreadsheet: 'None—just cell history if enabled',
                riskmate: 'Complete version history, timestamps, compliance logs',
              },
            ].map((item, index) => (
              <div key={index} className="p-6 bg-[#121212] rounded-xl border border-white/10">
                <h3 className="text-lg font-semibold mb-4">{item.task}</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-red-400 font-medium mb-2">Spreadsheets</div>
                    <p className="text-sm text-white/60">{item.spreadsheet}</p>
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

        {/* Why Switch */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">Why Contractors Switch from Spreadsheets</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Purpose-Built for Jobs',
                description: 'Riskmate understands job workflows (before, during, after). Spreadsheets are generic tools that require you to build everything from scratch.',
              },
              {
                title: 'Automatic Everything',
                description: 'Risk scoring, mitigation generation, PDF creation—all automatic. Spreadsheets require manual formulas and formatting.',
              },
              {
                title: 'Professional Output',
                description: 'Riskmate generates branded, audit-ready PDFs. Spreadsheet exports look unprofessional and require manual formatting.',
              },
              {
                title: 'Mobile-Friendly',
                description: 'Riskmate works great on phones (app coming soon). Spreadsheet apps are clunky for on-site documentation.',
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
          <h2 className="text-3xl font-bold mb-4 font-display">Ready to upgrade from spreadsheets?</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            Join contractors who switched from Excel/Google Sheets to Riskmate for professional job documentation.
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

