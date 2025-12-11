'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { riskApi } from '@/lib/api'

interface HazardTemplate {
  id: string
  name: string
  trade?: string
  description?: string
  hazard_ids: string[]
}

interface JobTemplate {
  id: string
  name: string
  trade?: string
  job_type?: string
  hazard_template_ids: string[]
}

interface ApplyTemplateModalProps {
  jobId: string
  organizationId: string
  currentRiskFactorCodes: string[]
  onClose: () => void
  onApply: (hazardIds: string[], templateId: string, templateType: 'hazard' | 'job', replaceExisting: boolean) => Promise<void>
}

export function ApplyTemplateModal({
  jobId,
  organizationId,
  currentRiskFactorCodes,
  onClose,
  onApply,
}: ApplyTemplateModalProps) {
  const [activeTab, setActiveTab] = useState<'job' | 'hazard'>('job')
  const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>([])
  const [hazardTemplates, setHazardTemplates] = useState<HazardTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [previewHazards, setPreviewHazards] = useState<any[]>([])
  const [riskFactors, setRiskFactors] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadTemplates()
    loadRiskFactors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedTemplate) {
      loadPreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate, activeTab])

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
      
      const { data: jobTemplatesData } = await supabase
        .from('job_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('archived', false)
        .order('name')

      setJobTemplates(jobTemplatesData || [])

      const { data: hazardTemplatesData } = await supabase
        .from('hazard_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('archived', false)
        .order('name')

      setHazardTemplates(hazardTemplatesData || [])
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadPreview = async () => {
    if (!selectedTemplate) return

    try {
      const supabase = createSupabaseBrowserClient()
      let hazardIds: string[] = []

      if (activeTab === 'job') {
        const template = jobTemplates.find((t) => t.id === selectedTemplate)
        if (!template) return

        if (template.hazard_template_ids && template.hazard_template_ids.length > 0) {
          const { data: hazardTemplatesData } = await supabase
            .from('hazard_templates')
            .select('hazard_ids')
            .in('id', template.hazard_template_ids)

          hazardIds = hazardTemplatesData?.flatMap((ht) => ht.hazard_ids || []) || []
        }
      } else {
        const template = hazardTemplates.find((t) => t.id === selectedTemplate)
        if (!template) return
        hazardIds = template.hazard_ids || []
      }

      // Get risk factors for preview
      const factors = riskFactors.filter((rf) => hazardIds.includes(rf.id))
      setPreviewHazards(factors)
    } catch (err) {
      console.error('Failed to load preview:', err)
    }
  }

  const handleApply = async () => {
    if (!selectedTemplate) return

    setApplying(true)
    try {
      const supabase = createSupabaseBrowserClient()
      let hazardIds: string[] = []

      if (activeTab === 'job') {
        const template = jobTemplates.find((t) => t.id === selectedTemplate)
        if (!template) return

        if (template.hazard_template_ids && template.hazard_template_ids.length > 0) {
          const { data: hazardTemplatesData } = await supabase
            .from('hazard_templates')
            .select('hazard_ids')
            .in('id', template.hazard_template_ids)

          hazardIds = hazardTemplatesData?.flatMap((ht) => ht.hazard_ids || []) || []
        }
      } else {
        const template = hazardTemplates.find((t) => t.id === selectedTemplate)
        if (!template) return
        hazardIds = template.hazard_ids || []
      }

      if (hazardIds.length === 0) {
        alert('This template has no hazards to apply')
        setApplying(false)
        return
      }

      await onApply(hazardIds, selectedTemplate, activeTab, replaceExisting)
      
      // Track template application
      const { trackTemplateApplied } = await import('@/lib/posthog')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userRow } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .single()
        if (userRow?.organization_id) {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('tier')
            .eq('organization_id', userRow.organization_id)
            .eq('status', 'active')
            .single()
          trackTemplateApplied(subData?.tier || 'starter', activeTab, 'job-detail')
        }
      }
      onClose()
    } catch (err: any) {
      console.error('Failed to apply template:', err)
      alert(err.message || 'Failed to apply template')
    } finally {
      setApplying(false)
    }
  }

  const filteredTemplates = activeTab === 'job'
    ? jobTemplates.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : hazardTemplates.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const newHazards = previewHazards.filter((h) => !currentRiskFactorCodes.includes(h.code))
  const existingHazards = previewHazards.filter((h) => currentRiskFactorCodes.includes(h.code))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#121212] border border-white/10 rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Apply Template</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          <button
            onClick={() => {
              setActiveTab('job')
              setSelectedTemplate(null)
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'job'
                ? 'text-[#F97316] border-b-2 border-[#F97316]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Job Templates
          </button>
          <button
            onClick={() => {
              setActiveTab('hazard')
              setSelectedTemplate(null)
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'hazard'
                ? 'text-[#F97316] border-b-2 border-[#F97316]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Hazard Templates
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316] mx-auto mb-4" />
            <p className="text-sm text-white/50">Loading templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-12 border border-white/10 rounded-lg bg-black/20">
            <p className="text-sm text-white/70 mb-2">No templates found</p>
            <p className="text-xs text-white/40">
              {searchQuery ? 'Try a different search term' : 'Create templates in Account Settings'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Template List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-[#F97316] bg-[#F97316]/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{template.name}</div>
                      {template.trade && (
                        <div className="text-xs text-white/50 mt-1">Trade: {template.trade}</div>
                      )}
                      {activeTab === 'job' && (template as JobTemplate).job_type && (
                        <div className="text-xs text-white/50 mt-1">
                          Job Type: {(template as JobTemplate).job_type}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-white/40">
                      {activeTab === 'job'
                        ? `${(template as JobTemplate).hazard_template_ids?.length || 0} hazard templates`
                        : `${(template as HazardTemplate).hazard_ids?.length || 0} hazards`}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Preview */}
            {selectedTemplate && previewHazards.length > 0 && (
              <div className="mt-6 p-4 rounded-lg border border-white/10 bg-black/20">
                <h3 className="text-sm font-semibold text-white mb-3">Preview</h3>
                
                {existingHazards.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-white/50 mb-2">
                      {existingHazards.length} existing hazard{existingHazards.length !== 1 ? 's' : ''} (will be skipped)
                    </p>
                    <div className="space-y-1">
                      {existingHazards.map((h) => (
                        <div key={h.id} className="text-xs text-white/40 line-through">
                          {h.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {newHazards.length > 0 && (
                  <div>
                    <p className="text-xs text-white/50 mb-2">
                      {newHazards.length} new hazard{newHazards.length !== 1 ? 's' : ''} to add
                    </p>
                    <div className="space-y-1">
                      {newHazards.map((h) => (
                        <div key={h.id} className="text-xs text-white">
                          {h.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {newHazards.length === 0 && existingHazards.length > 0 && (
                  <p className="text-xs text-white/50">
                    All hazards from this template are already applied to this job.
                  </p>
                )}
              </div>
            )}

            {/* Replace Option */}
            {selectedTemplate && currentRiskFactorCodes.length > 0 && (
              <label className="flex items-center gap-2 p-3 rounded-lg border border-white/10 bg-black/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-black/40 text-[#F97316] focus:ring-[#F97316]"
                />
                <div>
                  <div className="text-sm font-medium text-white">Replace existing hazards</div>
                  <div className="text-xs text-white/50">
                    Remove current hazards and apply only template hazards
                  </div>
                </div>
              </label>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-6 mt-6 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={applying}
            className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-white hover:border-white/30 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying || !selectedTemplate || (previewHazards.length === 0 && !replaceExisting)}
            className="flex-1 px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? 'Applying...' : replaceExisting ? 'Replace & Apply' : 'Apply Template'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

