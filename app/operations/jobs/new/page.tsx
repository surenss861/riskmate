'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { jobsApi } from '@/lib/api'
import { useRiskFactors, useTemplates } from '@/lib/cache'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ProtectedRoute from '@/components/ProtectedRoute'
import RiskMateLogo from '@/components/RiskMateLogo'
import { spacing, typography } from '@/lib/styles/design-system'
import { AppBackground, AppShell, PageSection, GlassCard, Button, Input, Select, PageHeader } from '@/components/shared'

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
  const [selectedRiskFactors, setSelectedRiskFactors] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  
  // Use cached hooks
  const { data: riskFactors = [], isLoading: loadingRiskFactors } = useRiskFactors()
  const { data: jobTemplates = [], isLoading: loadingJobTemplates } = useTemplates(organizationId, 'job')
  const { data: hazardTemplates = [], isLoading: loadingHazardTemplates } = useTemplates(organizationId, 'hazard')
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
    // Load organization ID for template fetching
    const loadOrgId = async () => {
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
    }
    loadOrgId()
  }, [])

  useEffect(() => {
    if (selectedTemplate) {
      applyTemplate(selectedTemplate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate])

  // Templates and risk factors are now loaded via cached hooks

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
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('organization_id')
              .eq('id', user.id)
              .single()
            
            if (userData?.organization_id) {
              const { data: subData } = await supabase
                .from('subscriptions')
                .select('tier')
                .eq('organization_id', userData.organization_id)
                .eq('status', 'active')
                .single()
              trackTemplateApplied(subData?.tier || 'starter', 'job', 'new-job')
            }
          } catch (err) {
            // Silently fail - tracking is not critical
            console.error('Failed to track template usage:', err)
          }
        }
      }

      // Show success message with Ledger link
      // Redirect to job detail page
      router.push(`/operations/jobs/${response.data.id}?created=true`)
    } catch (err: any) {
      setError('We couldn\'t create that job. Your information is still here — check the form and try again. If this continues, refresh the page.')
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
      <AppBackground>
        <AppShell>
          <PageSection>
            <div className="flex items-start justify-between mb-6">
              <PageHeader
                title="Create New Job"
                subtitle="Enter job details and select risk factors to get an instant risk score"
              />
              <div className="text-right">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={async () => {
                    // Quick create with default template and redirect to packet view
                    if (!formData.client_name || !formData.job_type) {
                      setError('Please fill in at least Client Name and Job Type')
                      return
                    }
                    setLoading(true)
                    try {
                      // Use first available template if none selected
                      const templateToUse = selectedTemplate || (jobTemplates.length > 0 ? jobTemplates[0].id : undefined)
                      
                      const response = await jobsApi.create({
                        ...formData,
                        risk_factor_codes: selectedRiskFactors,
                        start_date: formData.start_date || undefined,
                        applied_template_id: templateToUse,
                        applied_template_type: templateToUse ? 'job' : undefined,
                      })

                      // Redirect directly to Job Packet view
                      router.push(`/operations/jobs/${response.data.id}?view=packet`)
                    } catch (err: any) {
                      setError('Failed to create job. Please try the standard form.')
                      setLoading(false)
                    }
                  }}
                  disabled={loading || !formData.client_name || !formData.job_type}
                >
                  Create & Generate Proof Pack →
                </Button>
                <p className="text-xs text-white/50 mt-2">
                  Quick path to insurance-ready packet
                </p>
              </div>
            </div>
          </PageSection>

          {error && (
            <PageSection>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                {error}
              </div>
            </PageSection>
          )}

          <form onSubmit={handleSubmit}>
            {/* Template Selector */}
            {jobTemplates.length > 0 && (
              <PageSection>
                <GlassCard className="p-6">
                  <label className="block text-sm font-medium mb-2">
                    Start from Template (Optional)
                  </label>
                  <Select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                  >
                    <option value="">Create from scratch</option>
                    {jobTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                  <p className={`text-xs text-white/50 ${spacing.tight}`}>
                    Select a template to pre-fill job details and hazards
                  </p>
                </GlassCard>
              </PageSection>
            )}

            {/* Basic Job Info */}
            <PageSection>
              <GlassCard className="p-8">
                <h2 className={`${typography.h2} ${spacing.relaxed}`}>Job Information</h2>
                <div className={`grid md:grid-cols-2 ${spacing.gap.relaxed}`}>
                  <div>
                    <label className={`block text-sm font-medium ${spacing.tight}`}>
                      Client Name *
                    </label>
                    <Input
                      type="text"
                      required
                      value={formData.client_name}
                      onChange={(e) =>
                        setFormData({ ...formData, client_name: e.target.value })
                      }
                      placeholder="Downtown Office Complex"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${spacing.tight}`}>
                      Location *
                    </label>
                    <Input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      placeholder="123 Main St, Suite 400"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${spacing.tight}`}>
                      Client Type *
                    </label>
                    <Select
                      required
                      value={formData.client_type}
                      onChange={(e) =>
                        setFormData({ ...formData, client_type: e.target.value })
                      }
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="government">Government</option>
                    </Select>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${spacing.tight}`}>
                      Job Type *
                    </label>
                    <Select
                      required
                      value={formData.job_type}
                      onChange={(e) =>
                        setFormData({ ...formData, job_type: e.target.value })
                      }
                    >
                      <option value="repair">Repair</option>
                      <option value="installation">Installation</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="inspection">Inspection</option>
                      <option value="remodel">Remodel</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${spacing.tight}`}>
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${spacing.tight}`}>
                      Insurance Status
                    </label>
                    <Select
                      value={formData.insurance_status}
                      onChange={(e) =>
                        setFormData({ ...formData, insurance_status: e.target.value })
                      }
                    >
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="missing">Missing</option>
                      <option value="not_required">Not Required</option>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium ${spacing.tight}`}>
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent resize-none"
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
              </GlassCard>
            </PageSection>

            {/* Risk Factors - Safety Checklist */}
            <PageSection>
              <GlassCard className="p-8">
                <h2 className={`${typography.h2} ${spacing.normal}`}>Hazard Checklist</h2>
                <p className={`text-sm text-[#A1A1A1] ${spacing.relaxed}`}>
                  Complete your safety assessment by selecting all hazards that apply to this job. Risk score and required controls will be generated automatically. This creates your audit-ready compliance trail.
                </p>

                {Object.entries(groupedFactors).map(([category, factors]) => {
                  const categoryFactors = (factors as RiskFactor[]) || []
                  return (
                    <div key={category} className="mb-6">
                    <h3 className="text-sm font-semibold text-[#A1A1A1] uppercase mb-3">
                      {category}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {categoryFactors.map((factor) => {
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
                  )
                })}

                {selectedRiskFactors.length > 0 && (
                  <div className="mt-6 p-4 bg-[#F97316]/10 border border-[#F97316]/20 rounded-lg">
                    <p className="text-sm text-[#F97316]">
                      {selectedRiskFactors.length} risk factor{selectedRiskFactors.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                )}
              </GlassCard>
            </PageSection>

            {/* Submit */}
            <PageSection>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push('/operations')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Creating...' : 'Create Job & Calculate Risk'}
                </Button>
              </div>
            </PageSection>
          </form>
        </AppShell>
      </AppBackground>
    </ProtectedRoute>
  )
}

