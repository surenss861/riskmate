'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { jobsApi, subscriptionsApi } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import RiskMateLogo from '@/components/RiskMateLogo'
import { GenerationProgressModal } from '@/components/dashboard/GenerationProgressModal'
import { DashboardSkeleton } from '@/components/dashboard/SkeletonLoader'
import { EditableText } from '@/components/dashboard/EditableText'
import { EditableSelect } from '@/components/dashboard/EditableSelect'
import { VersionHistory } from '@/components/dashboard/VersionHistory'

interface MitigationItem {
  id: string
  title: string
  description: string
  done: boolean
  is_completed: boolean
}

interface Job {
  id: string
  client_name: string
  client_type: string
  job_type: string
  location: string
  description: string
  status: string
  risk_score: number | null
  risk_level: string | null
  risk_score_detail: {
    overall_score: number
    risk_level: string
    factors: Array<{
      code: string
      name: string
      severity: string
      weight: number
    }>
  } | null
  mitigation_items: MitigationItem[]
  created_at: string
}

export default function JobDetailPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingMitigation, setUpdatingMitigation] = useState<string | null>(null)
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null)
  const [generatingPermitPack, setGeneratingPermitPack] = useState(false)
  const [permitPacks, setPermitPacks] = useState<Array<{
    id: string
    version: number
    file_path: string
    generated_at: string
    downloadUrl: string | null
  }>>([])
  const [loadingPermitPacks, setLoadingPermitPacks] = useState(false)

  const loadJob = useCallback(async () => {
    try {
      const response = await jobsApi.get(jobId)
      setJob(response.data)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load job:', err)
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    if (jobId) {
      loadJob()
    }
  }, [jobId, loadJob])

  // Load subscription tier and permit packs
  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const response = await subscriptionsApi.get()
        setSubscriptionTier(response.data?.tier || null)
      } catch (err) {
        console.error('Failed to load subscription:', err)
      }
    }
    loadSubscription()
  }, [])

  // Load permit packs for Business plan users
  useEffect(() => {
    const loadPermitPacks = async () => {
      if (subscriptionTier === 'business' && jobId) {
        setLoadingPermitPacks(true)
        try {
          const response = await jobsApi.getPermitPacks(jobId)
          setPermitPacks(response.data || [])
        } catch (err) {
          console.error('Failed to load permit packs:', err)
        } finally {
          setLoadingPermitPacks(false)
        }
      }
    }
    loadPermitPacks()
  }, [subscriptionTier, jobId])

  const handleGeneratePermitPack = async () => {
    if (!jobId) return

    setGeneratingPermitPack(true)
    setError(null)
    setShowProgressModal(true)
    
    try {
      const response = await jobsApi.generatePermitPack(jobId)
      
      if (response.success && response.data.downloadUrl) {
        // Wait for progress modal to show completion
        setTimeout(() => {
          // Open download URL in new tab
          window.open(response.data.downloadUrl, '_blank')
          
          // Reload permit packs list
          if (subscriptionTier === 'business') {
            jobsApi.getPermitPacks(jobId).then((packsResponse) => {
              setPermitPacks(packsResponse.data || [])
            })
          }
        }, 1000)
      } else {
        throw new Error('Failed to generate permit pack')
      }
    } catch (err: any) {
      console.error('Failed to generate permit pack:', err)
      setShowProgressModal(false)
      if (err.code === 'FEATURE_RESTRICTED') {
        setError('Permit Pack Generator is only available for Business plan subscribers. Upgrade to Business to access this feature.')
      } else {
        setError(err?.message || 'Failed to generate permit pack. Please try again.')
      }
    } finally {
      setGeneratingPermitPack(false)
    }
  }

  const toggleMitigation = async (itemId: string, currentDone: boolean) => {
    setUpdatingMitigation(itemId)
    try {
      if (job) {
        setJob({
          ...job,
          mitigation_items: job.mitigation_items.map((item) =>
            item.id === itemId
              ? { ...item, done: !currentDone, is_completed: !currentDone }
              : item
          ),
        })
      }
    } catch (err) {
      console.error('Failed to update mitigation:', err)
      if (job) {
        setJob({
          ...job,
          mitigation_items: job.mitigation_items.map((item) =>
            item.id === itemId ? { ...item, done: currentDone } : item
          ),
        })
      }
    } finally {
      setUpdatingMitigation(null)
    }
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    if (score >= 71) return 'text-red-400'
    if (score >= 41) return 'text-[#F97316]'
    return 'text-green-400'
  }

  const getScoreBg = (score: number | null) => {
    if (score === null) return 'bg-gray-500/10 border-gray-500/30'
    if (score >= 71) return 'bg-red-500/10 border-red-500/30'
    if (score >= 41) return 'bg-[#F97316]/10 border-[#F97316]/30'
    return 'bg-green-500/10 border-green-500/30'
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardSkeleton />
      </ProtectedRoute>
    )
  }

  if (!job) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-[#A1A1A1] mb-4">Job not found</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-[#F97316] hover:bg-[#FB923C] rounded-lg text-black font-semibold transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const completedCount = job.mitigation_items.filter((m) => m.done).length
  const totalCount = job.mitigation_items.length

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <header className="border-b border-white/5 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RiskMateLogo size="sm" showText={true} />
            </div>
            <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-[#A1A1A1] hover:text-white transition-colors"
            >
              ← Back to Dashboard
            </button>
              <button
                onClick={() => router.push(`/dashboard/jobs/${jobId}/report`)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:border-white/25 hover:bg-white/5"
              >
                View Report
              </button>
              {subscriptionTier === 'business' && (
                <button
                  onClick={handleGeneratePermitPack}
                  disabled={generatingPermitPack}
                  className="rounded-lg bg-[#F97316] px-4 py-2 text-sm text-black font-semibold transition hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generatingPermitPack ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                      Generating...
                    </>
                  ) : (
                    <>
                      📦 Generate Permit Pack
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <EditableText
              value={job.client_name}
              onSave={async (newValue) => {
                await jobsApi.update(jobId, { client_name: newValue })
                setJob({ ...job, client_name: newValue })
              }}
              className="text-5xl font-bold mb-3 font-display block"
              inputClassName="text-5xl font-bold"
            />
            <p className="text-xl text-[#A1A1A1] mb-1">{job.location}</p>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-sm text-[#A1A1A1]/70">
                {job.job_type} • {job.client_type}
              </p>
              <span className="text-[#A1A1A1]/50">•</span>
              <EditableSelect
                value={job.status}
                options={[
                  { value: 'draft', label: 'Draft', color: '#A1A1A1' },
                  { value: 'pending', label: 'Pending', color: '#FACC15' },
                  { value: 'in_progress', label: 'In Progress', color: '#38BDF8' },
                  { value: 'completed', label: 'Completed', color: '#29E673' },
                  { value: 'cancelled', label: 'Cancelled', color: '#FB7185' },
                ]}
                onSave={async (newValue) => {
                  await jobsApi.update(jobId, { status: newValue })
                  setJob({ ...job, status: newValue })
                }}
              />
            </div>
            <p className="text-xs text-white/50 mt-2">
              Status helps your team understand what stage this job is in.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <div className={`p-8 rounded-xl border ${getScoreBg(job.risk_score)} bg-[#121212]/80 backdrop-blur-sm`}>
                <div className="text-center mb-8">
                  <div className={`text-8xl font-bold mb-3 ${getScoreColor(job.risk_score)}`}>
                    {job.risk_score ?? '—'}
                  </div>
                  <div className="text-2xl font-semibold mb-2 text-white">
                    {job.risk_level ? `${job.risk_level.toUpperCase()} Risk` : 'No Score'}
                  </div>
                  {job.risk_score_detail && (
                    <div className="text-sm text-[#A1A1A1]">
                      {job.risk_score_detail.factors.length} risk factor{job.risk_score_detail.factors.length !== 1 ? 's' : ''} detected
                    </div>
                  )}
                  <p className="text-xs text-white/50 mt-3">
                    Scores update automatically as hazards and mitigations change.
                  </p>
                </div>

                {job.risk_score_detail && job.risk_score_detail.factors.length > 0 && (
                  <div className="space-y-3 mb-8">
                    {job.risk_score_detail.factors.map((factor, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                        <span className="text-[#A1A1A1]">{factor.name}</span>
                        <span className="text-xs text-[#A1A1A1]/70 ml-auto">+{factor.weight}</span>
                      </div>
                    ))}
                  </div>
                )}

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
                        style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <div className="p-8 rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm h-full">
                    <div className="mb-6">
                      <h2 className="text-2xl font-semibold mb-2 text-white">Mitigation Checklist</h2>
                      <p className="text-sm text-white/60">
                        These are the safety actions required to reduce the job&apos;s overall risk.
                      </p>
                    </div>
                {totalCount === 0 ? (
                  <p className="text-sm text-[#A1A1A1]">
                    No mitigation items yet. Update risk factors to generate checklist.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {job.mitigation_items.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-start gap-3 p-4 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleMitigation(item.id, item.done)}
                          disabled={updatingMitigation === item.id}
                          className="mt-1 w-5 h-5 rounded border-white/20 bg-black/40 text-[#F97316] focus:ring-[#F97316] focus:ring-2 disabled:opacity-50"
                        />
                        <span
                          className={`flex-1 text-sm ${
                            item.done ? 'line-through text-[#A1A1A1]/50' : 'text-[#A1A1A1]'
                          }`}
                        >
                          {item.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                    {totalCount > 0 && (
                      <p className="text-sm text-[#A1A1A1] mt-6 pt-6 border-t border-white/10">
                        Mark mitigations complete only after verifying the action was performed on-site.
                      </p>
                    )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <div className="p-8 rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm h-full flex flex-col">
                <h2 className="text-2xl font-semibold mb-6 text-white">Job Details</h2>

                <div className="space-y-4 mb-8 flex-1">
                  {job.description && (
                    <div>
                      <div className="text-xs text-[#A1A1A1] uppercase mb-1">Description</div>
                      <div className="text-sm text-white">{job.description}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-[#A1A1A1] uppercase mb-1">Created</div>
                    <div className="text-sm text-white">
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#A1A1A1] uppercase mb-1">Status</div>
                    <div className="text-sm text-white capitalize">{job.status}</div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 space-y-3">
                  <button
                    onClick={() => router.push(`/dashboard/jobs/${jobId}/report`)}
                    className="w-full px-6 py-3 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
                  >
                    View Live Report →
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/jobs/${jobId}/edit`)}
                    className="w-full px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Edit Job Details
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Permit Packs Section (Business Plan Only) */}
          {subscriptionTier === 'business' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-8"
            >
              <div className="p-8 rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold mb-2 text-white">Permit Packs</h2>
                    <p className="text-sm text-[#A1A1A1]">
                      Downloadable ZIP bundles containing all job documents, photos, and compliance materials
                    </p>
                  </div>
                  <button
                    onClick={handleGeneratePermitPack}
                    disabled={generatingPermitPack}
                    className="rounded-lg bg-[#F97316] px-6 py-3 text-sm text-black font-semibold transition hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {generatingPermitPack ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                        Generating...
                      </>
                    ) : (
                      <>
                        📦 Generate New Pack
                      </>
                    )}
                  </button>
                </div>

                {loadingPermitPacks ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316] mx-auto mb-4" />
                    <p className="text-sm text-[#A1A1A1]">Loading permit packs...</p>
                  </div>
                ) : permitPacks.length === 0 ? (
                  <div className="text-center py-8 border border-white/10 rounded-lg bg-black/20">
                    <p className="text-sm text-[#A1A1A1] mb-2">No permit packs generated yet</p>
                    <p className="text-xs text-[#A1A1A1]/70">
                      Click &quot;Generate New Pack&quot; to create your first permit pack
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {permitPacks.map((pack) => (
                      <div
                        key={pack.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-black/20 hover:bg-black/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#F97316]/20 flex items-center justify-center">
                            <span className="text-xl">📦</span>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">
                              Permit Pack v{pack.version}
                            </div>
                            <div className="text-xs text-[#A1A1A1]">
                              Generated {new Date(pack.generated_at).toLocaleDateString()} at{' '}
                              {new Date(pack.generated_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        {pack.downloadUrl ? (
                          <button
                            onClick={() => window.open(pack.downloadUrl!, '_blank')}
                            className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/10 transition-colors"
                          >
                            Download
                          </button>
                        ) : (
                          <span className="text-xs text-[#A1A1A1]">Unavailable</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
              )}

              {/* Version History */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8"
              >
                <VersionHistory
                  jobId={jobId}
                  entries={[]} // TODO: Fetch from audit_logs API
                />
              </motion.div>
        </div>
      </div>
      <GenerationProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        onComplete={() => {
          setShowProgressModal(false)
        }}
        type="permit-pack"
      />
    </ProtectedRoute>
  )
}

