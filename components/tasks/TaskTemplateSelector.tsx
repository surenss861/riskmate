'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { badgeStyles, buttonStyles, cardStyles, modalStyles } from '@/lib/styles/design-system'
import { CreateTaskPayload, TaskTemplate } from '@/types/tasks'

interface TaskTemplateSelectorProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  onApply: (tasks: CreateTaskPayload[]) => Promise<void> | void
}

const priorityClass: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-white/10 text-white/50 border-white/10',
}

export function TaskTemplateSelector({ isOpen, onClose, jobId, onApply }: TaskTemplateSelectorProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !jobId) return

    const loadTemplates = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/task-templates', { cache: 'no-store' })
        if (!response.ok) throw new Error(`Failed to load templates (${response.status})`)
        const json = await response.json()
        setTemplates(Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [])
      } catch (error) {
        console.error('Failed to load templates:', error)
        setTemplates([])
      } finally {
        setIsLoading(false)
      }
    }

    loadTemplates()
  }, [isOpen, jobId])

  const applyTemplate = async (template: TaskTemplate) => {
    const tasks: CreateTaskPayload[] = (template.tasks || []).map((task) => ({
      title: task.title || 'Untitled task',
      description: task.description ?? null,
      assigned_to: task.assigned_to ?? null,
      priority: task.priority || 'medium',
      due_date: task.due_date ?? null,
      status: task.status || 'todo',
      sort_order: task.sort_order,
    }))

    await onApply(tasks)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={`${modalStyles.backdrop} z-[70] flex items-center justify-center`}>
      <div className={`${modalStyles.container} max-w-2xl`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Task Templates</h3>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-white/60">Loading templates...</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-white/50">No templates yet</p>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => {
              const isExpanded = expandedId === template.id

              return (
                <div key={template.id} className={`${cardStyles.base} p-4`}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : template.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{template.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-white/60">{template.tasks?.length || 0} tasks</span>
                        {template.job_type && (
                          <span className={`${badgeStyles.base} bg-white/5 text-white/70 border-white/10`}>
                            {template.job_type}
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-white/60" /> : <ChevronDown className="h-4 w-4 text-white/60" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                      {template.tasks?.map((task, index) => {
                        const priority = task.priority || 'medium'
                        return (
                          <div key={`${template.id}-${index}`} className="flex items-center justify-between gap-2">
                            <span className="text-sm text-white/80">{task.title || 'Untitled task'}</span>
                            <span className={`${badgeStyles.base} ${priorityClass[priority] || priorityClass.medium} capitalize`}>
                              {priority}
                            </span>
                          </div>
                        )
                      })}
                      <div className="pt-2">
                        <button type="button" className={buttonStyles.primary} onClick={() => void applyTemplate(template)}>
                          Use Template
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
