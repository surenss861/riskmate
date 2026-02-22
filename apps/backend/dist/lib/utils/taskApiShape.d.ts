import type { TaskAssignedUser } from '@/types/tasks';
type AssigneeRow = {
    id: string;
    full_name: string | null;
    email: string | null;
} | null;
export type TaskRowWithAssignee = Record<string, unknown> & {
    assignee?: AssigneeRow;
    assigned_to?: string | null;
};
/**
 * Maps a task row from Supabase (with optional assignee:assigned_to join) to the
 * API contract: assigned_user set, assignee omitted.
 */
export declare function mapTaskToApiShape<T extends TaskRowWithAssignee>(row: T): Omit<T, 'assignee'> & {
    assigned_user: TaskAssignedUser | null;
};
export {};
//# sourceMappingURL=taskApiShape.d.ts.map