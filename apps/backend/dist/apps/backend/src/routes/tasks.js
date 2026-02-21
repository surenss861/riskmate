"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobTasksRouter = exports.tasksRouter = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const tasks_1 = require("../services/tasks");
exports.tasksRouter = express_1.default.Router();
/** Router for job-scoped task routes: GET/POST /api/jobs/:id/tasks. Mount on jobs router. */
exports.jobTasksRouter = express_1.default.Router();
/** GET /api/jobs/:id/tasks — list tasks for a job */
exports.jobTasksRouter.get("/:id/tasks", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const jobId = req.params.id;
    if (!jobId) {
        return res.status(400).json({ message: "Job id is required", code: "MISSING_PARAMS" });
    }
    try {
        const result = await (0, tasks_1.listTasksByJob)(authReq.user.organization_id, jobId);
        res.json({ data: result.data });
    }
    catch (err) {
        const status = err?.status ?? 500;
        const code = err?.code ?? "QUERY_ERROR";
        console.error("List tasks failed:", err);
        res.status(status).json({
            message: err?.message ?? "Failed to list tasks",
            code,
        });
    }
});
/** POST /api/jobs/:id/tasks — create a task on a job */
exports.jobTasksRouter.post("/:id/tasks", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const jobId = req.params.id;
    if (!jobId) {
        return res.status(400).json({ message: "Job id is required", code: "MISSING_PARAMS" });
    }
    const body = req.body ?? {};
    const title = body.title;
    if (!title || typeof title !== "string" || !String(title).trim()) {
        return res.status(400).json({
            message: "title is required",
            code: "VALIDATION_ERROR",
        });
    }
    try {
        const task = await (0, tasks_1.createTask)(authReq.user.organization_id, authReq.user.id, jobId, {
            title: String(title).trim(),
            description: body.description,
            assigned_to: body.assigned_to,
            priority: body.priority,
            due_date: body.due_date,
            sort_order: body.sort_order,
            status: body.status,
        });
        res.status(201).json({ data: task });
    }
    catch (err) {
        const status = err?.status ?? 500;
        const code = err?.code ?? "QUERY_ERROR";
        console.error("Create task failed:", err);
        res.status(status).json({
            message: err?.message ?? "Failed to create task",
            code,
        });
    }
});
/** GET /api/tasks/:id — get a single task */
exports.tasksRouter.get("/:id", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const taskId = req.params.id;
    if (!taskId) {
        return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
        const task = await (0, tasks_1.getTask)(authReq.user.organization_id, taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found", code: "NOT_FOUND" });
        }
        res.json({ data: task });
    }
    catch (err) {
        const status = err?.status ?? 500;
        const code = err?.code ?? "QUERY_ERROR";
        console.error("Get task failed:", err);
        res.status(status).json({
            message: err?.message ?? "Failed to get task",
            code,
        });
    }
});
/** PATCH /api/tasks/:id — update a task */
exports.tasksRouter.patch("/:id", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const taskId = req.params.id;
    if (!taskId) {
        return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
        const body = req.body ?? {};
        const task = await (0, tasks_1.updateTask)(authReq.user.organization_id, taskId, {
            title: body.title,
            description: body.description,
            assigned_to: body.assigned_to,
            priority: body.priority,
            due_date: body.due_date,
            status: body.status,
            sort_order: body.sort_order,
        }, authReq.user.id);
        res.json({ data: task });
    }
    catch (err) {
        const status = err?.status ?? 500;
        const code = err?.code ?? "QUERY_ERROR";
        console.error("Update task failed:", err);
        res.status(status).json({
            message: err?.message ?? "Failed to update task",
            code,
        });
    }
});
/** DELETE /api/tasks/:id — delete a task */
exports.tasksRouter.delete("/:id", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const taskId = req.params.id;
    if (!taskId) {
        return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
        await (0, tasks_1.deleteTask)(authReq.user.organization_id, taskId);
        res.json({ data: { id: taskId } });
    }
    catch (err) {
        const status = err?.status ?? 500;
        const code = err?.code ?? "QUERY_ERROR";
        console.error("Delete task failed:", err);
        res.status(status).json({
            message: err?.message ?? "Failed to delete task",
            code,
        });
    }
});
/** POST /api/tasks/:id/complete — mark task as done */
exports.tasksRouter.post("/:id/complete", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const taskId = req.params.id;
    if (!taskId) {
        return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
        const task = await (0, tasks_1.completeTask)(authReq.user.organization_id, authReq.user.id, taskId);
        res.json({ data: task });
    }
    catch (err) {
        const status = err?.status ?? 500;
        const code = err?.code ?? "QUERY_ERROR";
        console.error("Complete task failed:", err);
        res.status(status).json({
            message: err?.message ?? "Failed to complete task",
            code,
        });
    }
});
/** DELETE /api/tasks/:id/complete — reopen task */
exports.tasksRouter.delete("/:id/complete", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const taskId = req.params.id;
    if (!taskId) {
        return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
        const task = await (0, tasks_1.reopenTask)(authReq.user.organization_id, taskId);
        res.json({ data: task });
    }
    catch (err) {
        const status = err?.status ?? 500;
        const code = err?.code ?? "QUERY_ERROR";
        console.error("Reopen task failed:", err);
        res.status(status).json({
            message: err?.message ?? "Failed to reopen task",
            code,
        });
    }
});
//# sourceMappingURL=tasks.js.map