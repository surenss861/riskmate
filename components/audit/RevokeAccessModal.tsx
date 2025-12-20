'use client'

import { useState } from 'react'
import { X, Ban, AlertTriangle, User, Shield } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'

interface RevokeAccessModalProps {
  isOpen: boolean
  onClose: () => void
  onRevoke: (revocation: {
    action_type: 'disable_user' | 'downgrade_role' | 'revoke_sessions'
    reason: string
    new_role?: string
  }) => Promise<void>
  targetUserId?: string
  targetUserName?: string
  targetUserRole?: string
  currentUserId?: string
}

export function RevokeAccessModal({
  isOpen,
  onClose,
  onRevoke,
  targetUserId,
  targetUserName,
  targetUserRole,
  currentUserId,
}: RevokeAccessModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    action_type: 'downgrade_role' as 'disable_user' | 'downgrade_role' | 'revoke_sessions',
    reason: '',
    new_role: 'member',
    confirmText: '',
  })
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const validate = (): boolean => {
    const errors: string[] = []

    if (!formData.reason.trim()) {
      errors.push('Reason is required')
    }

    if (formData.action_type === 'downgrade_role' && !formData.new_role) {
      errors.push('New role is required when downgrading')
    }

    if (targetUserId === currentUserId) {
      errors.push('You cannot revoke your own access')
    }

    if (formData.confirmText !== 'REVOKE') {
      errors.push('Please type "REVOKE" to confirm')
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
      await onRevoke({
        action_type: formData.action_type,
        reason: formData.reason,
        new_role: formData.action_type === 'downgrade_role' ? formData.new_role : undefined,
      })
      // Reset form
      setFormData({
        action_type: 'downgrade_role',
        reason: '',
        new_role: 'member',
        confirmText: '',
      })
      onClose()
    } catch (err) {
      console.error('Failed to revoke access:', err)
      alert('Failed to revoke access. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-400" />
            Revoke Access
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {targetUserName && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-300">
              <span className="font-medium">Target User:</span> {targetUserName}
              {targetUserRole && <span className="text-red-400/70"> ({targetUserRole})</span>}
            </p>
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

        {/* Warning */}
        <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-lg">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-300">
              <p className="font-medium mb-1">Security Action</p>
              <p className="text-xs">This action will be logged in the Compliance Ledger and cannot be undone.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action Type */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Action Type <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.action_type}
              onChange={(e) => setFormData({ ...formData, action_type: e.target.value as any, new_role: e.target.value === 'downgrade_role' ? formData.new_role : 'member' })}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              required
            >
              <option value="downgrade_role">Downgrade Role</option>
              <option value="disable_user">Disable User</option>
              <option value="revoke_sessions">Revoke Sessions Only</option>
            </select>
          </div>

          {/* New Role (if downgrading) */}
          {formData.action_type === 'downgrade_role' && (
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                New Role <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.new_role}
                onChange={(e) => setFormData({ ...formData, new_role: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                required
              >
                <option value="member">Member</option>
                <option value="worker">Worker</option>
              </select>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
              placeholder="Explain why access is being revoked..."
              required
            />
          </div>

          {/* Confirmation */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Type "REVOKE" to confirm <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.confirmText}
              onChange={(e) => setFormData({ ...formData, confirmText: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              placeholder="REVOKE"
              required
            />
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
              className={`${buttonStyles.primary} flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700`}
              disabled={loading || formData.confirmText !== 'REVOKE'}
            >
              {loading ? 'Revoking...' : (
                <>
                  <Ban className="w-4 h-4" />
                  Revoke Access
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

