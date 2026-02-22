"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const notifications_1 = require("../services/notifications");
const limits_1 = require("../middleware/limits");
const supabaseClient_1 = require("../lib/supabaseClient");
const emailQueue_1 = require("../workers/emailQueue");
exports.notificationsRouter = express_1.default.Router();
exports.notificationsRouter.post("/register", auth_1.authenticate, (0, limits_1.requireFeature)("notifications"), async (req, res) => {
    const authReq = req;
    try {
        const { token, platform } = authReq.body || {};
        if (!token || typeof token !== "string") {
            return res
                .status(400)
                .json({
                message: "Missing push token. Provide Expo (ExponentPushToken[...]) or APNs (64-char hex) token.",
                code: "INVALID_TOKEN",
            });
        }
        const { valid } = (0, notifications_1.validatePushToken)(token);
        if (!valid) {
            return res
                .status(400)
                .json({
                message: "Invalid token format. Must be Expo (ExponentPushToken[...]) or APNs (64-char hex).",
                code: "INVALID_TOKEN",
            });
        }
        const ok = await (0, notifications_1.registerDeviceToken)({
            userId: authReq.user.id,
            organizationId: authReq.user.organization_id,
            token,
            platform,
        });
        if (!ok) {
            return res
                .status(500)
                .json({ message: "Failed to register device token", code: "REGISTRATION_FAILED" });
        }
        res.json({ status: "ok" });
    }
    catch (err) {
        console.error("Device token registration failed:", err);
        res.status(500).json({ message: "Failed to register device token" });
    }
});
exports.notificationsRouter.delete("/register", auth_1.authenticate, (0, limits_1.requireFeature)("notifications"), async (req, res) => {
    const authReq = req;
    try {
        const { token } = authReq.body || {};
        if (!token || typeof token !== "string") {
            return res
                .status(400)
                .json({ message: "Missing token", code: "INVALID_TOKEN" });
        }
        const deleted = await (0, notifications_1.unregisterDeviceToken)(token, authReq.user.id, authReq.user.organization_id);
        if (!deleted) {
            return res
                .status(404)
                .json({ message: "Device token not found or you do not have access to remove it", code: "TOKEN_NOT_FOUND" });
        }
        res.json({ status: "ok" });
    }
    catch (err) {
        console.error("Device token unregister failed:", err);
        res.status(500).json({ message: "Failed to unregister device token" });
    }
});
/** GET /api/notifications — list notifications for current user (paginated). Query: limit (default 50), offset (default 0), since (ISO date, e.g. last 30 days). */
exports.notificationsRouter.get("/", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50;
        const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : 0;
        const since = typeof req.query.since === "string" && req.query.since ? req.query.since : undefined;
        const result = await (0, notifications_1.listNotifications)(authReq.user.id, authReq.user.organization_id, { limit, offset, since });
        res.json(result);
    }
    catch (err) {
        console.error("List notifications failed:", err);
        res.status(500).json({ message: "Failed to list notifications" });
    }
});
/** GET /api/notifications/unread-count — unread count for badge (e.g. after fetching notifications). */
exports.notificationsRouter.get("/unread-count", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const count = await (0, notifications_1.getUnreadNotificationCount)(authReq.user.id, authReq.user.organization_id);
        res.json({ count });
    }
    catch (err) {
        console.error("Get unread count failed:", err);
        res.status(500).json({ message: "Failed to get unread count" });
    }
});
/** PATCH /api/notifications/read — set read state (default true). Body: { ids?: string[], read?: boolean }. */
exports.notificationsRouter.patch("/read", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const body = (req.body || {});
        const ids = Array.isArray(body.ids) ? body.ids : undefined;
        const read = typeof body.read === "boolean" ? body.read : true;
        await (0, notifications_1.setNotificationsReadState)(authReq.user.id, authReq.user.organization_id, read, ids);
        res.json({ status: "ok" });
    }
    catch (err) {
        console.error("Set notifications read state failed:", err);
        res.status(500).json({ message: "Failed to update read state" });
    }
});
/** GET /api/notifications/preferences — get current user's notification preferences (defaults if no row). */
exports.notificationsRouter.get("/preferences", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const prefs = await (0, notifications_1.getNotificationPreferences)(authReq.user.id);
        res.json(prefs);
    }
    catch (err) {
        console.error("Get notification preferences failed:", err);
        res.status(500).json({ message: "Failed to load preferences" });
    }
});
/** PATCH /api/notifications/preferences — update current user's notification preferences. */
exports.notificationsRouter.patch("/preferences", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const body = (req.body || {});
        const allowedKeys = Object.keys(notifications_1.DEFAULT_NOTIFICATION_PREFERENCES);
        const updates = {};
        for (const key of allowedKeys) {
            if (typeof body[key] === "boolean")
                updates[key] = body[key];
        }
        if (Object.keys(updates).length === 0) {
            const prefs = await (0, notifications_1.getNotificationPreferences)(authReq.user.id);
            return res.json(prefs);
        }
        const { error } = await supabaseClient_1.supabase
            .from("notification_preferences")
            .upsert({
            user_id: authReq.user.id,
            ...updates,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (error)
            throw error;
        const prefs = await (0, notifications_1.getNotificationPreferences)(authReq.user.id);
        res.json(prefs);
    }
    catch (err) {
        console.error("Update notification preferences failed:", err);
        res.status(500).json({ message: "Failed to update preferences" });
    }
});
/** POST /api/notifications/job-assigned — notify a user that they were assigned to a job. Body: { userId, jobId, jobTitle? }. Caller must be authenticated; org is taken from auth. */
exports.notificationsRouter.post("/job-assigned", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { userId, jobId, jobTitle } = req.body || {};
        if (!userId || !jobId) {
            return res
                .status(400)
                .json({ message: "Missing userId or jobId" });
        }
        const organizationId = authReq.user.organization_id;
        const { data: job } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, organization_id")
            .eq("id", jobId)
            .eq("organization_id", organizationId)
            .single();
        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }
        const { data: user } = await supabaseClient_1.supabase
            .from("users")
            .select("id, organization_id")
            .eq("id", userId)
            .single();
        if (!user || user.organization_id !== organizationId) {
            return res.status(403).json({ message: "User not in this organization" });
        }
        await (0, notifications_1.sendJobAssignedNotification)(userId, organizationId, jobId, jobTitle);
        res.status(204).end();
    }
    catch (err) {
        console.error("Job assigned notification failed:", err);
        res.status(500).json({ message: "Failed to send notification" });
    }
});
/** POST /api/notifications/task-assigned — notify assignee (push + email). Body: { userId, taskId, taskTitle, jobId, jobTitle? }. */
exports.notificationsRouter.post("/task-assigned", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { userId, taskId, taskTitle, jobId, jobTitle } = req.body || {};
        if (!userId || !taskId || !taskTitle || !jobId) {
            return res
                .status(400)
                .json({ message: "Missing userId, taskId, taskTitle, or jobId" });
        }
        const organizationId = authReq.user.organization_id;
        const { data: task } = await supabaseClient_1.supabase
            .from("tasks")
            .select("id, organization_id")
            .eq("id", taskId)
            .eq("organization_id", organizationId)
            .single();
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        const { data: user } = await supabaseClient_1.supabase
            .from("users")
            .select("id, organization_id, email")
            .eq("id", userId)
            .single();
        if (!user || user.organization_id !== organizationId) {
            return res.status(403).json({ message: "User not in this organization" });
        }
        await (0, notifications_1.sendTaskAssignedNotification)(userId, organizationId, taskId, jobTitle || "Job", taskTitle);
        const toEmail = user.email;
        if (toEmail) {
            (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.task_assigned, toEmail, { taskId, taskTitle, jobTitle: jobTitle || "Job", jobId }, userId);
        }
        res.status(204).end();
    }
    catch (err) {
        console.error("Task assigned notification failed:", err);
        res.status(500).json({ message: "Failed to send notification" });
    }
});
/** POST /api/notifications/task-completed — notify task creator (push + email). Body: { userId, taskId, taskTitle, jobTitle? }. */
exports.notificationsRouter.post("/task-completed", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { userId, taskId, taskTitle, jobTitle } = req.body || {};
        if (!userId || !taskId || !taskTitle) {
            return res
                .status(400)
                .json({ message: "Missing userId, taskId, or taskTitle" });
        }
        const organizationId = authReq.user.organization_id;
        const { data: task } = await supabaseClient_1.supabase
            .from("tasks")
            .select("id, organization_id, job_id")
            .eq("id", taskId)
            .eq("organization_id", organizationId)
            .single();
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        const jobId = task.job_id;
        const { data: user } = await supabaseClient_1.supabase
            .from("users")
            .select("id, organization_id, email")
            .eq("id", userId)
            .single();
        if (!user || user.organization_id !== organizationId) {
            return res.status(403).json({ message: "User not in this organization" });
        }
        await (0, notifications_1.sendTaskCompletedNotification)(userId, organizationId, taskId, taskTitle, jobTitle || "Job", jobId);
        const toEmail = user.email;
        if (toEmail) {
            (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.task_completed, toEmail, { taskId, taskTitle, jobTitle: jobTitle || "Job", jobId: jobId ?? "" }, userId);
        }
        res.status(204).end();
    }
    catch (err) {
        console.error("Task completed notification failed:", err);
        res.status(500).json({ message: "Failed to send notification" });
    }
});
/** POST /api/notifications/evidence-uploaded — notify recipients (job owner/assignees) that evidence was uploaded. Accepts optional userId; when provided, sends to that user; otherwise sends to job owner. Enforces org/job scoping. */
exports.notificationsRouter.post("/evidence-uploaded", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { jobId, photoId, userId: bodyUserId } = req.body || {};
        if (!jobId || !photoId) {
            return res
                .status(400)
                .json({ message: "Missing jobId or photoId" });
        }
        const organizationId = authReq.user.organization_id;
        // Look up job constrained to caller's organization; if not found, return 403/404
        const { data: job, error: jobError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, organization_id, created_by")
            .eq("id", jobId)
            .eq("organization_id", organizationId)
            .single();
        if (jobError || !job) {
            return res.status(404).json({ message: "Job not found" });
        }
        const targetUserId = bodyUserId ?? job.created_by;
        if (!targetUserId) {
            return res.status(400).json({
                message: "Job has no owner to notify and userId not provided",
                code: "NO_JOB_OWNER",
            });
        }
        // Verify target user is in the same organization
        const { data: targetUser, error: userError } = await supabaseClient_1.supabase
            .from("users")
            .select("id, organization_id")
            .eq("id", targetUserId)
            .single();
        if (userError || !targetUser || targetUser.organization_id !== organizationId) {
            return res.status(403).json({
                message: "Target user is not in this organization",
                code: "TARGET_USER_ORG_MISMATCH",
            });
        }
        // Optionally ensure photoId belongs to this job/org (document or evidence)
        const { data: doc } = await supabaseClient_1.supabase
            .from("documents")
            .select("id")
            .eq("id", photoId)
            .eq("job_id", jobId)
            .eq("organization_id", organizationId)
            .maybeSingle();
        if (doc) {
            // photoId is a document in this job — proceed
        }
        else {
            const { data: ev } = await supabaseClient_1.supabase
                .from("evidence")
                .select("id")
                .eq("id", photoId)
                .eq("work_record_id", jobId)
                .eq("organization_id", organizationId)
                .maybeSingle();
            if (!ev) {
                return res.status(404).json({
                    message: "Photo/evidence not found for this job",
                    code: "PHOTO_NOT_FOUND",
                });
            }
        }
        await (0, notifications_1.sendEvidenceUploadedNotification)(targetUserId, organizationId, jobId, photoId);
        res.status(204).end();
    }
    catch (err) {
        console.error("Evidence uploaded notification failed:", err);
        res.status(500).json({ message: "Failed to send notification" });
    }
});
/** POST /api/notifications/mention — send mention notification (gated on user preferences, push/email). Used by Next.js comment APIs. Body may include organizationId; must match auth. */
exports.notificationsRouter.post("/mention", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { userId, commentId, contextLabel, organizationId: bodyOrgId } = req.body || {};
        if (!userId || !commentId) {
            return res.status(400).json({ message: "Missing userId or commentId" });
        }
        const organizationId = authReq.user.organization_id;
        if (bodyOrgId && bodyOrgId !== organizationId) {
            return res.status(403).json({ message: "organizationId does not match your organization" });
        }
        const { data: comment, error: commentError } = await supabaseClient_1.supabase
            .from("comments")
            .select("id, organization_id")
            .eq("id", commentId)
            .eq("organization_id", organizationId)
            .maybeSingle();
        if (commentError || !comment) {
            return res.status(404).json({ message: "Comment not found" });
        }
        const { data: user } = await supabaseClient_1.supabase
            .from("users")
            .select("id, organization_id")
            .eq("id", userId)
            .single();
        if (!user || user.organization_id !== organizationId) {
            return res.status(403).json({ message: "User not in this organization" });
        }
        await (0, notifications_1.sendMentionNotification)(userId, organizationId, commentId, contextLabel);
        res.status(204).end();
    }
    catch (err) {
        console.error("Mention notification failed:", err);
        res.status(500).json({ message: "Failed to send notification" });
    }
});
/** POST /api/notifications/comment-reply — send reply notification to parent comment author (gated on preferences, push/email). Body may include organizationId; must match auth. */
exports.notificationsRouter.post("/comment-reply", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { userId, commentId, contextLabel, organizationId: bodyOrgId } = req.body || {};
        if (!userId || !commentId) {
            return res.status(400).json({ message: "Missing userId or commentId" });
        }
        const organizationId = authReq.user.organization_id;
        if (bodyOrgId && bodyOrgId !== organizationId) {
            return res.status(403).json({ message: "organizationId does not match your organization" });
        }
        const { data: comment, error: commentError } = await supabaseClient_1.supabase
            .from("comments")
            .select("id, organization_id")
            .eq("id", commentId)
            .eq("organization_id", organizationId)
            .maybeSingle();
        if (commentError || !comment) {
            return res.status(404).json({ message: "Comment not found" });
        }
        const { data: user } = await supabaseClient_1.supabase
            .from("users")
            .select("id, organization_id")
            .eq("id", userId)
            .single();
        if (!user || user.organization_id !== organizationId) {
            return res.status(403).json({ message: "User not in this organization" });
        }
        await (0, notifications_1.sendCommentReplyNotification)(userId, organizationId, commentId, contextLabel);
        res.status(204).end();
    }
    catch (err) {
        console.error("Comment reply notification failed:", err);
        res.status(500).json({ message: "Failed to send notification" });
    }
});
/** POST /api/notifications/job-comment — notify job owner about a new comment on their job (gated on preferences). Used by Next.js job comments API. Body may include organizationId; must match auth. */
exports.notificationsRouter.post("/job-comment", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { jobId, commentId, authorId, organizationId: bodyOrgId } = req.body || {};
        if (!jobId || !commentId) {
            return res.status(400).json({ message: "Missing jobId or commentId" });
        }
        const organizationId = authReq.user.organization_id;
        if (bodyOrgId && bodyOrgId !== organizationId) {
            return res.status(403).json({ message: "organizationId does not match your organization" });
        }
        const { data: job } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, organization_id, assigned_to_id")
            .eq("id", jobId)
            .eq("organization_id", organizationId)
            .single();
        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }
        const ownerId = job.assigned_to_id;
        if (!ownerId || ownerId === authorId) {
            return res.status(204).end();
        }
        const { data: user } = await supabaseClient_1.supabase
            .from("users")
            .select("id, organization_id")
            .eq("id", ownerId)
            .single();
        if (!user || user.organization_id !== organizationId) {
            return res.status(204).end();
        }
        await (0, notifications_1.sendJobCommentNotification)(ownerId, organizationId, commentId, jobId, "Someone commented on a job you own.");
        res.status(204).end();
    }
    catch (err) {
        console.error("Job comment notification failed:", err);
        res.status(500).json({ message: "Failed to send notification" });
    }
});
/** POST /api/notifications/comment-resolved — notify comment author that their comment was resolved (gated on preferences). Used by Next.js resolve API. Body may include organizationId; must match auth. */
exports.notificationsRouter.post("/comment-resolved", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { commentId, resolverId, organizationId: bodyOrgId } = req.body || {};
        if (!commentId) {
            return res.status(400).json({ message: "Missing commentId" });
        }
        const organizationId = authReq.user.organization_id;
        if (bodyOrgId && bodyOrgId !== organizationId) {
            return res.status(403).json({ message: "organizationId does not match your organization" });
        }
        const { data: comment } = await supabaseClient_1.supabase
            .from("comments")
            .select("id, author_id, organization_id")
            .eq("id", commentId)
            .eq("organization_id", organizationId)
            .single();
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }
        const authorId = comment.author_id;
        if (!authorId || authorId === resolverId) {
            return res.status(204).end();
        }
        await (0, notifications_1.sendCommentResolvedNotification)(authorId, organizationId, commentId, "Your comment was marked resolved.");
        res.status(204).end();
    }
    catch (err) {
        console.error("Comment resolved notification failed:", err);
        res.status(500).json({ message: "Failed to send notification" });
    }
});
//# sourceMappingURL=notifications.js.map