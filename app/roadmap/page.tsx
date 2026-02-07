'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskmateLogo from '@/components/RiskmateLogo'
import Link from 'next/link'

export default function RoadmapPage() {
  const router = useRouter()

  const roadmap = {
    shipped: [
      {
        title: 'Permit Pack Generator (ZIP)',
        description: 'Generate complete ZIP bundles with PDF reports, photos, documents, and compliance logs. Perfect for inspectors and audits.',
        date: 'November 2024',
        category: 'Business Plan',
      },
      {
        title: 'Interactive Demo Sandbox',
        description: 'Try Riskmate without signing up. Explore sample jobs, hazards, mitigations, and generate PDF previews.',
        date: 'November 2024',
        category: 'Public',
      },
      {
        title: 'Case Study Pages',
        description: 'Real examples from Electrical, Roofing, and HVAC contractors showing how they use Riskmate.',
        date: 'November 2024',
        category: 'Public',
      },
      {
        title: 'Comparison Pages',
        description: 'Detailed comparisons with SafetyCulture, SiteDocs, Pen & Paper, and Spreadsheets.',
        date: 'November 2024',
        category: 'Public',
      },
      {
        title: 'Calculator Tools',
        description: 'Free tools for risk scoring, compliance checking, incident cost estimation, and time savings calculation.',
        date: 'November 2024',
        category: 'Public',
      },
    ],
    inProgress: [
      {
        title: 'Mobile App (iOS & Android)',
        description: 'Native mobile apps for on-site documentation. Offline mode, photo capture with GPS metadata, and instant sync.',
        eta: 'Q1 2025',
        category: 'All Plans',
      },
      {
        title: 'Job Assignment Workflow',
        description: 'Assign jobs to team members, send notifications, and track completion status.',
        eta: 'Q1 2025',
        category: 'Pro & Business',
      },
      {
        title: 'Evidence Verification',
        description: 'Admin approval/rejection system for evidence photos and documents. Perfect for subcontractor compliance.',
        eta: 'Q1 2025',
        category: 'Business Plan',
      },
      {
        title: 'Templates System',
        description: 'Create and save custom templates for hazards, mitigations, and job types. Share templates across your organization.',
        eta: 'Q1 2025',
        category: 'Pro & Business',
      },
      {
        title: 'Photo Optimization',
        description: 'Automatic photo resizing, compression, and orientation correction. Faster uploads and smaller storage.',
        eta: 'Q1 2025',
        category: 'All Plans',
      },
    ],
    comingSoon: [
      {
        title: 'Client Portal',
        description: 'Read-only access for clients to view their job reports, photos, and compliance documentation.',
        eta: 'Q2 2025',
        category: 'Business Plan',
      },
      {
        title: 'Advanced Analytics Dashboard',
        description: 'Organization-level insights: risk trends, compliance scores, team performance, and incident tracking.',
        eta: 'Q2 2025',
        category: 'Business Plan',
      },
      {
        title: 'Custom Workflows',
        description: 'Build custom safety workflows tailored to your specific trade or company processes.',
        eta: 'Q2 2025',
        category: 'Business Plan',
      },
      {
        title: 'API Access',
        description: 'Integrate Riskmate with your existing tools via REST API. Perfect for larger organizations.',
        eta: 'Q2 2025',
        category: 'Business Plan',
      },
      {
        title: 'Multi-Language Support',
        description: 'Riskmate in Spanish, French, and other languages for diverse teams.',
        eta: 'Q2 2025',
        category: 'All Plans',
      },
    ],
    ideas: [
      {
        title: 'Weather Integration',
        description: 'Automatic weather data logging for jobs. Track wind, rain, and temperature conditions.',
        votes: 23,
      },
      {
        title: 'Voice-to-Text Hazard Notes',
        description: 'Dictate hazard descriptions and mitigation notes using voice recognition.',
        votes: 18,
      },
      {
        title: 'QR Code Job Access',
        description: 'Generate QR codes for jobs. Team members scan to quickly access job details on-site.',
        votes: 15,
      },
      {
        title: 'Integration with QuickBooks',
        description: 'Sync job data with QuickBooks for invoicing and project management.',
        votes: 12,
      },
      {
        title: 'White-Label Reports',
        description: 'Fully customizable PDF reports with your branding, colors, and logo placement.',
        votes: 10,
      },
    ],
  }

  const getCategoryColor = (category: string) => {
    if (category.includes('Business')) return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    if (category.includes('Pro')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    return 'bg-green-500/20 text-green-400 border-green-500/30'
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

      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold mb-4 font-display">Feature Roadmap</h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl mx-auto">
            See what we&apos;ve shipped, what we&apos;re building, and what&apos;s coming next. We&apos;re constantly improving Riskmate based on your feedback.
          </p>
        </motion.div>

        {/* Shipped */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <h2 className="text-3xl font-bold">Recently Shipped</h2>
          </div>
          <div className="space-y-4">
            {roadmap.shipped.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="p-6 bg-[#121212] rounded-xl border border-white/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-white/70 mb-3">{item.description}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded border ${getCategoryColor(item.category)}`}>
                    {item.category}
                  </span>
                </div>
                <div className="text-xs text-[#A1A1A1]">Shipped: {item.date}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* In Progress */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 rounded-full bg-[#F97316] animate-pulse" />
            <h2 className="text-3xl font-bold">In Development</h2>
          </div>
          <div className="space-y-4">
            {roadmap.inProgress.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="p-6 bg-[#121212] rounded-xl border border-[#F97316]/30"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-white/70 mb-3">{item.description}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded border ${getCategoryColor(item.category)}`}>
                    {item.category}
                  </span>
                </div>
                <div className="text-xs text-[#F97316] font-medium">ETA: {item.eta}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Coming Soon */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 rounded-full bg-blue-400" />
            <h2 className="text-3xl font-bold">Coming Soon</h2>
          </div>
          <div className="space-y-4">
            {roadmap.comingSoon.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="p-6 bg-[#121212] rounded-xl border border-white/10 opacity-75"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-white/70 mb-3">{item.description}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded border ${getCategoryColor(item.category)}`}>
                    {item.category}
                  </span>
                </div>
                <div className="text-xs text-[#A1A1A1]">Planned: {item.eta}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Ideas */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 rounded-full bg-white/40" />
            <h2 className="text-3xl font-bold">Ideas Under Review</h2>
          </div>
          <p className="text-sm text-[#A1A1A1] mb-6">
            These are features we&apos;re considering based on user feedback. Vote counts are from our community.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {roadmap.ideas.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="p-6 bg-[#121212] rounded-xl border border-white/5"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold flex-1">{item.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-[#A1A1A1]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {item.votes}
                  </div>
                </div>
                <p className="text-sm text-white/60">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center bg-[#121212] rounded-xl border border-white/10 p-12"
        >
          <h2 className="text-3xl font-bold mb-4 font-display">Have a Feature Request?</h2>
          <p className="text-[#A1A1A1] mb-8 max-w-2xl mx-auto">
            We&apos;re always listening to feedback from contractors. Your input shapes what we build next.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/signup')}
              className="px-8 py-4 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
            >
              Start Free Trial
            </button>
            <a
              href="mailto:feedback@riskmate.com"
              className="px-8 py-4 border border-white/10 hover:border-white/20 text-white rounded-lg font-semibold transition-colors"
            >
              Send Feedback
            </a>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

