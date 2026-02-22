'use client'

import { FormEvent, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { buttonStyles, inputStyles, modalStyles } from '@/lib/styles/design-system'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Task, UpdateTaskPayload } from '@/types/tasks'

interface EditTaskModalProps {
  isOpen: boolean
  onClose: () => void
  task: Task | null
  onSave: (id: string, patch: UpdateTaskPayload) => Promise<void>
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
  status: Task['status']
}

export function EditTaskModal({ isOpen, onClose, task, onSave }: EditTaskModalProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<TaskFormState>({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
    status: 'todo',
  })

  useEffect(() => {
    if (!isOpen || !task) return

    setForm({
      title: task.title,
      description: task.description ?? '',
      assigned_to: task.assigned_to ?? '',
      priority: task.priority,
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      status: task.status,
    })

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

        if (usersData) setMembers(usersData)
      } catch (error) {
        console.error('Failed to load team members:', error)
      }
    }

    loadUsers()
  }, [isOpen, task])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!task || !form.title.trim()) return

    const patch: UpdateTaskPayload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      due_date: form.due_date || null,
      status: form.status,
    }
    if (form.status === 'done' && task.status !== 'done') {
      patch.completed_at = new Date().toISOString()
    } else if (form.status !== 'done') {
      patch.completed_at = null
    }

    setIsSaving(true)
    try {
      await onSave(task.id, patch)
      onClose()
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen || !task) return null

  return (
    <div className={`${modalStyles.backdrop} z-[70] flex items-center justify-center`}>
      <div className={`${modalStyles.container} max-w-md`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Edit Task</h3>
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
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className={inputStyles.base}
              placeholder="Task title"
            />
          </div>

          <div>
            <label className="block text-sm text-white/80 mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className={inputStyles.textarea}
              rows={3}
              placeholder="Optional details"
            />
          </div>

          <div>
            <label className="block text-sm text-white/80 mb-2">Assignee</label>
            <select
              value={form.assigned_to}
              onChange={(e) => setForm((prev) => ({ ...prev, assigned_to: e.target.value }))}
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
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent',
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
                onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                className={inputStyles.base}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/80 mb-2">Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as Task['status'],
                }))
              }
              className={inputStyles.select}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className={buttonStyles.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className={buttonStyles.primary}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
