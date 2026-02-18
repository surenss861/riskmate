'use client'

import { format, isPast } from 'date-fns'
import { Check, Pencil, Trash2 } from 'lucide-react'
import type { DragEvent } from 'react'
import { badgeStyles, cardStyles, hoverStates } from '@/lib/styles/design-system'
import { Task } from '@/types/tasks'

interface TaskItemProps {
  task: Task
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
}

const PRIORITY_CLASSES: Record<Task['priority'], string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-white/10 text-white/50 border-white/10',
}

function getInitials(fullName: string | null | undefined, email: string | null | undefined): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/)
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'U'
}

export function TaskItem({ task, onComplete, onDelete, onEdit, onDragStart, onDragOver, onDrop }: TaskItemProps) {
  const dueDate = task.due_date ? new Date(task.due_date) : null
  const isOverdue = Boolean(dueDate && task.status !== 'done' && isPast(dueDate))
  const assigneeName = task.assigned_user?.full_name || task.assigned_user?.email || null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`${cardStyles.base} ${hoverStates.row} group p-3 flex items-start gap-3`}
    >
      <button
        type="button"
        onClick={() => onComplete(task.id)}
        className={`mt-0.5 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          task.status === 'done'
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-white/30 text-transparent hover:border-white/50'
        }`}
        aria-label="Complete task"
      >
        <Check className="h-3.5 w-3.5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-white/40' : 'text-white'}`}>
            {task.title}
          </p>
          <span className={`${badgeStyles.base} ${PRIORITY_CLASSES[task.priority]} capitalize`}>{task.priority}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {assigneeName ? (
            <div className="inline-flex items-center gap-2 text-white/70">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/80">
                {getInitials(task.assigned_user?.full_name, task.assigned_user?.email)}
              </span>
              <span className="truncate max-w-[180px]">{assigneeName}</span>
            </div>
          ) : (
            <span className="text-white/50">Unassigned</span>
          )}

          {dueDate && (
            <span className={isOverdue ? 'text-red-400' : 'text-white/60'}>
              Due {format(dueDate, 'MMM d, yyyy')}
              {isOverdue ? ' • Overdue' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className={`${hoverStates.iconButton} p-2 rounded-md text-white/60 hover:text-white`}
          aria-label="Edit task"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className={`${hoverStates.iconButton} p-2 rounded-md text-white/60 hover:text-red-300`}
          aria-label="Delete task"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
