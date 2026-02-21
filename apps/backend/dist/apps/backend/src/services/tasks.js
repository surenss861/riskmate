"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTasksByJob = listTasksByJob;
exports.getTask = getTask;
exports.createTask = createTask;
exports.updateTask = updateTask;
exports.deleteTask = deleteTask;
exports.completeTask = completeTask;
exports.reopenTask = reopenTask;
exports.listTaskTemplates = listTaskTemplates;
exports.createTaskTemplate = createTaskTemplate;
const supabaseClient_1 = require("../lib/supabaseClient");
const notifications_1 = require("./notifications");
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];
const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"];
/** Map task row (with assignee from Supabase join) to API shape: assigned_user only, assignee stripped. */
function toTaskApiShape(row) {
    const { assignee, ...rest } = row;
    return { ...rest, assigned_user: assignee ?? null };
}
/** Ensure job belongs to organization. Returns true if ok, false otherwise. */
async function jobBelongsToOrg(jobId, organizationId) {
    const { data, error } = await supabaseClient_1.supabase
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
async function taskBelongsToOrg(taskId, organizationId) {
    const { data, error } = await supabaseClient_1.supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .eq("organization_id", organizationId)
        .maybeSingle();
    if (error || !data) {
        return { ok: false, status: 404, code: "NOT_FOUND", message: "Task not found" };
    }
    return { ok: true, task: data };
}
/** Ensure assigned_to user belongs to organization. Throws 400 VALIDATION_ERROR if not. */
async function ensureAssignedToInOrg(assignedTo, organizationId) {
    if (!assignedTo)
        return;
    const { data, error } = await supabaseClient_1.supabase
        .from("users")
        .select("id")
        .eq("id", assignedTo)
        .eq("organization_id", organizationId)
        .maybeSingle();
    if (error || !data) {
        throw Object.assign(new Error("assigned_to must be a user in your organization"), {
            status: 400,
            code: "VALIDATION_ERROR",
        });
    }
}
/** List tasks for a job. */
async function listTasksByJob(organizationId, jobId) {
    const jobCheck = await jobBelongsToOrg(jobId, organizationId);
    if (!jobCheck.ok) {
        throw Object.assign(new Error(jobCheck.message), {
            status: jobCheck.status,
            code: jobCheck.code,
        });
    }
    const { data: tasks, error } = await supabaseClient_1.supabase
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
    return { data: (tasks || []).map((t) => toTaskApiShape(t)) };
}
/** Get a single task by id. */
async function getTask(organizationId, taskId) {
    const { data, error } = await supabaseClient_1.supabase
        .from("tasks")
        .select("*, assignee:assigned_to(id, full_name, email)")
        .eq("id", taskId)
        .eq("organization_id", organizationId)
        .maybeSingle();
    if (error || !data)
        return null;
    return toTaskApiShape(data);
}
/** Create a task on a job. */
async function createTask(organizationId, userId, jobId, input) {
    const jobCheck = await jobBelongsToOrg(jobId, organizationId);
    if (!jobCheck.ok) {
        throw Object.assign(new Error(jobCheck.message), {
            status: jobCheck.status,
            code: jobCheck.code,
        });
    }
    await ensureAssignedToInOrg(input.assigned_to, organizationId);
    if (input.priority !== undefined &&
        !TASK_PRIORITIES.includes(input.priority)) {
        throw Object.assign(new Error("priority must be one of: low, medium, high, urgent"), {
            status: 400,
            code: "VALIDATION_ERROR",
        });
    }
    const priority = input.priority ?? "medium";
    if (input.status !== undefined &&
        !TASK_STATUSES.includes(input.status)) {
        throw Object.assign(new Error("status must be one of: todo, in_progress, done, cancelled"), {
            status: 400,
            code: "VALIDATION_ERROR",
        });
    }
    const status = input.status ?? "todo";
    const { data: task, error } = await supabaseClient_1.supabase
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
        status,
    })
        .select("*, assignee:assigned_to(id, full_name, email)")
        .single();
    if (error || !task) {
        console.error("[Tasks] createTask error:", error);
        throw new Error("Failed to create task");
    }
    const out = toTaskApiShape(task);
    if (input.assigned_to) {
        const { data: job } = await supabaseClient_1.supabase
            .from("jobs")
            .select("client_name")
            .eq("id", jobId)
            .eq("organization_id", organizationId)
            .maybeSingle();
        const jobTitle = job?.client_name ?? "Job";
        (0, notifications_1.sendTaskAssignedNotification)(input.assigned_to, organizationId, out.id, jobTitle, out.title).catch((err) => console.error("[Tasks] sendTaskAssignedNotification failed:", err));
    }
    return out;
}
/** Update a task. actingUserId is required when status may change to/from done (for completed_at/completed_by). */
async function updateTask(organizationId, taskId, input, actingUserId) {
    const taskCheck = await taskBelongsToOrg(taskId, organizationId);
    if (!taskCheck.ok) {
        throw Object.assign(new Error(taskCheck.message), {
            status: taskCheck.status,
            code: taskCheck.code,
        });
    }
    await ensureAssignedToInOrg(input.assigned_to, organizationId);
    if (input.priority !== undefined &&
        !TASK_PRIORITIES.includes(input.priority)) {
        throw Object.assign(new Error("priority must be one of: low, medium, high, urgent"), {
            status: 400,
            code: "VALIDATION_ERROR",
        });
    }
    if (input.status !== undefined &&
        !TASK_STATUSES.includes(input.status)) {
        throw Object.assign(new Error("status must be one of: todo, in_progress, done, cancelled"), {
            status: 400,
            code: "VALIDATION_ERROR",
        });
    }
    const updatePayload = {
        updated_at: new Date().toISOString(),
    };
    if (input.title !== undefined)
        updatePayload.title = input.title;
    if (input.description !== undefined)
        updatePayload.description = input.description;
    if (input.assigned_to !== undefined)
        updatePayload.assigned_to = input.assigned_to;
    if (input.priority !== undefined)
        updatePayload.priority = input.priority;
    if (input.due_date !== undefined)
        updatePayload.due_date = input.due_date;
    if (input.status !== undefined) {
        updatePayload.status = input.status;
        if (input.status === "done") {
            updatePayload.completed_at = new Date().toISOString();
            updatePayload.completed_by = actingUserId;
        }
        else {
            updatePayload.completed_at = null;
            updatePayload.completed_by = null;
        }
    }
    if (input.sort_order !== undefined)
        updatePayload.sort_order = input.sort_order;
    const { data: task, error } = await supabaseClient_1.supabase
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
    return toTaskApiShape(task);
}
/** Delete a task. */
async function deleteTask(organizationId, taskId) {
    const taskCheck = await taskBelongsToOrg(taskId, organizationId);
    if (!taskCheck.ok) {
        throw Object.assign(new Error(taskCheck.message), {
            status: taskCheck.status,
            code: taskCheck.code,
        });
    }
    const { error } = await supabaseClient_1.supabase
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
async function completeTask(organizationId, userId, taskId) {
    const taskCheck = await taskBelongsToOrg(taskId, organizationId);
    if (!taskCheck.ok) {
        throw Object.assign(new Error(taskCheck.message), {
            status: taskCheck.status,
            code: taskCheck.code,
        });
    }
    const nowIso = new Date().toISOString();
    const { data: task, error } = await supabaseClient_1.supabase
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
        const { data: job } = await supabaseClient_1.supabase
            .from("jobs")
            .select("client_name")
            .eq("id", taskCheck.task.job_id)
            .eq("organization_id", organizationId)
            .maybeSingle();
        const jobTitle = job?.client_name ?? "Job";
        (0, notifications_1.sendTaskCompletedNotification)(createdBy, organizationId, taskId, taskCheck.task.title, jobTitle).catch((err) => console.error("[Tasks] sendTaskCompletedNotification failed:", err));
    }
    return toTaskApiShape(task);
}
/** Reopen a task (set status todo, clear completed_at/completed_by). */
async function reopenTask(organizationId, taskId) {
    const taskCheck = await taskBelongsToOrg(taskId, organizationId);
    if (!taskCheck.ok) {
        throw Object.assign(new Error(taskCheck.message), {
            status: taskCheck.status,
            code: taskCheck.code,
        });
    }
    const nowIso = new Date().toISOString();
    const { data: task, error } = await supabaseClient_1.supabase
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
    return toTaskApiShape(task);
}
/** List task templates for org (including defaults). */
async function listTaskTemplates(organizationId) {
    const { data, error } = await supabaseClient_1.supabase
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
async function createTaskTemplate(organizationId, userId, input) {
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
    const { data: template, error } = await supabaseClient_1.supabase
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
//# sourceMappingURL=tasks.js.map