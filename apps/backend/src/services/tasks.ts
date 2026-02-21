import { supabase } from "../lib/supabaseClient";
import { sendTaskAssignedNotification, sendTaskCompletedNotification } from "./notifications";

const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskRow {
  id: string;
  organization_id: string;
  job_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string | null;
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
  assignee?: { id: string; full_name: string | null; email: string | null } | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  priority?: TaskPriority | string;
  due_date?: string | null;
  sort_order?: number;
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

/** Ensure job belongs to organization. Returns true if ok, false otherwise. */
async function jobBelongsToOrg(
  jobId: string,
  organizationId: string
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, organization_id")
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Job not found" };
  }
  return { ok: true };
}

/** Ensure task belongs to organization. Returns task row or error. */
async function taskBelongsToOrg(
  taskId: string,
  organizationId: string
): Promise<
  | { ok: true; task: TaskRow }
  | { ok: false; status: number; code: string; message: string }
> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Task not found" };
  }
  return { ok: true, task: data as TaskRow };
}

/** List tasks for a job. */
export async function listTasksByJob(
  organizationId: string,
  jobId: string
): Promise<{ data: TaskWithAssignee[] }> {
  const jobCheck = await jobBelongsToOrg(jobId, organizationId);
  if (!jobCheck.ok) {
    throw Object.assign(new Error(jobCheck.message), {
      status: jobCheck.status,
      code: jobCheck.code,
    });
  }

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*, assignee:assigned_to(id, full_name, email)")
    .eq("job_id", jobId)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Tasks] listTasksByJob error:", error);
    throw new Error("Failed to list tasks");
  }

  const rows = (tasks || []).map((t: any) => ({
    ...t,
    assigned_user: t.assignee ?? null,
  }));
  return { data: rows };
}

/** Get a single task by id. */
export async function getTask(
  organizationId: string,
  taskId: string
): Promise<TaskWithAssignee | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:assigned_to(id, full_name, email)")
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as any;
  return { ...row, assigned_user: row.assignee ?? null };
}

