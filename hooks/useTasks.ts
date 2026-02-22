'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreateTaskPayload, Task, UpdateTaskPayload } from '@/types/tasks'

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

export function useTasks(jobId: string | null): UseTasksResult {
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
        sort_order: payload.sort_order ?? 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const previous = tasks
      setTasks((prev) => [optimisticTask, ...prev])

      try {
        const response = await fetch(`/api/jobs/${jobId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          throw new Error(`Failed to create task (${response.status})`)
        }

        const json = await response.json()
        const created = unwrapTask(json)
        if (!created) throw new Error('Task create response was empty')

        setTasks((prev) => prev.map((task) => (task.id === optimisticTask.id ? created : task)))
        return created
      } catch (err: any) {
        setTasks(previous)
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
      } catch (err: any) {
        setTasks(previous)
        setError(err)
        throw err
      }
    },
    [tasks]
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

      const changed = reordered.filter((task, idx) => task.sort_order !== idx)
      if (changed.length === 0) return

      try {
        await Promise.all(
          changed.map((task, idx) => {
            const newOrder = reordered.findIndex((candidate) => candidate.id === task.id)
            return fetch(`/api/tasks/${task.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sort_order: newOrder }),
            }).then((response) => {
              if (!response.ok) {
                throw new Error(`Failed to reorder task (${response.status})`)
              }
              return idx
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
