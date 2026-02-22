declare const TASK_PRIORITIES: readonly ["low", "medium", "high", "urgent"];
declare const TASK_STATUSES: readonly ["todo", "in_progress", "done", "cancelled"];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export interface TaskRow {
    id: string;
    organization_id: string;
    job_id: string;
    title: string;
    description: string | null;
    assigned_to: string | null;
    created_by: string;
    completed_by: string | null;
    priority: string;
    status: string;
    due_date: string | null;
    completed_at: string | null;
    sort_order: number;
    last_reminded_at: string | null;
    created_at: string;
    updated_at: string;
}
export interface TaskWithAssignee extends TaskRow {
    assignee?: {
        id: string;
        full_name: string | null;
        email: string | null;
    } | null;
}
export interface CreateTaskInput {
    title: string;
    description?: string | null;
    assigned_to?: string | null;
    priority?: TaskPriority | string;
    due_date?: string | null;
    sort_order?: number;
    status?: TaskStatus | string;
}
export interface UpdateTaskInput {
    title?: string;
    description?: string | null;
    assigned_to?: string | null;
    priority?: TaskPriority | string;
    due_date?: string | null;
    status?: TaskStatus | string;
    sort_order?: number;
}
/** List tasks for a job. */
export declare function listTasksByJob(organizationId: string, jobId: string): Promise<{
    data: TaskWithAssignee[];
}>;
/** Get a single task by id. */
export declare function getTask(organizationId: string, taskId: string): Promise<TaskWithAssignee | null>;
/** Create a task on a job. */
export declare function createTask(organizationId: string, userId: string, jobId: string, input: CreateTaskInput): Promise<TaskWithAssignee>;
/** Update a task. actingUserId is required when status may change to/from done (for completed_at/completed_by). */
export declare function updateTask(organizationId: string, taskId: string, input: UpdateTaskInput, actingUserId: string): Promise<TaskWithAssignee>;
/** Delete a task. */
export declare function deleteTask(organizationId: string, taskId: string): Promise<void>;
/** Mark task as done. */
export declare function completeTask(organizationId: string, userId: string, taskId: string): Promise<TaskWithAssignee>;
/** Reopen a task (set status todo, clear completed_at/completed_by). */
export declare function reopenTask(organizationId: string, taskId: string): Promise<TaskWithAssignee>;
/** List task templates for org (including defaults). */
export declare function listTaskTemplates(organizationId: string): Promise<{
    data: any[];
}>;
/** Create a task template. */
export declare function createTaskTemplate(organizationId: string, userId: string, input: {
    name: string;
    tasks: any[];
    job_type?: string | null;
}): Promise<any>;
export {};
//# sourceMappingURL=tasks.d.ts.map