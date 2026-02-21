import express, { type Router as ExpressRouter } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { listTaskTemplates, createTaskTemplate } from "../services/tasks";

export const taskTemplatesRouter: ExpressRouter = express.Router();

/** GET /api/task-templates — list task templates (org + defaults) */
taskTemplatesRouter.get(
  "/",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const result = await listTaskTemplates(authReq.user.organization_id);
      res.json({ data: result.data });
    } catch (err: any) {
      console.error("List task templates failed:", err);
      res.status(500).json({
        message: err?.message ?? "Failed to list task templates",
        code: "QUERY_ERROR",
      });
    }
  }
);

/** POST /api/task-templates — create a task template */
taskTemplatesRouter.post(
  "/",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const body = req.body ?? {};
    try {
      const template = await createTaskTemplate(
        authReq.user.organization_id,
        authReq.user.id,
        {
          name: body.name,
          tasks: body.tasks,
          job_type: body.job_type,
        }
      );
      res.status(201).json({ data: template });
    } catch (err: any) {
      const status = err?.status ?? 500;
      const code = err?.code ?? "QUERY_ERROR";
      console.error("Create task template failed:", err);
      res.status(status).json({
        message: err?.message ?? "Failed to create task template",
        code,
      });
    }
  }
);
