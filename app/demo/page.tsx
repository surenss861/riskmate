'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'
import Link from 'next/link'

// Demo jobs data
const DEMO_JOBS = [
  {
    id: 'demo-001',
    client_name: 'Downtown Office Complex',
    location: '123 Main St, Suite 400, Toronto, ON',
    job_type: 'HVAC Installation',
    status: 'in_progress',
    risk_score: 78,
    risk_level: 'high',
    created_at: '2024-11-15T09:00:00Z',
    hazards: [
      { id: '1', type: 'Height work', severity: 'high', description: 'Rooftop installation requires fall protection' },
      { id: '2', type: 'Electrical', severity: 'critical', description: 'Live electrical panels in work area' },
      { id: '3', type: 'Confined space', severity: 'high', description: 'Equipment room access required' },
    ],
    mitigation_items: [
      { id: '1', title: 'Install guardrails at roof edges', done: true },
      { id: '2', title: 'Verify subcontractor COI is current', done: true },
      { id: '3', title: 'Post warning signs in public access areas', done: false },
      { id: '4', title: 'Lock out electrical panels before work', done: false },
      { id: '5', title: 'Assign safety spotter for height work', done: false },
    ],
    photos: [
      { id: '1', name: 'Before - Exposed panel', category: 'before' },
      { id: '2', name: 'During - Installation in progress', category: 'during' },
    ],
  },
  {
    id: 'demo-002',
    client_name: 'Residential Roof Replacement',
    location: '456 Oak Avenue, Vancouver, BC',
    job_type: 'Roofing',
    status: 'completed',
    risk_score: 85,
    risk_level: 'critical',
    created_at: '2024-11-10T08:00:00Z',
    hazards: [
      { id: '1', type: 'Fall from height', severity: 'critical', description: '8-story building, no guardrails' },
      { id: '2', type: 'Weather exposure', severity: 'high', description: 'Wind gusts up to 50 km/h expected' },
    ],
    mitigation_items: [
      { id: '1', title: 'Install edge protection system', done: true },
      { id: '2', title: 'Daily weather monitoring', done: true },
      { id: '3', title: 'Permit verification', done: true },
    ],
    photos: [
      { id: '1', name: 'Before - Old roof condition', category: 'before' },
      { id: '2', name: 'During - Work in progress', category: 'during' },
      { id: '3', name: 'After - Completed installation', category: 'after' },
    ],
  },
  {
    id: 'demo-003',
    client_name: 'Commercial Electrical Panel Upgrade',
    location: '789 Industrial Blvd, Calgary, AB',
    job_type: 'Electrical',
    status: 'draft',
    risk_score: 72,
    risk_level: 'high',
    created_at: '2024-11-20T10:00:00Z',
    hazards: [
      { id: '1', type: 'Live electrical work', severity: 'critical', description: '480V main panel upgrade' },
      { id: '2', type: 'Confined space', severity: 'high', description: 'Electrical room access' },
    ],
    mitigation_items: [
      { id: '1', title: 'Lockout/tagout procedures', done: false },
      { id: '2', title: 'Arc flash PPE required', done: false },
      { id: '3', title: 'Confined space entry permit', done: false },
    ],
    photos: [],
  },
]

