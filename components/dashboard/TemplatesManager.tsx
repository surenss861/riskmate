'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { riskApi } from '@/lib/api'
import { TemplateUpgradeModal } from './TemplateUpgradeModal'
import { TemplateDetailDrawer } from './TemplateDetailDrawer'
import { trackEvent } from '@/lib/posthog'
import { Check } from 'lucide-react'

interface HazardTemplate {
  id: string
  organization_id: string
  name: string
  trade?: string
  description?: string
  hazard_ids: string[]
  created_by: string
  created_at: string
  updated_at: string
  archived: boolean
}

interface JobTemplate {
  id: string
  organization_id: string
  name: string
  trade?: string
  job_type?: string
  client_type?: string
  description?: string
  hazard_template_ids: string[]
  mitigation_template_ids: string[]
  created_at: string
  updated_at: string
  archived: boolean
}

interface RiskFactor {
  id: string
  code: string
  name: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
}

interface TemplatesManagerProps {
  organizationId: string
  subscriptionTier?: string | null
}

type TemplateTab = 'hazard' | 'job'

export function TemplatesManager({ organizationId, subscriptionTier = 'starter' }: TemplatesManagerProps) {
  const [activeTab, setActiveTab] = useState<TemplateTab>('hazard')
  const [hazardTemplates, setHazardTemplates] = useState<HazardTemplate[]>([])
  const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<HazardTemplate | JobTemplate | null>(null)
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([])
  const [templateUsageCounts, setTemplateUsageCounts] = useState<Record<string, number>>({})
  const [selectedTemplateForDetail, setSelectedTemplateForDetail] = useState<HazardTemplate | JobTemplate | null>(null)

  useEffect(() => {
    loadTemplates()
    loadRiskFactors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const loadRiskFactors = async () => {
    try {
      const response = await riskApi.getFactors()
      setRiskFactors(response.data)
    } catch (err) {
      console.error('Failed to load risk factors:', err)
    }
  }

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      
      if (activeTab === 'hazard') {
        const { data, error } = await supabase
          .from('hazard_templates')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('archived', false)

        if (error) throw error
        
        // Load usage counts first
        const counts = await loadUsageCounts(data || [])
        
        // Sort by usage count (desc), then by updated_at (desc)
        const sorted = [...(data || [])].sort((a, b) => {
          const usageA = counts[a.id] || 0
          const usageB = counts[b.id] || 0
          if (usageA !== usageB) {
            return usageB - usageA // Higher usage first
          }
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        })
        
        setHazardTemplates(sorted)
      } else {
        const { data, error } = await supabase
          .from('job_templates')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('archived', false)

        if (error) throw error
        
        // Load usage counts first
        const counts = await loadUsageCounts(data || [])
        
        // Sort by usage count (desc), then by updated_at (desc)
        const sorted = [...(data || [])].sort((a, b) => {
          const usageA = counts[a.id] || 0
          const usageB = counts[b.id] || 0
          if (usageA !== usageB) {
            return usageB - usageA // Higher usage first
          }
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        })
        
        setJobTemplates(sorted)
      }
    } catch (err: any) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUsageCounts = async (templates: (HazardTemplate | JobTemplate)[]): Promise<Record<string, number>> => {
    try {
      const supabase = createSupabaseBrowserClient()
      const counts: Record<string, number> = {}

      // Query real usage counts from jobs table
      for (const template of templates) {
        const templateType = activeTab === 'hazard' ? 'hazard' : 'job'
        const { count, error } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('applied_template_id', template.id)
          .eq('applied_template_type', templateType)

        if (!error) {
          counts[template.id] = count || 0
        } else {
          counts[template.id] = 0
        }
      }

      setTemplateUsageCounts((prev) => ({ ...prev, ...counts }))
      return counts
    } catch (err) {
      console.error('Failed to load usage counts:', err)
      // Fallback to 0 if query fails
      const counts: Record<string, number> = {}
      templates.forEach((t) => {
        counts[t.id] = 0
      })
      setTemplateUsageCounts((prev) => ({ ...prev, ...counts }))
      return counts
    }
  }

  const checkTemplateLimit = async (): Promise<{ canCreate: boolean; currentCount: number; limit: number }> => {
    if (subscriptionTier === 'pro' || subscriptionTier === 'business') {
      return { canCreate: true, currentCount: 0, limit: Infinity }
    }

    // Starter: 3 templates max (hazard + job combined)
    const supabase = createSupabaseBrowserClient()
    const { count: hazardCount } = await supabase
      .from('hazard_templates')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('archived', false)

    const { count: jobCount } = await supabase
      .from('job_templates')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('archived', false)

    const totalTemplates = (hazardCount || 0) + (jobCount || 0)
    return { canCreate: totalTemplates < 3, currentCount: totalTemplates, limit: 3 }
  }

  const templateLimitInfo = useMemo(() => {
    if (subscriptionTier === 'pro' || subscriptionTier === 'business') {
      return { current: 0, limit: Infinity, isUnlimited: true }
    }
    const total = hazardTemplates.length + jobTemplates.length
    return { current: total, limit: 3, isUnlimited: false }
  }, [subscriptionTier, hazardTemplates.length, jobTemplates.length])

  const handleArchive = async (templateId: string) => {
    const usageCount = templateUsageCounts[templateId] || 0
    
    if (usageCount > 0) {
      if (!confirm(`This template is used in ${usageCount} job${usageCount !== 1 ? 's' : ''}. Archiving will hide it from new jobs but existing jobs will still reference it. Continue?`)) return
    } else {
      if (!confirm('Are you sure you want to archive this template?')) return
    }

    try {
      const supabase = createSupabaseBrowserClient()
      const table = activeTab === 'hazard' ? 'hazard_templates' : 'job_templates'
      
      const { error } = await supabase
        .from(table)
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq('id', templateId)

      if (error) throw error
      loadTemplates()
    } catch (err: any) {
      console.error('Failed to archive template:', err)
      alert('Failed to archive template')
    }
  }

  const handleDuplicate = async (template: HazardTemplate | JobTemplate) => {
    try {
      const supabase = createSupabaseBrowserClient()
      const table = activeTab === 'hazard' ? 'hazard_templates' : 'job_templates'
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const newTemplate = {
        ...template,
        id: undefined,
        name: `${template.name} (Copy)`,
        created_at: undefined,
        updated_at: undefined,
        created_by: user.id,
      }
      delete (newTemplate as any).id
      delete (newTemplate as any).created_at
      delete (newTemplate as any).updated_at

      const { error } = await supabase.from(table).insert(newTemplate)

      if (error) throw error
      loadTemplates()
    } catch (err: any) {
      console.error('Failed to duplicate template:', err)
      alert('Failed to duplicate template')
    }
  }

  const currentTemplates = activeTab === 'hazard' ? hazardTemplates : jobTemplates

  const handleNewTemplate = async () => {
    const limitCheck = await checkTemplateLimit()
    if (!limitCheck.canCreate) {
      trackEvent('templates.limit_hit', {
        plan: subscriptionTier,
        current_count: limitCheck.currentCount,
        limit: limitCheck.limit,
      })
      setShowUpgradeModal(true)
      return
    }
    trackEvent('template.create_initiated', {
      plan: subscriptionTier,
      type: activeTab,
    })
    setEditingTemplate(null)
    setShowCreateModal(true)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">Templates</h3>
            {subscriptionTier === 'pro' || subscriptionTier === 'business' ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-[#F97316]/20 text-[#F97316] rounded border border-[#F97316]/30 flex items-center gap-1">
                <Check size={12} />
                Unlimited
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-white/5 text-white/70 rounded border border-white/10">
                {templateLimitInfo.current} of {templateLimitInfo.limit}
              </span>
            )}
          </div>
          <p className="text-xs text-white/50 mb-2">
            Save go-to hazard + job setups so your team can spin up jobs in 30 seconds.
          </p>
          {subscriptionTier === 'starter' && templateLimitInfo.current === 2 && (
            <p className="text-xs text-[#F97316] mt-1">
              You&apos;ve created {templateLimitInfo.current} of {templateLimitInfo.limit} templates on Starter. <span className="text-white/70">Pro/Business: Unlimited.</span>
            </p>
          )}
          {subscriptionTier === 'starter' && templateLimitInfo.current < 2 && (
            <p className="text-xs text-white/40 mt-1">
              Starter: {templateLimitInfo.limit} templates • Pro/Business: Unlimited
            </p>
          )}
        </div>
        <button
          onClick={handleNewTemplate}
          className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
        >
          + New Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10">
        <button
          onClick={() => setActiveTab('hazard')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'hazard'
              ? 'text-[#F97316] border-b-2 border-[#F97316]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Hazard Templates
        </button>
        <button
          onClick={() => setActiveTab('job')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'job'
              ? 'text-[#F97316] border-b-2 border-[#F97316]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Job Templates
        </button>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316] mx-auto mb-4" />
          <p className="text-sm text-white/50">Loading templates...</p>
        </div>
      ) : currentTemplates.length === 0 ? (
        <div className="text-center py-12 border border-white/10 rounded-lg bg-black/20">
          <div className="text-4xl mb-4">📋</div>
          {activeTab === 'hazard' ? (
            <>
              <p className="text-sm font-medium text-white mb-2">
                No hazard templates yet
              </p>
              <p className="text-xs text-white/60 mb-3 max-w-md mx-auto">
                Create a hazard bundle (e.g., &apos;Electrical Work&apos; or &apos;Roof Tear-Off&apos;) and reuse it across jobs.
              </p>
              <p className="text-xs text-white/40 mb-4 italic">
                Suggested examples: &apos;Residential Roof Tear-Off&apos;, &apos;Panel Upgrade&apos;, &apos;Confined Space Entry&apos;
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-white mb-2">
                No job templates yet
              </p>
              <p className="text-xs text-white/60 mb-3 max-w-md mx-auto">
                Save whole job setups with hazards + mitigations pre-loaded.
              </p>
              <p className="text-xs text-white/40 mb-4 italic">
                Suggested examples: &apos;Residential Service Call&apos;, &apos;Commercial Roof Replacement&apos;
              </p>
            </>
          )}
          <button
            onClick={handleNewTemplate}
            className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold text-sm transition-colors"
          >
            + New Template
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {currentTemplates.map((template) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => setSelectedTemplateForDetail(template)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">{template.name}</h4>
                  {activeTab === 'hazard' && (template as HazardTemplate).trade && (
                    <p className="text-xs text-white/50 mb-1">
                      Trade: {(template as HazardTemplate).trade}
                    </p>
                  )}
                  {activeTab === 'job' && (template as JobTemplate).job_type && (
                    <p className="text-xs text-white/50 mb-1">
                      Job Type: {(template as JobTemplate).job_type}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                    <span>
                      {activeTab === 'hazard'
                        ? `${(template as HazardTemplate).hazard_ids?.length || 0} hazards`
                        : `${(template as JobTemplate).hazard_template_ids?.length || 0} hazard templates`}
                    </span>
                    <span>
                      Used in {templateUsageCounts[template.id] || 0} job{templateUsageCounts[template.id] !== 1 ? 's' : ''}
                    </span>
                    <span>
                      Updated {new Date(template.updated_at || template.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingTemplate(template)
                      setShowCreateModal(true)
                    }}
                    className="px-3 py-1 text-xs text-white/70 hover:text-white border border-white/10 rounded hover:bg-white/5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDuplicate(template)
                    }}
                    className="px-3 py-1 text-xs text-white/70 hover:text-white border border-white/10 rounded hover:bg-white/5 transition-colors"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleArchive(template.id)
                    }}
                    className="px-3 py-1 text-xs text-white/70 hover:text-white border border-white/10 rounded hover:bg-white/5 transition-colors"
                  >
                    Archive
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <TemplateModal
          type={activeTab}
          template={editingTemplate}
          organizationId={organizationId}
          subscriptionTier={subscriptionTier}
          riskFactors={riskFactors}
          usageCount={editingTemplate ? templateUsageCounts[editingTemplate.id] || 0 : 0}
          onClose={() => {
            setShowCreateModal(false)
            setEditingTemplate(null)
          }}
          onSave={() => {
            setShowCreateModal(false)
            setEditingTemplate(null)
            trackEvent('template.created', {
              plan: subscriptionTier,
              type: activeTab,
              organization_id: organizationId,
            })
            loadTemplates()
          }}
        />
      )}

      {/* Template Detail Drawer */}
      {selectedTemplateForDetail && (
        <TemplateDetailDrawer
          template={selectedTemplateForDetail}
          type={activeTab}
          organizationId={organizationId}
          usageCount={templateUsageCounts[selectedTemplateForDetail.id] || 0}
          riskFactors={riskFactors}
          onClose={() => setSelectedTemplateForDetail(null)}
          onEdit={() => {
            setEditingTemplate(selectedTemplateForDetail)
            setSelectedTemplateForDetail(null)
            setShowCreateModal(true)
          }}
        />
      )}

      {/* Upgrade Modal */}
      <TemplateUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentCount={templateLimitInfo.current}
        limit={templateLimitInfo.limit}
      />
    </div>
  )
}