/** Create a task on a job. */
export async function createTask(
  organizationId: string,
  userId: string,
  jobId: string,
  input: CreateTaskInput
): Promise<TaskWithAssignee> {
  const jobCheck = await jobBelongsToOrg(jobId, organizationId);
  if (!jobCheck.ok) {
    throw Object.assign(new Error(jobCheck.message), {
      status: jobCheck.status,
      code: jobCheck.code,
    });
  }

  const priority =
    input.priority && TASK_PRIORITIES.includes(input.priority as TaskPriority)
      ? input.priority
      : "medium";

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      job_id: jobId,
      created_by: userId,
      title: input.title.trim(),
      description: input.description ?? null,
      assigned_to: input.assigned_to ?? null,
      priority,
      due_date: input.due_date ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select("*, assignee:assigned_to(id, full_name, email)")
    .single();

  if (error || !task) {
    console.error("[Tasks] createTask error:", error);
    throw new Error("Failed to create task");
  }

  const row = task as any;
  const out: TaskWithAssignee = { ...row, assigned_user: row.assignee ?? null };

  if (input.assigned_to) {
    const { data: job } = await supabase
      .from("jobs")
      .select("client_name")
      .eq("id", jobId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const jobTitle = (job as any)?.client_name ?? "Job";
    sendTaskAssignedNotification(
      input.assigned_to,
      organizationId,
      out.id,
      jobTitle,
      out.title
    ).catch((err) => console.error("[Tasks] sendTaskAssignedNotification failed:", err));
  }

  return out;
}

/** Update a task. */
export async function updateTask(
  organizationId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<TaskWithAssignee> {
  const taskCheck = await taskBelongsToOrg(taskId, organizationId);
  if (!taskCheck.ok) {
    throw Object.assign(new Error(taskCheck.message), {
      status: taskCheck.status,
      code: taskCheck.code,
    });
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.description !== undefined) updatePayload.description = input.description;
  if (input.assigned_to !== undefined) updatePayload.assigned_to = input.assigned_to;
  if (input.priority !== undefined) updatePayload.priority = input.priority;
  if (input.due_date !== undefined) updatePayload.due_date = input.due_date;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.sort_order !== undefined) updatePayload.sort_order = input.sort_order;

  const { data: task, error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("*, assignee:assigned_to(id, full_name, email)")
    .single();

  if (error || !task) {
    console.error("[Tasks] updateTask error:", error);
    throw new Error("Failed to update task");
  }
  const row = task as any;
  return { ...row, assigned_user: row.assignee ?? null };
}

/** Delete a task. */
export async function deleteTask(
  organizationId: string,
  taskId: string
): Promise<void> {
  const taskCheck = await taskBelongsToOrg(taskId, organizationId);
  if (!taskCheck.ok) {
    throw Object.assign(new Error(taskCheck.message), {
      status: taskCheck.status,
      code: taskCheck.code,
    });
  }
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("organization_id", organizationId);
  if (error) {
    console.error("[Tasks] deleteTask error:", error);
    throw new Error("Failed to delete task");
  }
}

/** Mark task as done. */
export async function completeTask(
  organizationId: string,
  userId: string,
  taskId: string
): Promise<TaskWithAssignee> {
  const taskCheck = await taskBelongsToOrg(taskId, organizationId);
  if (!taskCheck.ok) {
    throw Object.assign(new Error(taskCheck.message), {
      status: taskCheck.status,
      code: taskCheck.code,
    });
  }
  const nowIso = new Date().toISOString();
  const { data: task, error } = await supabase
    .from("tasks")
    .update({
      status: "done",
      completed_at: nowIso,
      completed_by: userId,
      updated_at: nowIso,
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("*, assignee:assigned_to(id, full_name, email)")
    .single();

  if (error || !task) {
    console.error("[Tasks] completeTask error:", error);
    throw new Error("Failed to complete task");
  }

  const createdBy = taskCheck.task.created_by;
  if (createdBy) {
    const { data: job } = await supabase
      .from("jobs")
      .select("client_name")
      .eq("id", taskCheck.task.job_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const jobTitle = (job as any)?.client_name ?? "Job";
    sendTaskCompletedNotification(
      createdBy,
      organizationId,
      taskId,
      taskCheck.task.title,
      jobTitle
    ).catch((err) => console.error("[Tasks] sendTaskCompletedNotification failed:", err));
  }

  const row = task as any;
  return { ...row, assigned_user: row.assignee ?? null };
}

/** Reopen a task (set status todo, clear completed_at/completed_by). */
export async function reopenTask(
  organizationId: string,
  taskId: string
): Promise<TaskWithAssignee> {
  const taskCheck = await taskBelongsToOrg(taskId, organizationId);
  if (!taskCheck.ok) {
    throw Object.assign(new Error(taskCheck.message), {
      status: taskCheck.status,
      code: taskCheck.code,
    });
  }
  const nowIso = new Date().toISOString();
  const { data: task, error } = await supabase
    .from("tasks")
    .update({
      status: "todo",
      completed_at: null,
      completed_by: null,
      updated_at: nowIso,
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("*, assignee:assigned_to(id, full_name, email)")
    .single();

  if (error || !task) {
    console.error("[Tasks] reopenTask error:", error);
    throw new Error("Failed to reopen task");
  }
  const row = task as any;
  return { ...row, assigned_user: row.assignee ?? null };
}

/** List task templates for org (including defaults). */
export async function listTaskTemplates(
  organizationId: string
): Promise<{ data: any[] }> {
  const { data, error } = await supabase
    .from("task_templates")
    .select("*")
    .or(`organization_id.eq.${organizationId},is_default.eq.true`)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Tasks] listTaskTemplates error:", error);
    throw new Error("Failed to list task templates");
  }
  return { data: data ?? [] };
}

/** Create a task template. */
export async function createTaskTemplate(
  organizationId: string,
  userId: string,
  input: { name: string; tasks: any[]; job_type?: string | null }
): Promise<any> {
  if (!input.name?.trim()) {
    throw Object.assign(new Error("name is required"), {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }
  if (!Array.isArray(input.tasks) || input.tasks.length === 0) {
    throw Object.assign(new Error("tasks must be a non-empty array"), {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  const { data: template, error } = await supabase
    .from("task_templates")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      is_default: false,
      name: input.name.trim(),
      tasks: input.tasks,
      job_type: input.job_type ?? null,
    })
    .select("*")
    .single();

  if (error || !template) {
    console.error("[Tasks] createTaskTemplate error:", error);
    throw new Error("Failed to create task template");
  }
  return template;
}
