'use client'

import { FormEvent, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { buttonStyles, inputStyles, modalStyles } from '@/lib/styles/design-system'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { CreateTaskPayload } from '@/types/tasks'

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  onTaskAdded: (payload: CreateTaskPayload) => Promise<void>
  onUseTemplate: () => void
}

interface TeamMember {
  id: string
  full_name: string | null
  email: string | null
}

type TaskFormState = {
  title: string
  description: string
  assigned_to: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string
}

const initialForm = {
  title: '',
  description: '',
  assigned_to: '',
  priority: 'medium' as const,
  due_date: '',
}

export function AddTaskModal({ isOpen, onClose, jobId, onTaskAdded, onUseTemplate }: AddTaskModalProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<TaskFormState>(initialForm)

  useEffect(() => {
    if (!isOpen || !jobId) return

    const loadUsers = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) return

        const { data: orgData } = await supabase.from('organizations').select('id').single()
        if (!orgData) return

        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('organization_id', orgData.id)
          .is('deleted_at', null)
          .order('full_name')

        if (usersData) {
          setMembers(usersData)
        }
      } catch (error) {
        console.error('Failed to load team members:', error)
      }
    }

    loadUsers()
  }, [isOpen, jobId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return

    const payload: CreateTaskPayload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      due_date: form.due_date || null,
      status: 'todo',
    }

    setIsSaving(true)
    try {
      await onTaskAdded(payload)
      setForm(initialForm)
      onClose()
    } catch (error) {
      console.error('Failed to add task:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className={`${modalStyles.backdrop} z-[70] flex items-center justify-center`}>
      <div className={`${modalStyles.container} max-w-md`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Add Task</h3>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/80 mb-2">Title</label>
            <input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className={inputStyles.base}
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label className="block text-sm text-white/80 mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              className={inputStyles.textarea}
              rows={3}
              placeholder="Optional details"
            />
          </div>

          <div>
            <label className="block text-sm text-white/80 mb-2">Assignee</label>
            <select
              value={form.assigned_to}
              onChange={(event) => setForm((prev) => ({ ...prev, assigned_to: event.target.value }))}
              className={inputStyles.select}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name || member.email}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-white/80 mb-2">Priority</label>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    priority: event.target.value as 'low' | 'medium' | 'high' | 'urgent',
                  }))
                }
                className={inputStyles.select}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/80 mb-2">Due date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))}
                className={inputStyles.base}
              />
            </div>
          </div>

          <button type="button" onClick={onUseTemplate} className="text-sm text-[#F97316] cursor-pointer">
            📋 Use a template
          </button>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className={buttonStyles.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className={buttonStyles.primary}>
              {isSaving ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
