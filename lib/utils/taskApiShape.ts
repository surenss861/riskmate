import type { TaskAssignedUser } from '@/types/tasks'

type AssigneeRow = { id: string; full_name: string | null; email: string | null } | null

export type TaskRowWithAssignee = Record<string, unknown> & {
  assignee?: AssigneeRow
  assigned_to?: string | null
}

/**
 * Maps a task row from Supabase (with optional assignee:assigned_to join) to the
 * API contract: assigned_user set, assignee omitted.
 */
export function mapTaskToApiShape<T extends TaskRowWithAssignee>(row: T): Omit<T, 'assignee'> & { assigned_user: TaskAssignedUser | null } {
  const { assignee, ...rest } = row
  const assigned_user: TaskAssignedUser | null =
    assignee && typeof assignee === 'object' && 'id' in assignee
      ? {
          id: (assignee as TaskAssignedUser).id,
          full_name: (assignee as TaskAssignedUser).full_name ?? null,
          email: (assignee as TaskAssignedUser).email ?? null,
        }
      : null
  return { ...rest, assigned_user } as Omit<T, 'assignee'> & { assigned_user: TaskAssignedUser | null }
}
