'use client'

import { useState } from 'react'
import { X, Flag, AlertTriangle, FileText } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'

interface FlagSuspiciousModalProps {
  isOpen: boolean
  onClose: () => void
  onFlag: (flag: {
    reason: string
    notes?: string
    severity: 'critical' | 'material' | 'info'
    open_incident: boolean
  }) => Promise<void>
  targetUserId?: string
  targetUserName?: string
  loginEventId?: string
}

export function FlagSuspiciousModal({
  isOpen,
  onClose,
  onFlag,
  targetUserId,
  targetUserName,
  loginEventId,
}: FlagSuspiciousModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    reason: '',
    notes: '',
    severity: 'material' as 'critical' | 'material' | 'info',
    open_incident: true,
  })
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const validate = (): boolean => {
    const errors: string[] = []

    if (!formData.reason) {
      errors.push('Suspicion reason is required')
    }

    if (formData.reason === 'other' && !formData.notes.trim()) {
      errors.push('Notes are required when reason is "Other"')
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
      await onFlag({
        reason: formData.reason,
        notes: formData.notes || undefined,
        severity: formData.severity,
        open_incident: formData.open_incident,
      })
      // Reset form
      setFormData({
        reason: '',
        notes: '',
        severity: 'material',
        open_incident: true,
      })
      onClose()
    } catch (err) {
      console.error('Failed to flag suspicious access:', err)
      alert('Failed to flag suspicious access. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const suspicionReasons = [
    { value: 'impossible_travel', label: 'Impossible Travel - Login from distant locations' },
    { value: 'unusual_time', label: 'Unusual Login Time - Outside normal hours' },
    { value: 'repeated_failures', label: 'Repeated Login Failures' },
    { value: 'privilege_anomaly', label: 'Privilege Anomaly - Unusual permission usage' },
    { value: 'suspicious_pattern', label: 'Suspicious Access Pattern' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Flag className="w-5 h-5 text-yellow-400" />
            Flag Suspicious Access
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {targetUserName && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-300">
              <span className="font-medium">Target User:</span> {targetUserName}
            </p>
            {loginEventId && (
              <p className="text-xs text-yellow-400/70 mt-1">Related Login Event ID: {loginEventId}</p>
            )}
          </div>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Suspicion Reason */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Suspicion Reason <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value, notes: e.target.value === 'other' ? formData.notes : '' })}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              required
            >
              <option value="">Select reason...</option>
              {suspicionReasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes (required if "other") */}
          {(formData.reason === 'other' || formData.reason) && (
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Notes
                {formData.reason === 'other' && <span className="text-red-400">*</span>}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
                placeholder={formData.reason === 'other' ? 'Explain the suspicious activity...' : 'Add additional details (optional)...'}
                required={formData.reason === 'other'}
              />
            </div>
          )}

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Severity
            </label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            >
              <option value="info">Info</option>
              <option value="material">Material</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Open Incident */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.open_incident}
              onChange={(e) => setFormData({ ...formData, open_incident: e.target.checked })}
              className="w-4 h-4 text-[#F97316] bg-[#0A0A0A] border-white/20 rounded focus:ring-[#F97316]"
            />
            <span className="text-sm text-white/90">Open security incident (recommended)</span>
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
              className={buttonStyles.primary + ' flex-1 flex items-center justify-center gap-2'}
              disabled={loading}
            >
              {loading ? 'Flagging...' : (
                <>
                  <Flag className="w-4 h-4" />
                  Flag Suspicious
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

