"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskTemplatesRouter = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const tasks_1 = require("../services/tasks");
exports.taskTemplatesRouter = express_1.default.Router();
/** GET /api/task-templates — list task templates (org + defaults) */
exports.taskTemplatesRouter.get("/", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const result = await (0, tasks_1.listTaskTemplates)(authReq.user.organization_id);
        res.json({ data: result.data });
    }
    catch (err) {
        console.error("List task templates failed:", err);
        res.status(500).json({
            message: err?.message ?? "Failed to list task templates",
            code: "QUERY_ERROR",
        });
    }
});
/** POST /api/task-templates — create a task template */
exports.taskTemplatesRouter.post("/", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const body = req.body ?? {};
    try {
        const template = await (0, tasks_1.createTaskTemplate)(authReq.user.organization_id, authReq.user.id, {
            name: body.name,
            tasks: body.tasks,
            job_type: body.job_type,
        });
        res.status(201).json({ data: template });
    }
    catch (err) {
        const status = err?.status ?? 500;
        const code = err?.code ?? "QUERY_ERROR";
        console.error("Create task template failed:", err);
        res.status(status).json({
            message: err?.message ?? "Failed to create task template",
            code,
        });
    }
});
//# sourceMappingURL=taskTemplates.js.map