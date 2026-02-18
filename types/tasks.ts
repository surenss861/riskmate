export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TaskAssignedUser {
  id: string
  full_name: string | null
  email: string | null
}

export interface Task {
  id: string
  job_id: string
  organization_id: string
  title: string
  description: string | null
  assigned_to: string | null
  assigned_user: TaskAssignedUser | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  completed_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TaskTemplate {
  id: string
  name: string
  tasks: Array<Partial<Task>>
  job_type: string | null
  organization_id: string
}

export type CreateTaskPayload = {
  title: string
  description?: string | null
  assigned_to?: string | null
  priority?: TaskPriority
  due_date?: string | null
  status?: TaskStatus
  sort_order?: number
}

export type UpdateTaskPayload = Partial<Pick<Task, 'title' | 'description' | 'assigned_to' | 'status' | 'priority' | 'due_date' | 'completed_at' | 'sort_order'>>
