import express, { type Router as ExpressRouter } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import {
  listTasksByJob,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  reopenTask,
} from "../services/tasks";

export const tasksRouter: ExpressRouter = express.Router();

/** Router for job-scoped task routes: GET/POST /api/jobs/:id/tasks. Mount on jobs router. */
export const jobTasksRouter: ExpressRouter = express.Router();

/** GET /api/jobs/:id/tasks — list tasks for a job */
jobTasksRouter.get(
  "/:id/tasks",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const jobId = req.params.id;
    if (!jobId) {
      return res.status(400).json({ message: "Job id is required", code: "MISSING_PARAMS" });
    }
    try {
      const result = await listTasksByJob(authReq.user.organization_id, jobId);
      res.json({ data: result.data });
    } catch (err: any) {
      const status = err?.status ?? 500;
      const code = err?.code ?? "QUERY_ERROR";
      console.error("List tasks failed:", err);
      res.status(status).json({
        message: err?.message ?? "Failed to list tasks",
        code,
      });
    }
  }
);

/** POST /api/jobs/:id/tasks — create a task on a job */
jobTasksRouter.post(
  "/:id/tasks",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
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
      const task = await createTask(
        authReq.user.organization_id,
        authReq.user.id,
        jobId,
        {
          title: String(title).trim(),
          description: body.description,
          assigned_to: body.assigned_to,
          priority: body.priority,
          due_date: body.due_date,
          sort_order: body.sort_order,
          status: body.status,
        }
      );
      res.status(201).json({ data: task });
    } catch (err: any) {
      const status = err?.status ?? 500;
      const code = err?.code ?? "QUERY_ERROR";
      console.error("Create task failed:", err);
      res.status(status).json({
        message: err?.message ?? "Failed to create task",
        code,
      });
    }
  }
);

/** GET /api/tasks/:id — get a single task */
tasksRouter.get(
  "/:id",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const taskId = req.params.id;
    if (!taskId) {
      return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
      const task = await getTask(authReq.user.organization_id, taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found", code: "NOT_FOUND" });
      }
      res.json({ data: task });
    } catch (err: any) {
      const status = err?.status ?? 500;
      const code = err?.code ?? "QUERY_ERROR";
      console.error("Get task failed:", err);
      res.status(status).json({
        message: err?.message ?? "Failed to get task",
        code,
      });
    }
  }
);

/** PATCH /api/tasks/:id — update a task */
tasksRouter.patch(
  "/:id",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const taskId = req.params.id;
    if (!taskId) {
      return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
      const body = req.body ?? {};
      const task = await updateTask(
        authReq.user.organization_id,
        taskId,
        {
          title: body.title,
          description: body.description,
          assigned_to: body.assigned_to,
          priority: body.priority,
          due_date: body.due_date,
          status: body.status,
          sort_order: body.sort_order,
        },
        authReq.user.id
      );
      res.json({ data: task });
    } catch (err: any) {
      const status = err?.status ?? 500;
      const code = err?.code ?? "QUERY_ERROR";
      console.error("Update task failed:", err);
      res.status(status).json({
        message: err?.message ?? "Failed to update task",
        code,
      });
    }
  }
);

/** DELETE /api/tasks/:id — delete a task */
tasksRouter.delete(
  "/:id",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const taskId = req.params.id;
    if (!taskId) {
      return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
      await deleteTask(authReq.user.organization_id, taskId);
      res.json({ data: { id: taskId } });
    } catch (err: any) {
      const status = err?.status ?? 500;
      const code = err?.code ?? "QUERY_ERROR";
      console.error("Delete task failed:", err);
      res.status(status).json({
        message: err?.message ?? "Failed to delete task",
        code,
      });
    }
  }
);

/** POST /api/tasks/:id/complete — mark task as done */
tasksRouter.post(
  "/:id/complete",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const taskId = req.params.id;
    if (!taskId) {
      return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
      const task = await completeTask(
        authReq.user.organization_id,
        authReq.user.id,
        taskId
      );
      res.json({ data: task });
    } catch (err: any) {
      const status = err?.status ?? 500;
      const code = err?.code ?? "QUERY_ERROR";
      console.error("Complete task failed:", err);
      res.status(status).json({
        message: err?.message ?? "Failed to complete task",
        code,
      });
    }
  }
);

/** POST /api/tasks/:id/reopen — reopen task (spec'd endpoint) */
tasksRouter.post(
  "/:id/reopen",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const taskId = req.params.id;
    if (!taskId) {
      return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
      const task = await reopenTask(authReq.user.organization_id, taskId);
      res.json({ data: task });
    } catch (err: any) {
      const status = err?.status ?? 500;
      const code = err?.code ?? "QUERY_ERROR";
      console.error("Reopen task failed:", err);
      res.status(status).json({
        message: err?.message ?? "Failed to reopen task",
        code,
      });
    }
  }
);

/** DELETE /api/tasks/:id/complete — reopen task (backward compatibility) */
tasksRouter.delete(
  "/:id/complete",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const taskId = req.params.id;
    if (!taskId) {
      return res.status(400).json({ message: "Task id is required", code: "MISSING_PARAMS" });
    }
    try {
      const task = await reopenTask(authReq.user.organization_id, taskId);
      res.json({ data: task });
    } catch (err: any) {
      const status = err?.status ?? 500;
      const code = err?.code ?? "QUERY_ERROR";
      console.error("Reopen task failed:", err);
      res.status(status).json({
        message: err?.message ?? "Failed to reopen task",
        code,
      });
    }
  }
);
