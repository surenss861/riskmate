'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { jobsApi, riskApi } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import RiskMateLogo from '@/components/RiskMateLogo'

interface RiskFactor {
  id: string
  code: string
  name: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
}

export default function NewJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([])
  const [selectedRiskFactors, setSelectedRiskFactors] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [jobTemplates, setJobTemplates] = useState<any[]>([])
  const [hazardTemplates, setHazardTemplates] = useState<any[]>([])
  const [formData, setFormData] = useState({
    client_name: '',
    client_type: 'residential',
    job_type: 'repair',
    location: '',
    description: '',
    start_date: '',
    has_subcontractors: false,
    subcontractor_count: 0,
    insurance_status: 'pending',
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRiskFactors()
    loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedTemplate) {
      applyTemplate(selectedTemplate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate])

  const loadRiskFactors = async () => {
    try {
      const response = await riskApi.getFactors()
      setRiskFactors(response.data)
    } catch (err: any) {
      console.error('Failed to load risk factors:', err)
    }
  }

  const loadTemplates = async () => {
    try {
      const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userRow } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!userRow?.organization_id) return

      // Load job templates
      const { data: jobTemplatesData } = await supabase
        .from('job_templates')
        .select('*')
        .eq('organization_id', userRow.organization_id)
        .eq('archived', false)

      setJobTemplates(jobTemplatesData || [])

      // Load hazard templates
      const { data: hazardTemplatesData } = await supabase
        .from('hazard_templates')
        .select('*')
        .eq('organization_id', userRow.organization_id)
        .eq('archived', false)

      setHazardTemplates(hazardTemplatesData || [])
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  const applyTemplate = async (templateId: string) => {
    try {
      const template = jobTemplates.find((t) => t.id === templateId)
      if (!template) return

      // Pre-fill form fields
      if (template.job_type) setFormData((prev) => ({ ...prev, job_type: template.job_type }))
      if (template.client_type) setFormData((prev) => ({ ...prev, client_type: template.client_type }))
      if (template.description) setFormData((prev) => ({ ...prev, description: template.description }))

      // Apply hazard templates
      if (template.hazard_template_ids && template.hazard_template_ids.length > 0) {
        const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
        const supabase = createSupabaseBrowserClient()
        
        // Get all hazards from hazard templates
        const { data: hazardTemplatesData } = await supabase
          .from('hazard_templates')
          .select('hazard_ids')
          .in('id', template.hazard_template_ids)

        const allHazardIds = hazardTemplatesData?.flatMap((ht) => ht.hazard_ids || []) || []
        
        // Convert hazard IDs to risk factor codes
        // Note: hazard_ids in templates are risk_factor IDs, need to match with riskFactors
        const hazardCodes = riskFactors
          .filter((rf) => allHazardIds.includes(rf.id))
          .map((rf) => rf.code)

        setSelectedRiskFactors(hazardCodes)
      } else if (template.hazard_ids && template.hazard_ids.length > 0) {
        // Direct hazard IDs (for backward compatibility)
        const hazardCodes = riskFactors
          .filter((rf) => template.hazard_ids.includes(rf.id))
          .map((rf) => rf.code)
        setSelectedRiskFactors(hazardCodes)
      }
    } catch (err) {
      console.error('Failed to apply template:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Determine template ID and type if a template was used
      let appliedTemplateId: string | undefined
      let appliedTemplateType: 'hazard' | 'job' | undefined
      
      if (selectedTemplate) {
        // Check if it's a job template
        const jobTemplate = jobTemplates.find((t) => t.id === selectedTemplate)
        if (jobTemplate) {
          appliedTemplateId = selectedTemplate
          appliedTemplateType = 'job'
        } else {
          // It's a hazard template (applied via job template's hazard_template_ids)
          // For now, we'll track the job template that was used
          appliedTemplateId = selectedTemplate
          appliedTemplateType = 'job'
        }
      }

      const response = await jobsApi.create({
        ...formData,
        risk_factor_codes: selectedRiskFactors,
        start_date: formData.start_date || undefined,
        applied_template_id: appliedTemplateId,
        applied_template_type: appliedTemplateType,
      })

      // Track template usage if a template was applied
      if (selectedTemplate) {
        const { trackTemplateApplied } = await import('@/lib/posthog')
        const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('tier')
            .eq('organization_id', (await supabase.from('users').select('organization_id').eq('id', user.id).single()).data?.organization_id)
            .eq('status', 'active')
            .single()
          trackTemplateApplied(subData?.tier || 'starter', 'job', 'new-job')
        }
      }

      // Redirect to job detail page
      router.push(`/dashboard/jobs/${response.data.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create job')
      setLoading(false)
    }
  }

  const toggleRiskFactor = (code: string) => {
    setSelectedRiskFactors((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code]
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500/50 bg-red-500/10'
      case 'high':
        return 'border-orange-500/50 bg-orange-500/10'
      case 'medium':
        return 'border-yellow-500/50 bg-yellow-500/10'
      default:
        return 'border-blue-500/50 bg-blue-500/10'
    }
  }

  const groupedFactors = riskFactors.reduce((acc, factor) => {
    if (!acc[factor.category]) {
      acc[factor.category] = []
    }
    acc[factor.category].push(factor)
    return acc
  }, {} as Record<string, RiskFactor[]>)

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        {/* Header */}
        <header className="border-b border-white/5 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RiskMateLogo size="sm" showText={true} />
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-[#A1A1A1] hover:text-white transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-4xl font-bold mb-2 font-display">Create New Job</h1>
            <p className="text-[#A1A1A1] mb-8">
              Enter job details and select risk factors to get an instant risk score
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Template Selector */}
              {jobTemplates.length > 0 && (
                <div className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <label className="block text-sm font-medium mb-2">
                    Start from Template (Optional)
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                  >
                    <option value="">Create from scratch</option>
                    {jobTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/50 mt-2">
                    Select a template to pre-fill job details and hazards
                  </p>
                </div>
              )}

              {/* Basic Job Info */}
              <div className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8">
                <h2 className="text-2xl font-semibold mb-6">Job Information</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.client_name}
                      onChange={(e) =>
                        setFormData({ ...formData, client_name: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="Downtown Office Complex"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="123 Main St, Suite 400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client Type *
                    </label>
                    <select
                      required
                      value={formData.client_type}
                      onChange={(e) =>
                        setFormData({ ...formData, client_type: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="government">Government</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Job Type *
                    </label>
                    <select
                      required
                      value={formData.job_type}
                      onChange={(e) =>
                        setFormData({ ...formData, job_type: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    >
                      <option value="repair">Repair</option>
                      <option value="installation">Installation</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="inspection">Inspection</option>
                      <option value="remodel">Remodel</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Insurance Status
                    </label>
                    <select
                      value={formData.insurance_status}
                      onChange={(e) =>
                        setFormData({ ...formData, insurance_status: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    >
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="missing">Missing</option>
                      <option value="not_required">Not Required</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="Additional details about the job..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.has_subcontractors}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            has_subcontractors: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-white/20 bg-black/40 text-[#F97316] focus:ring-[#F97316]"
                      />
                      <span className="text-sm">This job involves subcontractors</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Risk Factors - Safety Checklist */}
              <div className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8">
                <h2 className="text-2xl font-semibold mb-4">Hazard Checklist</h2>
                <p className="text-sm text-[#A1A1A1] mb-6">
                  Complete your safety assessment by selecting all hazards that apply to this job. Risk score and required controls will be generated automatically. This creates your audit-ready compliance trail.
                </p>

                {Object.entries(groupedFactors).map(([category, factors]) => (
                  <div key={category} className="mb-6">
                    <h3 className="text-sm font-semibold text-[#A1A1A1] uppercase mb-3">
                      {category}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {factors.map((factor) => {
                        const isSelected = selectedRiskFactors.includes(factor.code)
                        return (
                          <label
                            key={factor.id}
                            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? getSeverityColor(factor.severity)
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRiskFactor(factor.code)}
                              className="mt-1 w-5 h-5 rounded border-white/20 bg-black/40 text-[#F97316] focus:ring-[#F97316]"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{factor.name}</div>
                              <div className="text-xs text-[#A1A1A1] mt-1">
                                {factor.description}
                              </div>
                              <div className="text-xs mt-2">
                                <span
                                  className={`px-2 py-0.5 rounded ${
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
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {selectedRiskFactors.length > 0 && (
                  <div className="mt-6 p-4 bg-[#F97316]/10 border border-[#F97316]/20 rounded-lg">
                    <p className="text-sm text-[#F97316]">
                      {selectedRiskFactors.length} risk factor{selectedRiskFactors.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-[#F97316] hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-black font-semibold transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Job & Calculate Risk'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

