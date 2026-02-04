'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskmateLogo from '@/components/RiskmateLogo'
import Link from 'next/link'

export default function ContractorBundlePage() {
  const router = useRouter()
  const [downloading, setDownloading] = useState<string | null>(null)

  const resources = [
    {
      id: 'jsa-template',
      title: 'Job Safety Analysis (JSA) Template',
      description: 'A fillable PDF template for documenting job hazards, controls, and safety procedures. Use this for every job to ensure nothing is missed.',
      format: 'PDF',
      size: '2.1 MB',
      icon: '📋',
    },
    {
      id: 'hazard-checklist',
      title: 'Hazard Identification Checklist',
      description: 'A comprehensive checklist of common hazards in electrical, roofing, HVAC, and renovation work. Print and use on-site.',
      format: 'PDF',
      size: '1.8 MB',
      icon: '⚠️',
    },
    {
      id: 'toolbox-talk',
      title: 'Toolbox Talk Template',
      description: 'A ready-to-use template for daily safety meetings. Includes sections for hazards, controls, and team sign-off.',
      format: 'PDF',
      size: '1.5 MB',
      icon: '💬',
    },
    {
      id: 'risk-cheat-sheet',
      title: 'Risk Scoring Cheat Sheet',
      description: 'Quick reference guide for understanding risk scores, severity levels, and when to implement additional controls.',
      format: 'PDF',
      size: '0.9 MB',
      icon: '📊',
    },
    {
      id: 'liability-guide',
      title: 'Reduce Liability 101 Guide',
      description: 'A contractor-focused guide on reducing job liability through proper documentation, evidence collection, and compliance practices.',
      format: 'PDF',
      size: '3.2 MB',
      icon: '🛡️',
    },
    {
      id: 'sample-pdf',
      title: 'Sample Risk Snapshot PDF',
      description: 'See what a professional Riskmate report looks like. This is a real example from a commercial HVAC installation.',
      format: 'PDF',
      size: '4.5 MB',
      icon: '📄',
    },
  ]

  const handleDownload = async (resourceId: string) => {
    setDownloading(resourceId)
    // Simulate download
    setTimeout(() => {
      setDownloading(null)
      // In production, this would trigger an actual download
      // For now, we'll just show a success message
      alert('Download started! In production, this would download the actual file.')
    }, 1000)
  }

  const handleDownloadAll = async () => {
    setDownloading('all')
    // Simulate ZIP download
    setTimeout(() => {
      setDownloading(null)
      alert('ZIP bundle download started! In production, this would download a ZIP file with all resources.')
    }, 1500)
  }

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
          <div className="inline-block px-4 py-2 bg-[#F97316]/20 border border-[#F97316]/30 rounded-full text-[#F97316] text-sm font-medium mb-6">
            Free Contractor Bundle
          </div>
          <h1 className="text-5xl font-bold mb-4 font-display">Free Safety Resources for Contractors</h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            Download our complete bundle of safety templates, checklists, and guides. Everything you need to improve your safety documentation—no signup required.
          </p>
        </motion.div>

        {/* Download All CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12 p-8 bg-gradient-to-br from-[#F97316]/10 to-transparent rounded-xl border border-[#F97316]/20 text-center"
        >
          <h2 className="text-2xl font-semibold mb-4">Download Everything at Once</h2>
          <p className="text-white/70 mb-6 max-w-2xl mx-auto">
            Get all 6 resources in one ZIP file. Perfect for sharing with your team or saving for later.
          </p>
          <button
            onClick={handleDownloadAll}
            disabled={downloading === 'all'}
            className="px-8 py-4 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 mx-auto"
          >
            {downloading === 'all' ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
                Downloading Bundle...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Complete Bundle (ZIP)
              </>
            )}
          </button>
        </motion.div>

        {/* Resources Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {resources.map((resource, index) => (
            <motion.div
              key={resource.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * index }}
              className="p-6 bg-[#121212] rounded-xl border border-white/10 hover:border-[#F97316]/30 transition-colors"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-4xl">{resource.icon}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{resource.title}</h3>
                  <p className="text-sm text-white/70 mb-3">{resource.description}</p>
                  <div className="flex items-center gap-3 text-xs text-[#A1A1A1]">
                    <span>{resource.format}</span>
                    <span>•</span>
                    <span>{resource.size}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDownload(resource.id)}
                disabled={downloading === resource.id}
                className="w-full px-4 py-2 border border-white/10 hover:border-[#F97316] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {downloading === resource.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download {resource.format}
                  </>
                )}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Why This Bundle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mb-12 p-8 bg-[#121212] rounded-xl border border-white/10"
        >
          <h2 className="text-2xl font-semibold mb-4">Why This Bundle?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2 text-[#F97316]">For Your Team</h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Share templates in WhatsApp groups</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Print checklists for on-site use</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Use toolbox talk template for daily meetings</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-[#F97316]">For Your Business</h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Improve compliance documentation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Reduce liability through proper documentation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>See what professional reports look like</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center bg-[#121212] rounded-xl border border-white/10 p-12"
        >
          <h2 className="text-3xl font-bold mb-4 font-display">Ready to Automate Your Safety Documentation?</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            These templates are great, but Riskmate automates everything. Generate professional reports in seconds, not hours.
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

