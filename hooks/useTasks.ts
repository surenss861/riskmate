'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreateTaskPayload, Task, UpdateTaskPayload } from '@/types/tasks'
import { toast } from '@/lib/utils/toast'

const ALERT_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

function isDueDateInAlertWindow(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false
  const due = new Date(dueDate).getTime()
  const now = Date.now()
  return due <= now + ALERT_WINDOW_MS
}

interface UseTasksOptions {
  jobTitle?: string
}

interface UseTasksResult {
  tasks: Task[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  addTask: (payload: CreateTaskPayload) => Promise<Task | null>
  updateTask: (id: string, patch: UpdateTaskPayload) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  completeTask: (id: string) => Promise<void>
  reorderTasks: (reordered: Task[]) => Promise<void>
  incompleteCount: number
}

function unwrapTaskList(payload: any): Task[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function unwrapTask(payload: any): Task | null {
  if (!payload) return null
  if (payload.data && typeof payload.data === 'object') return payload.data as Task
  if (typeof payload === 'object') return payload as Task
  return null
}

export function useTasks(jobId: string | null, options?: UseTasksOptions): UseTasksResult {
  const { jobTitle = 'Job' } = options ?? {}
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchTasks = useCallback(async () => {
    if (!jobId) {
      setTasks([])
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/jobs/${jobId}/tasks`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks (${response.status})`)
      }
      const json = await response.json()
      setTasks(unwrapTaskList(json).sort((a, b) => a.sort_order - b.sort_order))
    } catch (err: any) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const addTask = useCallback(
    async (payload: CreateTaskPayload): Promise<Task | null> => {
      if (!jobId) return null

      const defaultSortOrder =
        payload.sort_order != null
          ? payload.sort_order
          : (tasks.length === 0 ? 0 : Math.max(...tasks.map((t) => t.sort_order)) + 1)
      const effectiveSortOrder = payload.sort_order ?? defaultSortOrder

      const optimisticTask: Task = {
        id: `temp-${Date.now()}`,
        job_id: jobId,
        organization_id: '',
        title: payload.title,
        description: payload.description ?? null,
        assigned_to: payload.assigned_to ?? null,
        assigned_user: null,
        created_by: '',
        completed_by: null,
        last_reminded_at: null,
        status: payload.status ?? 'todo',
        priority: payload.priority ?? 'medium',
        due_date: payload.due_date ?? null,
        completed_at: null,
        sort_order: effectiveSortOrder,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setTasks((prev) => {
        const idx =
          payload.sort_order != null
            ? Math.min(Math.max(0, payload.sort_order), prev.length)
            : prev.length
        const next = [...prev]
        next.splice(idx, 0, optimisticTask)
        return next
      })

      const requestPayload = { ...payload, sort_order: payload.sort_order ?? defaultSortOrder }

      try {
        const response = await fetch(`/api/jobs/${jobId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        })

        if (!response.ok) {
          throw new Error(`Failed to create task (${response.status})`)
        }

        const json = await response.json()
        const created = unwrapTask(json)
        if (!created) throw new Error('Task create response was empty')

        setTasks((prev) =>
          prev
            .map((task) => (task.id === optimisticTask.id ? created : task))
            .sort((a, b) => a.sort_order - b.sort_order)
        )

        // Notify assignee and schedule reminder when due_date in alert window
        if (payload.assigned_to) {
          fetch('/api/notifications/task-assigned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: payload.assigned_to,
              taskId: created.id,
              taskTitle: created.title,
              jobId,
              jobTitle,
            }),
          }).then((r) => {
            if (!r.ok) {
              toast.error('Task saved but assignee notification failed')
            }
          }).catch(() => toast.error('Task saved but assignee notification failed'))
        }
        if (payload.due_date && isDueDateInAlertWindow(payload.due_date)) {
          fetch('/api/notifications/schedule-task-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: created.id }),
          }).then((r) => {
            if (r.ok) {
              toast.success('Reminders scheduled for this task')
            }
          }).catch(() => {})
        }

        return created
      } catch (err: any) {
        // Remove only the failed optimistic placeholder so previously created tasks (e.g. from batch) are preserved
        setTasks((prev) => prev.filter((t) => t.id !== optimisticTask.id))
        setError(err)
        throw err
      }
    },
    [jobId, tasks]
  )

  const updateTask = useCallback(
    async (id: string, patch: UpdateTaskPayload) => {
      const previous = tasks
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch, updated_at: new Date().toISOString() } : task)))

      try {
        const response = await fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })

        if (!response.ok) {
          throw new Error(`Failed to update task (${response.status})`)
        }

        const json = await response.json()
        const updated = unwrapTask(json)
        if (updated) {
          setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)))
        } else {
          await fetchTasks()
        }

        const previousTask = previous.find((t) => t.id === id)
        if (patch.assigned_to !== undefined && previousTask && patch.assigned_to !== previousTask.assigned_to && patch.assigned_to) {
          fetch('/api/notifications/task-assigned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: patch.assigned_to,
              taskId: id,
              taskTitle: updated?.title ?? previousTask.title,
              jobId: previousTask.job_id,
              jobTitle,
            }),
          }).then((r) => {
            if (!r.ok) {
              toast.error('Task saved but assignee notification failed')
            }
          }).catch(() => toast.error('Task saved but assignee notification failed'))
        }
        if (patch.due_date !== undefined && isDueDateInAlertWindow(patch.due_date)) {
          fetch('/api/notifications/schedule-task-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: id }),
          }).then((r) => {
            if (r.ok) {
              toast.success('Reminders scheduled for this task')
            }
          }).catch(() => {})
        }
      } catch (err: any) {
        setTasks(previous)
        setError(err)
        throw err
      }
    },
    [tasks, fetchTasks, jobTitle]
  )

  const deleteTask = useCallback(
    async (id: string) => {
      const previous = tasks
      setTasks((prev) => prev.filter((task) => task.id !== id))

      try {
        const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
        if (!response.ok) {
          throw new Error(`Failed to delete task (${response.status})`)
        }
      } catch (err: any) {
        setTasks(previous)
        setError(err)
        throw err
      }
    },
    [tasks]
  )

  const completeTask = useCallback(
    async (id: string) => {
      const previous = tasks
      const completedAt = new Date().toISOString()

      setTasks((prev) =>
        prev.map((task) =>
          task.id === id
            ? { ...task, status: 'done', completed_at: completedAt, updated_at: completedAt }
            : task
        )
      )

      try {
        const response = await fetch(`/api/tasks/${id}/complete`, { method: 'POST' })
        if (!response.ok) {
          throw new Error(`Failed to complete task (${response.status})`)
        }
      } catch (err: any) {
        setTasks(previous)
        setError(err)
        throw err
      }
    },
    [tasks]
  )

  const reorderTasks = useCallback(
    async (reordered: Task[]) => {
      const previous = tasks
      setTasks(reordered)

      const changed = reordered.filter((task, newIdx) => {
        const prevIdx = previous.findIndex((t) => t.id === task.id)
        return prevIdx !== newIdx
      })
      // Persist sort_order for all changed tasks (including cancelled) so DB ordering
      // matches the client's normalized list and avoids duplicate sort_order / reversion on refresh.
      if (changed.length === 0) return

      try {
        await Promise.all(
          changed.map((task) => {
            const newOrder = reordered.findIndex((candidate) => candidate.id === task.id)
            return fetch(`/api/tasks/${task.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sort_order: newOrder }),
            }).then((response) => {
              if (!response.ok) {
                throw new Error(`Failed to reorder task (${response.status})`)
              }
            })
          })
        )

        setTasks(reordered.map((task, idx) => ({ ...task, sort_order: idx })))
      } catch (err: any) {
        setTasks(previous)
        setError(err)
        throw err
      }
    },
    [tasks]
  )

  const incompleteCount = useMemo(
    () => tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled').length,
    [tasks]
  )

  return {
    tasks,
    isLoading,
    error,
    refetch: fetchTasks,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    reorderTasks,
    incompleteCount,
  }
}
