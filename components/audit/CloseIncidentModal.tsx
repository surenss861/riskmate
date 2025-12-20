'use client'

import { useState, useEffect } from 'react'
import { X, AlertTriangle, FileText, CheckCircle, Shield, AlertCircle } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { terms } from '@/lib/terms'

interface CloseIncidentModalProps {
  isOpen: boolean
  onClose: () => void
  onCloseIncident: (closure: {
    closure_summary: string
    root_cause: string
    evidence_attached: boolean
    waived: boolean
    waiver_reason?: string
    no_action_required: boolean
    no_action_justification?: string
  }) => Promise<void>
  workRecordId?: string
  workRecordName?: string
  hasCorrectiveActions?: boolean
  hasEvidence?: boolean
  currentUser?: {
    id: string
    name: string
    role: string
  }
}

export function CloseIncidentModal({
  isOpen,
  onClose,
  onCloseIncident: handleClose,
  workRecordId,
  workRecordName,
  hasCorrectiveActions = false,
  hasEvidence = false,
  currentUser,
}: CloseIncidentModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    closure_summary: '',
    root_cause: '',
    evidence_attached: hasEvidence,
    waived: false,
    waiver_reason: '',
    no_action_required: false,
    no_action_justification: '',
    require_attestation: true, // Always required, not toggleable
  })
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        closure_summary: '',
        root_cause: '',
        evidence_attached: hasEvidence,
        waived: false,
        waiver_reason: '',
        no_action_required: false,
        no_action_justification: '',
        require_attestation: true,
      })
      setValidationErrors([])
    }
  }, [isOpen, hasEvidence])

  const validate = (): boolean => {
    const errors: string[] = []

    if (!formData.closure_summary.trim()) {
      errors.push('Closure summary is required')
    }

    if (!formData.root_cause) {
      errors.push('Root cause is required')
    }

    // Require corrective actions OR "no action required" justification
    if (!hasCorrectiveActions && !formData.no_action_required) {
      errors.push('Either corrective actions must exist, or you must mark "No corrective action required" with justification')
    }

    if (formData.no_action_required && !formData.no_action_justification.trim()) {
      errors.push('Justification is required when marking "No corrective action required"')
    }

    // Evidence validation
    if (!formData.evidence_attached && !formData.waived) {
      errors.push('Evidence is required. Attach evidence or mark as waived with a reason.')
    }

    if (formData.waived && !formData.waiver_reason.trim()) {
      errors.push('Waiver reason is required when marking evidence as waived')
    }

    setValidationErrors(errors)
    return errors.length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setLoading(true)
    try {
      await handleClose({
        closure_summary: formData.closure_summary,
        root_cause: formData.root_cause,
        evidence_attached: formData.evidence_attached,
        waived: formData.waived ? true : undefined,
        waiver_reason: formData.waiver_reason || undefined,
        no_action_required: formData.no_action_required,
        no_action_justification: formData.no_action_justification || undefined,
      })
      onClose()
    } catch (err) {
      console.error('Failed to close incident:', err)
      alert('Failed to close incident. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const rootCauses = [
    { value: 'equipment_failure', label: 'Equipment Failure' },
    { value: 'human_error', label: 'Human Error' },
    { value: 'process_breakdown', label: 'Process Breakdown' },
    { value: 'environmental_factor', label: 'Environmental Factor' },
    { value: 'design_flaw', label: 'Design Flaw' },
    { value: 'training_deficiency', label: 'Training Deficiency' },
    { value: 'communication_failure', label: 'Communication Failure' },
    { value: 'unknown', label: 'Unknown / Under Investigation' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Close Incident
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {workRecordName && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              <span className="font-medium">Closing incident for {terms.workRecord.singular}:</span> {workRecordName}
            </p>
            {workRecordId && (
              <p className="text-xs text-blue-400/70 mt-1">ID: {workRecordId}</p>
            )}
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400 mb-1">Please fix the following:</p>
                <ul className="text-sm text-red-300 space-y-1">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Requirements Warning */}
        <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-300">
              <p className="font-medium mb-1">Closure Requirements:</p>
              <ul className="space-y-1 text-xs">
                <li>• Corrective actions OR &quot;No action required&quot; justification</li>
                <li>• Evidence attached OR waived with reason</li>
                <li>• Attestation will be created automatically</li>
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Closure Summary */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Closure Summary <span className="text-red-400">*</span>
            </label>
            <textarea
              value={formData.closure_summary}
              onChange={(e) => setFormData({ ...formData, closure_summary: e.target.value })}
              rows={4}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
              placeholder="Summarize the incident resolution, actions taken, and final status..."
              required
            />
          </div>

          {/* Root Cause */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Root Cause <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.root_cause}
              onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              required
            >
              <option value="">Select root cause...</option>
              {rootCauses.map((cause) => (
                <option key={cause.value} value={cause.value}>
                  {cause.label}
                </option>
              ))}
            </select>
          </div>

          {/* Corrective Actions Section */}
          <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-white/60" />
              <span className="text-sm font-medium text-white/90">Corrective Actions</span>
            </div>
            {hasCorrectiveActions ? (
              <p className="text-sm text-green-400">✓ Corrective actions exist for this incident</p>
            ) : (
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.no_action_required}
                    onChange={(e) => setFormData({ ...formData, no_action_required: e.target.checked, no_action_justification: e.target.checked ? formData.no_action_justification : '' })}
                    className="w-4 h-4 text-[#F97316] bg-[#0A0A0A] border-white/20 rounded focus:ring-[#F97316]"
                  />
                  <span className="text-sm text-white/90">
                    No corrective action required
                  </span>
                </label>
                {formData.no_action_required && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Justification <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={formData.no_action_justification}
                      onChange={(e) => setFormData({ ...formData, no_action_justification: e.target.value })}
                      rows={2}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
                      placeholder="Explain why no corrective action is required..."
                      required={formData.no_action_required}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Evidence Status */}
          <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-white/60" />
              <span className="text-sm font-medium text-white/90">Evidence Status</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.evidence_attached}
                onChange={(e) => setFormData({ ...formData, evidence_attached: e.target.checked, waived: e.target.checked ? false : formData.waived })}
                className="w-4 h-4 text-[#F97316] bg-[#0A0A0A] border-white/20 rounded focus:ring-[#F97316]"
              />
              <span className="text-sm text-white/90">Evidence attached</span>
            </label>
            {!formData.evidence_attached && (
              <div className="ml-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.waived}
                    onChange={(e) => setFormData({ ...formData, waived: e.target.checked, waiver_reason: e.target.checked ? formData.waiver_reason : '' })}
                    className="w-4 h-4 text-[#F97316] bg-[#0A0A0A] border-white/20 rounded focus:ring-[#F97316]"
                  />
                  <span className="text-sm text-white/90">Mark evidence requirement as waived</span>
                </label>
                {formData.waived && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Waiver Reason <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={formData.waiver_reason}
                      onChange={(e) => setFormData({ ...formData, waiver_reason: e.target.value })}
                      rows={2}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
                      placeholder="Explain why evidence requirement is waived..."
                      required={formData.waived}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Attestation Info */}
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-300">Attestation</span>
            </div>
            <p className="text-sm text-green-400/90">
              An attestation will be automatically created as part of incident closure.
            </p>
            {currentUser && (
              <p className="text-xs text-green-400/70 mt-1">
                Signer: {currentUser.name} ({currentUser.role})
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={buttonStyles.secondary + ' flex-1'}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={buttonStyles.primary + ' flex-1 flex items-center justify-center gap-2'}
              disabled={loading}
            >
              {loading ? 'Closing...' : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Close Incident
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

