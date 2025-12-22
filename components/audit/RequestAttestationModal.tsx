'use client'

import { useState, useEffect } from 'react'
import { X, UserCheck, AlertCircle } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { auditApi } from '@/lib/api'

interface RequestAttestationModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (result?: { meta?: { replayed?: boolean; requestId?: string } }) => void
  workRecordId: string
  workRecordName?: string
  readinessItemId?: string
  ruleCode?: string
}

export function RequestAttestationModal({
  isOpen,
  onClose,
  onComplete,
  workRecordId,
  workRecordName,
  readinessItemId,
  ruleCode,
}: RequestAttestationModalProps) {
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [dueDate, setDueDate] = useState<string>('')
  const [message, setMessage] = useState('')
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string; role: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadUsers()
      // Set default due date to 7 days from now
      const defaultDueDate = new Date()
      defaultDueDate.setDate(defaultDueDate.getDate() + 7)
      setDueDate(defaultDueDate.toISOString().split('T')[0])
    }
  }, [isOpen])

  const loadUsers = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', session.user.id)
        .single()

      if (!userData) return

      const { data: orgUsers } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('organization_id', userData.organization_id)
        .order('full_name')

      if (orgUsers) {
        setUsers(orgUsers)
      }
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!selectedUserId || !dueDate || !message.trim()) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const selectedUser = users.find(u => u.id === selectedUserId)
      if (!selectedUser) {
        throw new Error('Selected user not found')
      }

      // If we have readiness_item_id and rule_code, use the new readiness/resolve endpoint
      if (readinessItemId && ruleCode) {
        const { json, meta } = await auditApi.resolveReadiness({
          readiness_item_id: readinessItemId,
          rule_code: ruleCode,
          action_type: 'request_attestation',
          payload: {
            job_id: workRecordId,
            target_user_id: selectedUserId,
            target_role: selectedRole || selectedUser.role,
            due_date: dueDate,
            message: message.trim(),
          },
        })

        onComplete({ meta })
        onClose()
        
        // Reset form
        setSelectedUserId('')
        setSelectedRole('')
        setMessage('')
        return
      }

      // Legacy path: Direct signoff creation (if not using readiness/resolve)
      // This path is kept for backward compatibility but ideally all flows should go through readiness/resolve
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', session.user.id)
        .single()

      if (!userData) {
        throw new Error('User not found')
      }

      const { data: signoffData, error: signoffError } = await supabase
        .from('job_signoffs')
        .insert({
          job_id: workRecordId,
          user_id: selectedUserId,
          signoff_type: 'attestation_request',
          requested_by: session.user.id,
          requested_at: new Date().toISOString(),
          due_date: new Date(dueDate).toISOString(),
          status: 'pending',
          metadata: {
            message: message.trim(),
            requested_role: selectedRole || selectedUser.role,
          },
        })
        .select('id')
        .single()

      if (signoffError) {
        throw new Error(`Failed to create attestation request: ${signoffError.message}`)
      }

      onComplete()
      onClose()
      
      // Reset form
      setSelectedUserId('')
      setSelectedRole('')
      setMessage('')
    } catch (err: any) {
      console.error('Failed to request attestation:', err)
      setError(err.message || 'Failed to request attestation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-[#F97316]" />
            <h2 className="text-xl font-semibold text-white">Request Attestation</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {workRecordName && (
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-sm text-white/60 mb-1">Work Record</p>
              <p className="text-white font-medium">{workRecordName}</p>
            </div>
          )}

          {/* Select User */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Request Attestation From <span className="text-red-400">*</span>
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value)
                const user = users.find(u => u.id === e.target.value)
                if (user) {
                  setSelectedRole(user.role)
                }
              }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#F97316]"
            >
              <option value="">Select a user...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email} ({user.role})
                </option>
              ))}
            </select>
          </div>

          {/* Required Role */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Required Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#F97316]"
            >
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager/Safety Lead</option>
              <option value="member">Member</option>
            </select>
            <p className="text-xs text-white/50 mt-1">
              The role required for this attestation
            </p>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Due Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#F97316]"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Message/Notes <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain what needs to be attested and why..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-[#F97316] resize-none"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400 font-medium">Error</p>
                <p className="text-sm text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white/60 hover:text-white transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedUserId || !dueDate || !message.trim()}
            className={buttonStyles.primary + (loading ? ' opacity-50 cursor-not-allowed' : '')}
          >
            {loading ? 'Requesting...' : 'Request Attestation'}
          </button>
        </div>
      </div>
    </div>
  )
}

