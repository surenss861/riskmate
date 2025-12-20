'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, FileText, AlertTriangle, Upload } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface ResolveModalProps {
  isOpen: boolean
  onClose: () => void
  onResolve: (resolution: {
    reason: string
    comment: string
    requires_followup: boolean
    waived?: boolean
    waiver_reason?: string
  }) => Promise<void>
  targetType?: 'event' | 'job' | 'incident'
  targetId?: string
  targetName?: string
  severity?: 'critical' | 'material' | 'info'
  requiresEvidence?: boolean
  hasEvidence?: boolean
}

export function ResolveModal({
  isOpen,
  onClose,
  onResolve,
  targetType = 'event',
  targetId,
  targetName,
  severity,
  requiresEvidence = false,
  hasEvidence = false,
}: ResolveModalProps) {
  const [formData, setFormData] = useState({
    reason: '',
    comment: '',
    requires_followup: false,
    waived: false,
    waiver_reason: '',
  })
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        reason: '',
        comment: '',
        requires_followup: false,
        waived: false,
        waiver_reason: '',
      })
      setValidationErrors([])
    }
  }, [isOpen])

  const validate = (): boolean => {
    const errors: string[] = []

    // Require comment for material/critical
    if ((severity === 'material' || severity === 'critical') && !formData.comment.trim()) {
      errors.push('Comment is required for material or critical items')
    }

    // Require resolution reason
    if (!formData.reason) {
      errors.push('Resolution reason is required')
    }

    // If missing evidence and not waived, block resolve
    if (requiresEvidence && !hasEvidence && !formData.waived) {
      errors.push('Evidence is required. Attach evidence or mark as waived with a reason.')
    }

    // If waived, require waiver reason
    if (formData.waived && !formData.waiver_reason.trim()) {
      errors.push('Waiver reason is required when marking as waived')
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
      await onResolve({
        reason: formData.reason,
        comment: formData.comment,
        requires_followup: formData.requires_followup,
        waived: formData.waived || undefined,
        waiver_reason: formData.waiver_reason || undefined,
      })
      onClose()
    } catch (err) {
      console.error('Failed to resolve:', err)
      alert('Failed to resolve item. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const resolutionReasons = [
    { value: 'resolved', label: 'Resolved - Issue addressed' },
    { value: 'false_positive', label: 'False Positive - Not an issue' },
    { value: 'duplicate', label: 'Duplicate - Already tracked elsewhere' },
    { value: 'out_of_scope', label: 'Out of Scope - Not applicable' },
    { value: 'deferred', label: 'Deferred - Will address later' },
    { value: 'waived', label: 'Waived - Approved exception' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Resolve Item
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {targetName && (
          <p className="text-sm text-white/70 mb-4">
            Resolving: <span className="font-medium text-white">{targetName}</span>
          </p>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
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

        {/* Evidence Warning */}
        {requiresEvidence && !hasEvidence && !formData.waived && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-300">
                <p className="font-medium mb-1">Evidence Required</p>
                <p>This item requires evidence. Please attach evidence or mark as waived with a reason.</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Resolution Reason */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Resolution Reason <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              required
            >
              <option value="">Select reason...</option>
              {resolutionReasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Comment
              {(severity === 'material' || severity === 'critical') && (
                <span className="text-red-400">*</span>
              )}
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              rows={4}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
              placeholder={
                severity === 'material' || severity === 'critical'
                  ? 'Comment is required for material or critical items...'
                  : 'Add resolution details (optional)...'
              }
              required={severity === 'material' || severity === 'critical'}
            />
          </div>

          {/* Waive Evidence */}
          {requiresEvidence && !hasEvidence && (
            <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.waived}
                  onChange={(e) => setFormData({ ...formData, waived: e.target.checked, waiver_reason: e.target.checked ? formData.waiver_reason : '' })}
                  className="w-4 h-4 text-[#F97316] bg-[#0A0A0A] border-white/20 rounded focus:ring-[#F97316]"
                />
                <span className="text-sm font-medium text-white/90">
                  Mark evidence requirement as waived
                </span>
              </label>
              {formData.waived && (
                <div>
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

          {/* Requires Follow-up */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requires_followup}
              onChange={(e) => setFormData({ ...formData, requires_followup: e.target.checked })}
              className="w-4 h-4 text-[#F97316] bg-[#0A0A0A] border-white/20 rounded focus:ring-[#F97316]"
            />
            <span className="text-sm text-white/90">Requires follow-up</span>
          </label>

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
              className={buttonStyles.primary + ' flex-1'}
              disabled={loading}
            >
              {loading ? 'Resolving...' : 'Resolve'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

