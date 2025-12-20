'use client'

import { useState, useEffect } from 'react'
import { X, AlertTriangle, User, Calendar, FileText, CheckCircle } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { terms } from '@/lib/terms'

interface CreateCorrectiveActionModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (action: {
    title: string
    owner_id: string
    due_date: string
    verification_method: string
    notes?: string
  }) => Promise<void>
  workRecordId?: string
  workRecordName?: string
  incidentEventId?: string
  severity?: 'critical' | 'material' | 'info'
}

export function CreateCorrectiveActionModal({
  isOpen,
  onClose,
  onCreate,
  workRecordId,
  workRecordName,
  incidentEventId,
  severity,
}: CreateCorrectiveActionModalProps) {
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string; role: string }>>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    owner_id: '',
    due_date: '',
    verification_method: 'visual_inspection',
    notes: '',
  })

  useEffect(() => {
    if (isOpen) {
      loadUsers()
      // Reset form when modal opens
      setFormData({
        title: '',
        owner_id: '',
        due_date: '',
        verification_method: 'visual_inspection',
        notes: '',
      })
    }
  }, [isOpen])

  const loadUsers = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .single()

      if (!orgData) return

      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('organization_id', orgData.id)
        .is('deleted_at', null)
        .order('full_name')

      if (usersData) {
        setUsers(usersData)
      }
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation: owner and due date required for critical/material
    if ((severity === 'critical' || severity === 'material') && (!formData.owner_id || !formData.due_date)) {
      alert('Owner and due date are required for critical or material incidents')
      return
    }

    if (!formData.title || !formData.owner_id || !formData.due_date) {
      alert('Title, owner, and due date are required')
      return
    }

    setLoading(true)
    try {
      await onCreate({
        title: formData.title,
        owner_id: formData.owner_id,
        due_date: formData.due_date,
        verification_method: formData.verification_method,
        notes: formData.notes || undefined,
      })
      onClose()
    } catch (err) {
      console.error('Failed to create corrective action:', err)
      alert('Failed to create corrective action. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const today = new Date().toISOString().split('T')[0]

  const verificationMethods = [
    { value: 'visual_inspection', label: 'Visual Inspection' },
    { value: 'document_review', label: 'Document Review' },
    { value: 'test_verification', label: 'Test/Verification' },
    { value: 'audit_review', label: 'Audit Review' },
    { value: 'sign_off', label: 'Sign-off Required' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Create Corrective Action
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
              <span className="font-medium">Related {terms.workRecord.singular}:</span> {workRecordName}
            </p>
            {workRecordId && (
              <p className="text-xs text-blue-400/70 mt-1">ID: {workRecordId}</p>
            )}
          </div>
        )}

        {(severity === 'critical' || severity === 'material') && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-lg">
            <p className="text-sm text-yellow-300">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Owner and due date are required for {severity} incidents
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Action Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              placeholder="e.g., Install safety guard, Replace damaged equipment"
              required
            />
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Owner <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.owner_id}
              onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              required
            >
              <option value="">Select owner...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email} ({user.role})
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Due Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              min={today}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              required
            />
          </div>

          {/* Verification Method */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Verification Method
            </label>
            <select
              value={formData.verification_method}
              onChange={(e) => setFormData({ ...formData, verification_method: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            >
              {verificationMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
              placeholder="Add additional context or instructions..."
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
              className={buttonStyles.primary + ' flex-1 flex items-center justify-center gap-2'}
              disabled={loading}
            >
              {loading ? 'Creating...' : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Create {terms.control.singular}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

