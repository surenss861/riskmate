'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckSquare } from 'lucide-react'
import { EditTaskModal } from '@/components/tasks/EditTaskModal'
import { TaskItem } from '@/components/tasks/TaskItem'
import { useTasks } from '@/hooks/useTasks'
import { buttonStyles } from '@/lib/styles/design-system'
import { Task } from '@/types/tasks'

interface TaskListProps {
  jobId: string
  onAddTask: () => void
  onTaskCountChange?: (incompleteCount: number, totalCount?: number) => void
  refreshKey?: number
}

function sortByOrder(list: Task[]) {
  return [...list].sort((a, b) => a.sort_order - b.sort_order)
}

export function TaskList({ jobId, onAddTask, onTaskCountChange, refreshKey = 0 }: TaskListProps) {
  const { tasks, isLoading, error, completeTask, deleteTask, updateTask, reorderTasks, incompleteCount, refetch } = useTasks(jobId)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [orderedTasks, setOrderedTasks] = useState<Task[]>([])
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  useEffect(() => {
    setOrderedTasks(sortByOrder(tasks))
  }, [tasks])

  useEffect(() => {
    const total = orderedTasks.length
    onTaskCountChange?.(incompleteCount, total)
  }, [incompleteCount, orderedTasks.length, onTaskCountChange])

  useEffect(() => {
    void refetch()
  }, [refreshKey, refetch])

  const totalCount = orderedTasks.length
  const completedCount = orderedTasks.filter((task) => task.status === 'done').length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const grouped = useMemo(() => {
    const sorted = sortByOrder(orderedTasks)
    return {
      inProgress: sorted.filter((task) => task.status === 'in_progress'),
      todo: sorted.filter((task) => task.status === 'todo'),
      done: sorted.filter((task) => task.status === 'done'),
    }
  }, [orderedTasks])

  const handleDrop = async (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return

    const next = [...orderedTasks]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropIndex, 0, moved)
    const normalized = next.map((task, index) => ({ ...task, sort_order: index }))

    setOrderedTasks(normalized)
    setDragIndex(null)

    try {
      await reorderTasks(normalized)
    } catch (err) {
      console.error('Failed to reorder tasks:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse bg-white/5 rounded-lg h-14" />
        <div className="animate-pulse bg-white/5 rounded-lg h-14" />
        <div className="animate-pulse bg-white/5 rounded-lg h-14" />
      </div>
    )
  }

  if (error && orderedTasks.length === 0) {
    return <p className="text-sm text-red-400">{error.message}</p>
  }

  if (orderedTasks.length === 0) {
    return (
      <div className="py-16 text-center">
        <CheckSquare className="h-10 w-10 text-white/30 mx-auto" />
        <h3 className="mt-4 text-lg font-semibold text-white">No tasks yet</h3>
        <button type="button" onClick={onAddTask} className={`${buttonStyles.primary} mt-5`}>
          Add your first task
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#A1A1A1]">Task Progress</span>
          <span className="text-sm font-semibold text-white">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden">
          <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {grouped.inProgress.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">In Progress</h4>
          <div className="space-y-2">
            {grouped.inProgress.map((task) => {
              const currentIndex = orderedTasks.findIndex((item) => item.id === task.id)
              return (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={completeTask}
                  onDelete={deleteTask}
                  onEditRequest={setEditingTask}
                  onDragStart={() => setDragIndex(currentIndex)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    void handleDrop(currentIndex)
                  }}
                />
              )
            })}
          </div>
        </section>
      )}

      {grouped.todo.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">To Do</h4>
          <div className="space-y-2">
            {grouped.todo.map((task) => {
              const currentIndex = orderedTasks.findIndex((item) => item.id === task.id)
              return (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={completeTask}
                  onDelete={deleteTask}
                  onEditRequest={setEditingTask}
                  onDragStart={() => setDragIndex(currentIndex)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    void handleDrop(currentIndex)
                  }}
                />
              )
            })}
          </div>
        </section>
      )}

      {grouped.done.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Done</h4>
          <div className="space-y-2">
            {grouped.done.map((task) => {
              const currentIndex = orderedTasks.findIndex((item) => item.id === task.id)
              return (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={completeTask}
                  onDelete={deleteTask}
                  onEditRequest={setEditingTask}
                  onDragStart={() => setDragIndex(currentIndex)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    void handleDrop(currentIndex)
                  }}
                />
              )
            })}
          </div>
        </section>
      )}

      <EditTaskModal
        isOpen={editingTask !== null}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        onSave={async (id, patch) => {
          await updateTask(id, patch)
          setEditingTask(null)
        }}
      />
    </div>
  )
}
