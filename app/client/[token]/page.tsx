'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'

interface ClientReport {
  job: {
    id: string
    client_name: string
    location: string
    job_type: string
    status: string
    created_at: string
  }
  risk_score: {
    overall_score: number
    risk_level: string
  }
  photos: Array<{
    id: string
    name: string
    url: string
    created_at: string
  }>
  permitPacks: Array<{
    id: string
    version: number
    download_url: string
    generated_at: string
  }>
}

export default function ClientPortalPage() {
  const params = useParams()
  const token = params.token as string
  const [report, setReport] = useState<ClientReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadReport = async () => {
      try {
        const response = await fetch(`/api/reports/share/${token}`)
        if (!response.ok) {
          throw new Error('Report not found or link expired')
        }
        const data = await response.json()
        setReport(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load report')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadReport()
    }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316] mx-auto mb-4" />
          <p className="text-[#A1A1A1]">Loading report...</p>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#A1A1A1] mb-4">{error || 'Report not found'}</p>
          <p className="text-sm text-white/50">
            This link may have expired or the report may have been removed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <RiskMateLogo size="md" showText />
          <p className="text-sm text-white/60">Client Portal</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">{report.job.client_name}</h1>
          <p className="text-xl text-white/60 mb-1">{report.job.location}</p>
          <p className="text-sm text-white/50">
            {report.job.job_type} • Created {new Date(report.job.created_at).toLocaleDateString()}
          </p>
        </motion.div>

        {/* Risk Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 p-6 rounded-xl border border-white/10 bg-[#121212]/80"
        >
          <h2 className="text-2xl font-semibold mb-4">Risk Assessment</h2>
          <div className="text-center">
            <div className="text-6xl font-bold text-[#F97316] mb-2">
              {report.risk_score.overall_score}
            </div>
            <div className="text-lg text-white/70">
              {report.risk_score.risk_level.toUpperCase()} Risk
            </div>
          </div>
        </motion.div>

        {/* Photos */}
        {report.photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-semibold mb-4">Photos</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {report.photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-[#F97316] transition-colors"
                >
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* Permit Packs */}
        {report.permitPacks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-2xl font-semibold mb-4">Permit Packs</h2>
            <div className="space-y-3">
              {report.permitPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="p-4 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Permit Pack v{pack.version}
                    </p>
                    <p className="text-xs text-white/50">
                      Generated {new Date(pack.generated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={pack.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold text-sm transition-colors"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}

