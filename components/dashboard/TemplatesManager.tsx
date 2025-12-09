'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { riskApi } from '@/lib/api'

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
  const [editingTemplate, setEditingTemplate] = useState<HazardTemplate | JobTemplate | null>(null)
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([])

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
          .order('updated_at', { ascending: false })

        if (error) throw error
        setHazardTemplates(data || [])
      } else {
        const { data, error } = await supabase
          .from('job_templates')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('archived', false)
          .order('updated_at', { ascending: false })

        if (error) throw error
        setJobTemplates(data || [])
      }
    } catch (err: any) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const checkTemplateLimit = async (): Promise<boolean> => {
    if (subscriptionTier === 'pro' || subscriptionTier === 'business') {
      return true // Unlimited
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
    return totalTemplates < 3
  }

  const handleArchive = async (templateId: string) => {
    if (!confirm('Are you sure you want to archive this template?')) return

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

  return (
    <div className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Templates</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Create reusable presets for hazards and job types so your crew can spin up jobs in 10 seconds instead of 10 minutes.
          </p>
          {subscriptionTier === 'starter' && (
            <p className="text-xs text-[#F97316] mt-1">
              Starter: 3 templates • Pro/Business: Unlimited
            </p>
          )}
        </div>
        <button
          onClick={async () => {
            const canCreate = await checkTemplateLimit()
            if (!canCreate) {
              alert('Starter plans can create up to 3 templates. Upgrade to Pro for unlimited templates.')
              window.open('/pricing?from=templates', '_blank')
              return
            }
            setEditingTemplate(null)
            setShowCreateModal(true)
          }}
          className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold text-sm transition-colors"
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
          <p className="text-sm text-white/70 mb-2">
            No {activeTab === 'hazard' ? 'hazard' : 'job'} templates yet
          </p>
          <p className="text-xs text-white/40 mb-4">
            Create your first template to speed up job setup.
          </p>
          {subscriptionTier === 'starter' && (
            <p className="text-xs text-white/50 mb-4">
              Starter includes 3 templates. Pro/Business: unlimited.
            </p>
          )}
          <button
            onClick={async () => {
              const canCreate = await checkTemplateLimit()
              if (!canCreate) {
                alert('Starter plans can create up to 3 templates. Upgrade to Pro for unlimited templates.')
                window.open('/pricing?from=templates', '_blank')
                return
              }
              setEditingTemplate(null)
              setShowCreateModal(true)
            }}
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
              className="p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
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
                      Updated {new Date(template.updated_at || template.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingTemplate(template)
                      setShowCreateModal(true)
                    }}
                    className="px-3 py-1 text-xs text-white/70 hover:text-white border border-white/10 rounded hover:bg-white/5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDuplicate(template)}
                    className="px-3 py-1 text-xs text-white/70 hover:text-white border border-white/10 rounded hover:bg-white/5 transition-colors"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => handleArchive(template.id)}
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
          onClose={() => {
            setShowCreateModal(false)
            setEditingTemplate(null)
          }}
          onSave={() => {
            setShowCreateModal(false)
            setEditingTemplate(null)
            loadTemplates()
          }}
        />
      )}
    </div>
  )
}

// Template Modal Component
interface TemplateModalProps {
  type: TemplateTab
  template: HazardTemplate | JobTemplate | null
  organizationId: string
  subscriptionTier?: string | null
  riskFactors: RiskFactor[]
  onClose: () => void
  onSave: () => void
}

function TemplateModal({
  type,
  template,
  organizationId,
  subscriptionTier = 'starter',
  riskFactors,
  onClose,
  onSave,
}: TemplateModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: template?.name || '',
    trade: (template as HazardTemplate)?.trade || '',
    description: (template as HazardTemplate)?.description || '',
    job_type: (template as JobTemplate)?.job_type || '',
    client_type: (template as JobTemplate)?.client_type || 'residential',
  })
  const [selectedHazards, setSelectedHazards] = useState<string[]>(
    type === 'hazard' ? (template as HazardTemplate)?.hazard_ids || [] : []
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  const filteredFactors = riskFactors.filter((factor) => {
    const matchesSearch = factor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factor.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || factor.severity === severityFilter
    return matchesSearch && matchesSeverity
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

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
        } else {
          const { error } = await supabase.from('hazard_templates').insert(payload)
          if (error) throw error
        }
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
        } else {
          const { error } = await supabase.from('job_templates').insert(payload)
          if (error) throw error
        }
      }

      onSave()
    } catch (err: any) {
      console.error('Failed to save template:', err)
      alert(err.message || 'Failed to save template')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#121212] border border-white/10 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {template ? 'Edit' : 'Create'} {type === 'hazard' ? 'Hazard' : 'Job'} Template
          </h2>
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
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Trade / Category</label>
              <input
                type="text"
                value={formData.trade}
                onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                placeholder="e.g., Roofing, Electrical"
              />
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
              
              {/* Search and Filter */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Search hazards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                />
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

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
              <p className="text-xs text-white/40 mt-2">
                {selectedHazards.length} hazard{selectedHazards.length !== 1 ? 's' : ''} selected
              </p>
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
            <button
              type="submit"
              disabled={loading || !formData.name}
              className="flex-1 px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