// Export TemplateModal for use in Job Detail
export interface TemplateModalProps {
  type: TemplateTab
  template: HazardTemplate | JobTemplate | null
  organizationId: string
  subscriptionTier?: string | null
  riskFactors: RiskFactor[]
  usageCount?: number // For showing warning when editing templates in use
  prefillData?: { name: string; trade?: string; hazardIds: string[] } // For pre-filling from job
  onClose: () => void
  onSave: () => void
  onSaveAndApply?: (templateId: string, hazardIds: string[]) => void // Optional: for "Save & Apply Now" button
}

const SUGGESTED_TEMPLATE_NAMES = [
  'Residential Roof Tear-Off',
  'Electrical Panel Upgrade',
  'HVAC Maintenance Visit',
  'Trenching + Excavation Work',
  'High-Risk Commercial Job Template',
]

const TRADE_OPTIONS = [
  'Roofing',
  'Electrical',
  'HVAC',
  'Plumbing',
  'Landscaping',
  'Renovation',
  'General Contractor',
  'Other',
]

export function TemplateModal({
  type,
  template,
  organizationId,
  subscriptionTier = 'starter',
  riskFactors,
  usageCount = 0,
  prefillData,
  onClose,
  onSave,
  onSaveAndApply,
}: TemplateModalProps) {
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Ensure we're in the browser before rendering portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  // Don't render until mounted (SSR safety)
  if (!mounted) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
  }
  
  // Initialize form data - prioritize prefillData over template
  const [formData, setFormData] = useState({
    name: prefillData?.name || template?.name || '',
    trade: prefillData?.trade || (template as HazardTemplate)?.trade || '',
    description: (template as HazardTemplate)?.description || '',
    job_type: (template as JobTemplate)?.job_type || '',
    client_type: (template as JobTemplate)?.client_type || 'residential',
  })
  const [selectedHazards, setSelectedHazards] = useState<string[]>(
    prefillData?.hazardIds || (type === 'hazard' ? (template as HazardTemplate)?.hazard_ids || [] : [])
  )
  
  // Update form when prefillData changes
  useEffect(() => {
    if (prefillData) {
      setFormData((prev) => ({
        ...prev,
        name: prefillData.name || prev.name,
        trade: prefillData.trade || prev.trade,
      }))
      setSelectedHazards(prefillData.hazardIds || [])
    }
  }, [prefillData])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Get unique categories from risk factors
  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    riskFactors.forEach((f) => {
      if (f.category) categories.add(f.category)
    })
    return Array.from(categories).sort()
  }, [riskFactors])

  // Get selected hazard details for preview
  const selectedHazardDetails = useMemo(() => {
    return riskFactors.filter((f) => selectedHazards.includes(f.id))
  }, [selectedHazards, riskFactors])

  const filteredFactors = riskFactors.filter((factor) => {
    const matchesSearch = factor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factor.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSeverity = selectedSeverities.length === 0 || selectedSeverities.includes(factor.severity)
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(factor.category)
    return matchesSearch && matchesSeverity && matchesCategory
  })

  const toggleSeverity = (severity: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
    )
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    )
  }

  const handleSuggestedName = (name: string) => {
    setFormData({ ...formData, name })
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let createdTemplateId: string | null = null

      if (type === 'hazard') {
        const payload = {
          organization_id: organizationId,
          name: formData.name,
          trade: formData.trade || null,
          description: formData.description || null,
          hazard_ids: selectedHazards,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }

        if (template) {
          const { error } = await supabase
            .from('hazard_templates')
            .update(payload)
            .eq('id', template.id)
          if (error) throw error
          createdTemplateId = template.id
        } else {
          const { data, error } = await supabase.from('hazard_templates').insert(payload).select('id').single()
          if (error) throw error
          createdTemplateId = data.id
        }
        trackEvent('template.created', {
          plan: subscriptionTier,
          type: 'hazard',
          organization_id: organizationId,
        })
      } else {
        // Job template - simplified for v1
        const payload = {
          organization_id: organizationId,
          name: formData.name,
          trade: formData.trade || null,
          job_type: formData.job_type || null,
          client_type: formData.client_type || null,
          description: formData.description || null,
          hazard_template_ids: [], // Will be populated from selected hazards for now
          mitigation_template_ids: [],
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }

        if (template) {
          const { error } = await supabase
            .from('job_templates')
            .update(payload)
            .eq('id', template.id)
          if (error) throw error
          createdTemplateId = template.id
        } else {
          const { data, error } = await supabase.from('job_templates').insert(payload).select('id').single()
          if (error) throw error
          createdTemplateId = data.id
        }
        trackEvent('template.created', {
          plan: subscriptionTier,
          type: 'job',
          organization_id: organizationId,
        })
      }

      onSave()
      return { success: true, templateId: createdTemplateId, hazardIds: selectedHazards } // Success with template ID
    } catch (err: any) {
      console.error('Failed to save template:', err)
      alert(err.message || 'Failed to save template')
      return { success: false, templateId: null, hazardIds: [] } // Failure
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={handleContentClick}
        className="relative mx-4 my-8 w-full max-w-4xl rounded-xl border border-white/10 bg-[#121212] shadow-2xl p-6 max-h-[calc(100vh-4rem)] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {template ? 'Edit' : 'Create'} {type === 'hazard' ? 'Hazard' : 'Job'} Template
            </h2>
            {type === 'hazard' && (
              <p className="text-xs text-white/50 mt-1.5">
                Hazard templates let you pre-load hazards into jobs instantly. Perfect for repetitive work like roof tear-offs, electrical jobs, or HVAC maintenance.
              </p>
            )}
            {type === 'job' && (
              <p className="text-xs text-white/50 mt-1.5">
                Job templates save whole job setups with hazards + mitigations pre-loaded. Create once, use everywhere.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Template Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                placeholder="e.g., Residential Roof Tear-Off Hazards"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {SUGGESTED_TEMPLATE_NAMES.slice(0, 3).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSuggestedName(name)}
                    className="text-xs px-2 py-0.5 text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 rounded transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Trade / Category</label>
              <select
                value={formData.trade}
                onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
              >
                <option value="">Select a trade...</option>
                {TRADE_OPTIONS.map((trade) => (
                  <option key={trade} value={trade}>
                    {trade}
                  </option>
                ))}
              </select>
              {formData.trade === '' && (
                <p className="text-xs text-white/30 mt-1.5 italic">
                  Or type a custom trade name
                </p>
              )}
            </div>
          </div>

          {type === 'job' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Job Type</label>
                <select
                  value={formData.job_type}
                  onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                >
                  <option value="">Select job type</option>
                  <option value="repair">Repair</option>
                  <option value="installation">Installation</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inspection">Inspection</option>
                  <option value="remodel">Remodel</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Default Client Type</label>
                <select
                  value={formData.client_type}
                  onChange={(e) => setFormData({ ...formData, client_type: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="government">Government</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-white/60 mb-2">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
              placeholder="Brief description of when to use this template..."
            />
          </div>

          {/* Hazard Selection (for Hazard Templates) */}
          {type === 'hazard' && (
            <div>
              <label className="block text-sm text-white/60 mb-2">Select Hazards</label>
              
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search hazards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                />
              </div>

              {/* Severity Filter Chips */}
              <div className="mb-3">
                <p className="text-xs text-white/50 mb-2">Filter by Severity</p>
                <div className="flex flex-wrap gap-2">
                  {['critical', 'high', 'medium', 'low'].map((severity) => (
                    <button
                      key={severity}
                      type="button"
                      onClick={() => toggleSeverity(severity)}
                      className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                        selectedSeverities.includes(severity)
                          ? severity === 'critical'
                            ? 'bg-red-500/20 border-red-500/50 text-red-400'
                            : severity === 'high'
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : severity === 'medium'
                            ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                            : 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                      }`}
                    >
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter Chips */}
              {availableCategories.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-white/50 mb-2">Filter by Category</p>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                          selectedCategories.includes(category)
                            ? 'bg-[#F97316]/20 border-[#F97316]/50 text-[#F97316]'
                            : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Hazard List */}
              <div className="max-h-64 overflow-y-auto space-y-2 border border-white/10 rounded-lg p-4 bg-black/20">
                {filteredFactors.length === 0 ? (
                  <p className="text-sm text-white/50 text-center py-4">No hazards found</p>
                ) : (
                  filteredFactors.map((factor) => (
                    <label
                      key={factor.id}
                      className="flex items-start gap-3 p-2 rounded hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedHazards.includes(factor.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedHazards([...selectedHazards, factor.id])
                          } else {
                            setSelectedHazards(selectedHazards.filter((id) => id !== factor.id))
                          }
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{factor.name}</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              factor.severity === 'critical'
                                ? 'bg-red-500/20 text-red-400'
                                : factor.severity === 'high'
                                ? 'bg-orange-500/20 text-orange-400'
                                : factor.severity === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {factor.severity}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mt-0.5">{factor.category}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>

              {/* Preview Summary */}
              {selectedHazards.length > 0 && (
                <div className="mt-4 p-4 rounded-lg border border-[#F97316]/20 bg-[#F97316]/5">
                  <p className="text-sm font-medium text-white mb-2">
                    {selectedHazards.length} hazard{selectedHazards.length !== 1 ? 's' : ''} selected
                  </p>
                  <div className="space-y-1">
                    {selectedHazardDetails.slice(0, 5).map((hazard) => (
                      <div key={hazard.id} className="text-xs text-white/70 flex items-center gap-2">
                        <span className="text-[#F97316]">•</span>
                        <span>{hazard.name}</span>
                      </div>
                    ))}
                    {selectedHazardDetails.length > 5 && (
                      <p className="text-xs text-white/50 italic">
                        +{selectedHazardDetails.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-white hover:border-white/30 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {onSaveAndApply && (
              <button
                type="button"
                onClick={async () => {
                  const result = await handleSubmit()
                  if (result.success && result.templateId && result.hazardIds.length > 0) {
                    onSaveAndApply(result.templateId, result.hazardIds)
                  }
                }}
                disabled={loading || !formData.name || (type === 'hazard' && selectedHazards.length === 0)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
              >
                {loading ? 'Saving...' : 'Save & Apply Now'}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !formData.name}
              className={`px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                onSaveAndApply ? 'flex-1' : 'flex-1'
              }`}
            >
              {loading ? 'Saving...' : template ? 'Update Template' : 'Save Template'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  )
}
