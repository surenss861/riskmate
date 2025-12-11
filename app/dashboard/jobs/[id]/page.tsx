'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { jobsApi, subscriptionsApi, riskApi } from '@/lib/api'
import { Toast } from '@/components/dashboard/Toast'
import ProtectedRoute from '@/components/ProtectedRoute'
import RiskMateLogo from '@/components/RiskMateLogo'
import { GenerationProgressModal } from '@/components/dashboard/GenerationProgressModal'
import { DashboardSkeleton } from '@/components/dashboard/SkeletonLoader'
import { EditableText } from '@/components/dashboard/EditableText'
import { EditableSelect } from '@/components/dashboard/EditableSelect'
import { VersionHistory } from '@/components/dashboard/VersionHistory'
import { JobAssignment } from '@/components/dashboard/JobAssignment'
import { EvidenceVerification } from '@/components/dashboard/EvidenceVerification'
import { TemplatesManager, TemplateModal, TemplateModalProps } from '@/components/dashboard/TemplatesManager'
import { ApplyTemplateInline } from '@/components/dashboard/ApplyTemplateInline'
import { buttonStyles, cardStyles, typography } from '@/lib/styles/design-system'
import { ErrorModal } from '@/components/dashboard/ErrorModal'
import { optimizePhoto } from '@/lib/utils/photoOptimization'
import { getGPSLocation } from '@/lib/utils/gpsMetadata'
import { hasPermission } from '@/lib/utils/permissions'

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
  applied_template_id?: string | null
  applied_template_type?: 'hazard' | 'job' | null
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
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showApplyTemplate, setShowApplyTemplate] = useState(false)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [riskFactors, setRiskFactors] = useState<any[]>([])
  const [prefillTemplateData, setPrefillTemplateData] = useState<{ name: string; trade?: string; hazardIds: string[] } | null>(null)
  const [appliedTemplate, setAppliedTemplate] = useState<{ id: string; name: string; type: 'hazard' | 'job' } | null>(null)

  const loadJob = useCallback(async () => {
    try {
      const response = await jobsApi.get(jobId)
      setJob(response.data)
      
      // Load applied template info if exists
      if (response.data.applied_template_id && response.data.applied_template_type) {
        const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
        const supabase = createSupabaseBrowserClient()
        const table = response.data.applied_template_type === 'hazard' ? 'hazard_templates' : 'job_templates'
        
        const { data: templateData } = await supabase
          .from(table)
          .select('id, name, archived')
          .eq('id', response.data.applied_template_id)
          .single()
        
        if (templateData) {
          setAppliedTemplate({
            id: templateData.id,
            name: templateData.name + (templateData.archived ? ' (Archived)' : ''),
            type: response.data.applied_template_type,
          })
        }
      } else {
        setAppliedTemplate(null)
      }
      
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

  // Load subscription tier, permit packs, organization ID, and risk factors
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await subscriptionsApi.get()
        setSubscriptionTier(response.data?.tier || null)

        // Load risk factors for template creation
        const riskResponse = await riskApi.getFactors()
        setRiskFactors(riskResponse.data)

        // Load organization ID
        const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: userRow } = await supabase
            .from('users')
            .select('organization_id')
            .eq('id', user.id)
            .single()
          if (userRow?.organization_id) {
            setOrganizationId(userRow.organization_id)
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }
    loadData()
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
        setError('Couldn\'t generate permit pack. Nothing was lost — try again in a moment.')
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

  const currentRiskFactorCodes = job.risk_score_detail?.factors
    ? job.risk_score_detail.factors.map((f) => f.code)
    : []

  const handleApplyTemplate = async (
    hazardIds: string[],
    templateId: string,
    templateType: 'hazard' | 'job',
    replaceExisting: boolean = false
  ) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hazard_ids: hazardIds,
          template_id: templateId,
          template_type: templateType,
          replace_existing: replaceExisting,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to apply template')
      }

      const { data } = await response.json()
      setJob(data)
      loadJob() // Reload to get fresh data
    } catch (err: any) {
      console.error('Failed to apply template:', err)
      setError(err.message || 'Failed to apply template')
    }
  }

  const handleSaveAndApplyTemplate = async (templateId: string, hazardIds: string[]) => {
    try {
      // Convert hazard IDs to risk factor codes
      const hazardCodes = riskFactors
        .filter((rf) => hazardIds.includes(rf.id))
        .map((rf) => rf.code)

      if (hazardCodes.length === 0) {
        throw new Error('No hazards to apply')
      }

      await handleApplyTemplate(hazardIds, templateId, 'hazard', false)
      setShowCreateTemplate(false)
      setPrefillTemplateData(null)
      setToast({ message: 'Template saved and applied to this job!', type: 'success' })
    } catch (err: any) {
      console.error('Failed to save and apply template:', err)
      setToast({ message: err.message || 'Failed to save and apply template', type: 'error' })
    }
  }

  const handleSaveAsTemplate = () => {
    if (!job || !job.risk_score_detail || job.risk_score_detail.factors.length === 0) {
      setToast({ message: 'No hazards to save as template', type: 'error' })
      return
    }

    // Get current hazard IDs from risk factors
    const currentHazardCodes = job.risk_score_detail.factors.map((f) => f.code)
    const currentHazardIds = riskFactors
      .filter((rf) => currentHazardCodes.includes(rf.code))
      .map((rf) => rf.id)

    // Pre-fill template data
    setPrefillTemplateData({
      name: `${job.client_name} - ${job.job_type}`,
      trade: job.job_type, // Use job_type as trade hint
      hazardIds: currentHazardIds,
    })

    setShowCreateTemplate(true)
  }

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
                className={buttonStyles.secondary}
              >
                View Report
              </button>
              {subscriptionTier === 'business' && (
                <button
                  onClick={handleGeneratePermitPack}
                  disabled={generatingPermitPack}
                  className={`${buttonStyles.primary} flex items-center gap-2`}
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
            <div className="flex items-center gap-3 mb-1">
              <p className="text-xl text-[#A1A1A1]">{job.location}</p>
              {appliedTemplate && (
                <span className="px-3 py-1 text-xs font-medium bg-[#F97316]/20 text-[#F97316] rounded-lg border border-[#F97316]/30 flex items-center gap-1.5">
                  <span>📋</span>
                  <span>From template: {appliedTemplate.name}</span>
                  <button
                    onClick={() => {
                      // Open template in Account page (new tab)
                      window.open(`/dashboard/account#template-${appliedTemplate.id}`, '_blank')
                    }}
                    className="text-[#F97316] hover:text-[#FB923C] underline text-xs"
                  >
                    View
                  </button>
                </span>
              )}
            </div>
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

                {/* Risk & Hazards Section */}
                <div className="pt-6 border-t border-white/10 mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className={`${typography.h4} mb-1`}>Risk & Hazards</h3>
                      <p className="text-xs text-white/50">
                        {job.risk_score_detail?.factors.length || 0} hazard{job.risk_score_detail?.factors.length !== 1 ? 's' : ''} identified
                      </p>
                    </div>
                    {organizationId && (
                      <div className="flex items-center gap-2">
                        {!job.applied_template_id && job.risk_score_detail && job.risk_score_detail.factors.length > 0 && (
                          <button
                            onClick={handleSaveAsTemplate}
                            className={buttonStyles.tertiary}
                            title="Save this job setup as a reusable template"
                          >
                            💾 Save as Template
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setPrefillTemplateData(null)
                            setShowCreateTemplate(true)
                          }}
                          className={buttonStyles.tertiary}
                        >
                          + Create Template
                        </button>
                        <button
                          onClick={() => setShowApplyTemplate(true)}
                          className={buttonStyles.primary}
                        >
                          Quick-Load Template
                        </button>
                      </div>
                    )}
                  </div>
                  {job.risk_score_detail && job.risk_score_detail.factors.length > 0 ? (
                    <div className="space-y-2">
                      {job.risk_score_detail.factors.map((factor, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-black/20"
                        >
                          <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                          <div className="flex-1">
                            <div className="text-sm text-white">{factor.name}</div>
                            <div className="text-xs text-white/50 mt-0.5">
                              {factor.severity} severity • +{factor.weight} points
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-white/10 rounded-lg bg-black/20">
                      <p className="text-sm text-white/50 mb-2">No hazards identified yet</p>
                      <p className="text-xs text-white/40">
                        Quick-load a template or add hazards manually to get started
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <div className="p-8 rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm h-full">
                    <div className="mb-6">
                      <h2 className={`${typography.h2} mb-2`}>Mitigation Checklist</h2>
                      <p className="text-sm text-white/60">
                        These are the safety actions required to reduce the job&apos;s overall risk.
                      </p>
                    </div>
                {totalCount === 0 ? (
                  <p className="text-sm text-[#A1A1A1]">
                    <p className="text-sm text-white/50 mb-2">No checklist items yet</p>
                    <p className="text-xs text-white/40">
                      Add hazards to automatically generate your safety checklist.
                    </p>
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
                <h2 className={`${typography.h2} mb-6`}>Job Details</h2>

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
                    className={`${buttonStyles.primary} w-full`}
                  >
                    View Live Report →
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/jobs/${jobId}/edit`)}
                    className={`${buttonStyles.secondary} w-full`}
                  >
                    Edit Job Details
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Apply Template Inline - Full Width Section */}
          {showApplyTemplate && organizationId && (
            <ApplyTemplateInline
              jobId={jobId}
              organizationId={organizationId}
              currentRiskFactorCodes={currentRiskFactorCodes}
              onClose={() => setShowApplyTemplate(false)}
              onApply={handleApplyTemplate}
            />
          )}

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
                    <h2 className={`${typography.h2} mb-2`}>Permit Packs</h2>
                    <p className="text-sm text-[#A1A1A1]">
                      Downloadable ZIP bundles containing all job documents, photos, and compliance materials
                    </p>
                  </div>
                  <button
                    onClick={handleGeneratePermitPack}
                    disabled={generatingPermitPack}
                    className={`${buttonStyles.primary} flex items-center gap-2`}
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

              {/* Job Assignment */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8"
              >
                <JobAssignment
                  jobId={jobId}
                  workers={[]} // TODO: Fetch from team API
                  onAssign={async (workerId) => {
                    // TODO: Implement assignment API
                    console.log('Assign worker:', workerId)
                  }}
                  onUnassign={async (workerId) => {
                    // TODO: Implement unassignment API
                    console.log('Unassign worker:', workerId)
                  }}
                  onCheckIn={async (workerId) => {
                    // TODO: Implement check-in API
                    console.log('Check in worker:', workerId)
                  }}
                  onCheckOut={async (workerId) => {
                    // TODO: Implement check-out API
                    console.log('Check out worker:', workerId)
                  }}
                  userRole="admin" // TODO: Get from user context
                />
              </motion.div>

              {/* Evidence Verification */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-8"
              >
                <EvidenceVerification
                  jobId={jobId}
                  items={[]} // TODO: Fetch from documents/mitigations API
                  onVerify={async (id, status, reason) => {
                    // TODO: Implement verification API
                    console.log('Verify evidence:', id, status, reason)
                  }}
                  userRole="admin" // TODO: Get from user context
                />
              </motion.div>

              {/* Version History */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
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

      {/* Create Template Modal */}
      {showCreateTemplate && organizationId && riskFactors.length > 0 && (
        <TemplateModal
          type="hazard"
          template={null}
          organizationId={organizationId}
          subscriptionTier={subscriptionTier}
          riskFactors={riskFactors}
          usageCount={0}
          prefillData={prefillTemplateData || undefined}
          onClose={() => {
            setShowCreateTemplate(false)
            setPrefillTemplateData(null)
          }}
          onSave={() => {
            setShowCreateTemplate(false)
            setPrefillTemplateData(null)
            setToast({ message: 'Template created successfully!', type: 'success' })
          }}
          onSaveAndApply={handleSaveAndApplyTemplate}
        />
      )}

      {/* Toast Notification */}
      <Toast
        message={toast?.message || ''}
        type={toast?.type || 'success'}
        isOpen={toast !== null}
        onClose={() => setToast(null)}
      />

      <ErrorModal
        isOpen={error !== null}
        title="Error"
        message={error || ''}
        onClose={() => setError(null)}
      />
    </ProtectedRoute>
  )
}