export default function DemoPage() {
  const router = useRouter()
  const [selectedJob, setSelectedJob] = useState(DEMO_JOBS[0])
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [viewMode, setViewMode] = useState<'jobs' | 'job-detail' | 'pdf'>('jobs')

  const getScoreColor = (score: number) => {
    if (score >= 71) return 'text-red-400'
    if (score >= 41) return 'text-[#F97316]'
    return 'text-green-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 71) return 'bg-red-500/10 border-red-500/30'
    if (score >= 41) return 'bg-[#F97316]/10 border-[#F97316]/30'
    return 'bg-green-500/10 border-green-500/30'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'draft':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-white/10 text-white/60 border-white/10'
    }
  }

  if (viewMode === 'pdf') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <header className="border-b border-white/10 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/">
              <RiskMateLogo size="md" showText />
            </Link>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode('job-detail')}
                className="px-4 py-2 border border-white/10 hover:border-white/20 rounded-lg transition-colors text-sm"
              >
                ← Back to Job
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

        <main className="max-w-4xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#121212] rounded-xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-semibold mb-6">PDF Report Preview</h2>
            <div className="bg-white/5 rounded-lg p-8 border border-white/10 mb-6">
              <div className="aspect-[8.5/11] bg-white rounded flex items-center justify-center">
                <div className="text-center text-black">
                  <svg className="w-24 h-24 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p className="text-lg font-semibold mb-2">Sample Risk Report</p>
                  <p className="text-sm text-gray-600">{selectedJob.client_name}</p>
                  <p className="text-xs text-gray-500 mt-4">This is a preview. In the real app, you&apos;ll get a full branded PDF.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setViewMode('job-detail')}
                className="flex-1 px-6 py-3 border border-white/10 hover:border-white/20 text-white rounded-lg transition-colors"
              >
                Back to Job
              </button>
              <button
                onClick={() => router.push('/sample-report')}
                className="flex-1 px-6 py-3 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
              >
                Download Sample PDF
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    )
  }

  if (viewMode === 'job-detail') {
    const completedCount = selectedJob.mitigation_items.filter(m => m.done).length
    const totalCount = selectedJob.mitigation_items.length

    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <header className="border-b border-white/10 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/">
              <RiskMateLogo size="md" showText />
            </Link>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode('jobs')}
                className="px-4 py-2 border border-white/10 hover:border-white/20 rounded-lg transition-colors text-sm"
              >
                ← Back to Jobs
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

        <main className="max-w-7xl mx-auto px-6 py-12">
          {/* Job Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-5xl font-bold mb-3 font-display">{selectedJob.client_name}</h1>
            <p className="text-xl text-[#A1A1A1] mb-1">{selectedJob.location}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-[#A1A1A1]">{selectedJob.job_type}</span>
              <span className="text-[#A1A1A1]">•</span>
              <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(selectedJob.status)}`}>
                {selectedJob.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Risk Score Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-8 rounded-xl border ${getScoreBg(selectedJob.risk_score)} bg-[#121212]/80 backdrop-blur-sm`}
            >
              <div className="text-center mb-8">
                <div className={`text-8xl font-bold mb-3 ${getScoreColor(selectedJob.risk_score)}`}>
                  {selectedJob.risk_score}
                </div>
                <div className="text-2xl font-semibold mb-2 text-white">
                  {selectedJob.risk_level.toUpperCase()} RISK
                </div>
                <div className="text-sm text-[#A1A1A1]">
                  {selectedJob.hazards.length} hazard{selectedJob.hazards.length !== 1 ? 's' : ''} detected
                </div>
              </div>

              {/* Hazards List */}
              <div className="space-y-3 mb-8">
                {selectedJob.hazards.map((hazard) => (
                  <div key={hazard.id} className="flex items-start gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      hazard.severity === 'critical' ? 'bg-red-400' :
                      hazard.severity === 'high' ? 'bg-orange-400' :
                      'bg-yellow-400'
                    }`} />
                    <div className="flex-1">
                      <div className="font-medium text-white">{hazard.type}</div>
                      <div className="text-xs text-[#A1A1A1]">{hazard.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mitigation Progress */}
              {totalCount > 0 && (
                <div className="pt-6 border-t border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[#A1A1A1]">Mitigation Progress</span>
                    <span className="text-sm font-semibold text-white">
                      {completedCount}/{totalCount}
                    </span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-[#F97316] h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${(completedCount / totalCount) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </motion.div>

            {/* Mitigation Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm h-full"
            >
              <h2 className="text-2xl font-semibold mb-6 text-white">Mitigation Checklist</h2>
              <div className="space-y-2">
                {selectedJob.mitigation_items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 p-4 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      readOnly
                      className="mt-1 w-5 h-5 rounded border-white/20 bg-black/40 text-[#F97316] focus:ring-[#F97316] focus:ring-2"
                    />
                    <span className={`flex-1 text-sm ${item.done ? 'line-through text-[#A1A1A1]/50' : 'text-[#A1A1A1]'}`}>
                      {item.title}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-white/60 mt-6 pt-6 border-t border-white/10 text-center">
                In the real app, checking items updates the risk score automatically.
              </p>
            </motion.div>

            {/* Actions & Photos */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-8 rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm h-full flex flex-col"
            >
              <h2 className="text-2xl font-semibold mb-6 text-white">Actions</h2>

              <div className="space-y-3 mb-8 flex-1">
                <button
                  onClick={() => setViewMode('pdf')}
                  className="w-full px-6 py-4 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg transition-colors font-semibold"
                >
                  Generate PDF Report
                </button>
                <button
                  onClick={() => router.push('/sample-report')}
                  className="w-full px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  View Sample PDF
                </button>
              </div>

              {/* Photos */}
              {selectedJob.photos.length > 0 && (
                <div className="pt-6 border-t border-white/10">
                  <h3 className="text-lg font-semibold mb-4 text-white">Evidence Photos</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedJob.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="aspect-square bg-white/5 rounded-lg border border-white/10 flex items-center justify-center"
                      >
                        <div className="text-center">
                          <svg className="w-8 h-8 mx-auto mb-2 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-white/60">{photo.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-white/60 mt-4 text-center">
                    In the real app, photos are automatically timestamped and linked to jobs.
                  </p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Demo Notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-12 p-6 bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl text-center"
          >
            <p className="text-sm text-[#A1A1A1]">
              This is an interactive demo with sample data. <button
                onClick={() => router.push('/signup')}
                className="text-[#F97316] hover:text-[#FB923C] font-medium transition-colors"
              >
                Sign up
              </button> to create real jobs and generate unlimited reports.
            </p>
          </motion.div>
        </main>
      </div>
    )
  }

  // Jobs List View
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <RiskMateLogo size="md" showText />
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/50 bg-[#F97316]/20 px-3 py-1 rounded-full border border-[#F97316]/30">
              Interactive Demo
            </span>
            <button
              onClick={() => router.push('/signup')}
              className="px-6 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
            >
              Start Free →
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 font-display">Try RiskMate (No Login Required)</h1>
          <p className="text-xl text-[#A1A1A1] max-w-3xl">
            Click around this interactive demo to see how RiskMate works. View sample jobs, hazards, mitigations, and generate a PDF report.
          </p>
        </motion.div>

        {/* Jobs Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {DEMO_JOBS.map((job, index) => (
            <motion.button
              key={job.id}
              onClick={() => {
                setSelectedJob(job)
                setViewMode('job-detail')
              }}
              className="p-6 bg-[#121212] rounded-xl border border-white/10 hover:border-[#F97316]/30 transition-colors text-left group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-[#F97316] transition-colors">
                    {job.client_name}
                  </h3>
                  <p className="text-sm text-[#A1A1A1] mb-2">{job.location}</p>
                  <p className="text-xs text-[#A1A1A1]/70">{job.job_type}</p>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(job.risk_score)}`}>
                  {job.risk_score}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(job.status)}`}>
                  {job.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-[#A1A1A1]">
                  {job.hazards.length} hazard{job.hazards.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-sm text-[#A1A1A1]">Click to view details →</span>
                <svg className="w-5 h-5 text-[#F97316] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Demo Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12 p-6 bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl text-center"
        >
          <p className="text-sm text-[#A1A1A1] mb-4">
            This is an interactive demo with sample data. Click on any job to explore hazards, mitigations, and generate a PDF report.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/signup')}
              className="px-8 py-3 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => router.push('/sample-report')}
              className="px-8 py-3 border border-white/10 hover:border-white/20 text-white rounded-lg font-semibold transition-colors"
            >
              View Sample PDF
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
