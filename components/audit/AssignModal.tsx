'use client'

import { useState, useEffect } from 'react'
import { X, User, Calendar, AlertTriangle, FileText } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface AssignModalProps {
  isOpen: boolean
  onClose: () => void
  onAssign: (assignment: {
    owner_id: string
    due_date: string
    severity_override?: string
    note?: string
  }) => Promise<void>
  targetType?: 'event' | 'job' | 'incident'
  targetId?: string
  targetName?: string
}

export function AssignModal({ isOpen, onClose, onAssign, targetType = 'event', targetId, targetName }: AssignModalProps) {
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string; role: string }>>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    owner_id: '',
    due_date: '',
    severity_override: '',
    note: '',
  })

  useEffect(() => {
    if (isOpen) {
      loadUsers()
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
    if (!formData.owner_id || !formData.due_date) {
      alert('Owner and due date are required')
      return
    }

    setLoading(true)
    try {
      await onAssign({
        owner_id: formData.owner_id,
        due_date: formData.due_date,
        severity_override: formData.severity_override || undefined,
        note: formData.note || undefined,
      })
      // Reset form
      setFormData({
        owner_id: '',
        due_date: '',
        severity_override: '',
        note: '',
      })
      onClose()
    } catch (err) {
      console.error('Failed to assign:', err)
      alert('Failed to assign. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-[#F97316]" />
            Assign Item
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
            Assigning: <span className="font-medium text-white">{targetName}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Owner Selection */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
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

          {/* Severity Override */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Severity Override (Optional)
            </label>
            <select
              value={formData.severity_override}
              onChange={(e) => setFormData({ ...formData, severity_override: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            >
              <option value="">No override</option>
              <option value="critical">Critical</option>
              <option value="material">Material</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Note (Optional)
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
              placeholder="Add context or instructions..."
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
              className={buttonStyles.primary + ' flex-1'}
              disabled={loading}
            >
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

