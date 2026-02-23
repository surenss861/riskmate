"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const notifications_1 = require("../services/notifications");
const base_1 = require("../emails/base");
const limits_1 = require("../middleware/limits");
const supabaseClient_1 = require("../lib/supabaseClient");
const emailQueue_1 = require("../workers/emailQueue");
const taskReminders_1 = require("../workers/taskReminders");
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
/** GET /api/notifications/preferences/email — public: get preferences by signed token (no session). Query: token. */
exports.notificationsRouter.get("/preferences/email", async (req, res) => {
    try {
        const token = typeof req.query.token === "string" ? req.query.token : "";
        const parsed = (0, base_1.verifyPreferencesToken)(token);
        if (!parsed) {
            return res
                .status(401)
                .json({ message: "Invalid or expired link", code: "INVALID_TOKEN" });
        }
        const prefs = await (0, notifications_1.getNotificationPreferences)(parsed.userId);
        res.json(prefs);
    }
    catch (err) {
        console.error("Get email preferences by token failed:", err);
        res.status(500).json({ message: "Failed to load preferences" });
    }
});
/** PATCH /api/notifications/preferences/email — public: update preferences by signed token (no session). Body: token, plus preference keys to update. */
exports.notificationsRouter.patch("/preferences/email", async (req, res) => {
    try {
        const body = (req.body || {});
        const token = typeof body.token === "string"
            ? body.token
            : typeof req.query.token === "string"
                ? req.query.token
                : "";
        const parsed = (0, base_1.verifyPreferencesToken)(token);
        if (!parsed) {
            return res
                .status(401)
                .json({ message: "Invalid or expired link", code: "INVALID_TOKEN" });
        }
        const allowedKeys = Object.keys(notifications_1.DEFAULT_NOTIFICATION_PREFERENCES);
        const existing = await (0, notifications_1.getNotificationPreferences)(parsed.userId);
        const merged = { ...existing };
        for (const key of allowedKeys) {
            if (typeof body[key] === "boolean")
                merged[key] = body[key];
        }
        const { error } = await supabaseClient_1.supabase
            .from("notification_preferences")
            .upsert({
            user_id: parsed.userId,
            ...merged,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (error)
            throw error;
        const prefs = await (0, notifications_1.getNotificationPreferences)(parsed.userId);
        res.json(prefs);
    }
    catch (err) {
        console.error("Update email preferences by token failed:", err);
        res.status(500).json({ message: "Failed to update preferences" });
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
/** PATCH /api/notifications/preferences — update current user's notification preferences. Merges patch with existing (or defaults) so unspecified keys retain current values. */
exports.notificationsRouter.patch("/preferences", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const body = (req.body || {});
        const allowedKeys = Object.keys(notifications_1.DEFAULT_NOTIFICATION_PREFERENCES);
        const existing = await (0, notifications_1.getNotificationPreferences)(authReq.user.id);
        const merged = { ...existing };
        for (const key of allowedKeys) {
            if (typeof body[key] === "boolean")
                merged[key] = body[key];
        }
        const hasChanges = allowedKeys.some((k) => body[k] !== undefined && typeof body[k] === "boolean");
        if (!hasChanges) {
            return res.json(existing);
        }
        const { error } = await supabaseClient_1.supabase
            .from("notification_preferences")
            .upsert({
            user_id: authReq.user.id,
            ...merged,
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
            .select("id, organization_id, email")
            .eq("id", userId)
            .single();
        if (!user || user.organization_id !== organizationId) {
            return res.status(403).json({ message: "User not in this organization" });
        }
        await (0, notifications_1.sendJobAssignedNotification)(userId, organizationId, jobId, jobTitle);
        const assigneeEmail = user.email;
        if (assigneeEmail) {
            await (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.job_assigned, assigneeEmail, {
                job: { id: jobId, title: jobTitle ?? null },
                assignedByName: authReq.user.full_name ?? "A teammate",
            }, userId);
        }
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
            await (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.task_assigned, toEmail, { taskId, taskTitle, jobTitle: jobTitle || "Job", jobId }, userId);
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
            await (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.task_completed, toEmail, { taskId, taskTitle, jobTitle: jobTitle || "Job", jobId: jobId ?? "" }, userId);
        }
        res.status(204).end();
    }
    catch (err) {
        console.error("Task completed notification failed:", err);
        res.status(500).json({ message: "Failed to send notification" });
    }
});
/** POST /api/notifications/schedule-task-reminder — run overdue/due-soon reminder for one task (assignee push + email). Body: { taskId }. */
exports.notificationsRouter.post("/schedule-task-reminder", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { taskId } = req.body || {};
        if (!taskId || typeof taskId !== "string") {
            return res
                .status(400)
                .json({ message: "Missing taskId" });
        }
        const organizationId = authReq.user.organization_id;
        const result = await (0, taskReminders_1.runReminderForTask)(organizationId, taskId);
        if (!result.scheduled && result.message && !result.message.includes("already sent")) {
            return res.status(400).json({ message: result.message });
        }
        res.status(204).end();
    }
    catch (err) {
        console.error("Schedule task reminder failed:", err);
        res.status(500).json({ message: "Failed to schedule task reminder" });
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
            .select("id, organization_id, content, entity_type, entity_id")
            .eq("id", commentId)
            .eq("organization_id", organizationId)
            .maybeSingle();
        if (commentError || !comment) {
            return res.status(404).json({ message: "Comment not found" });
        }
        const { data: user } = await supabaseClient_1.supabase
            .from("users")
            .select("id, organization_id, email")
            .eq("id", userId)
            .single();
        if (!user || user.organization_id !== organizationId) {
            return res.status(403).json({ message: "User not in this organization" });
        }
        await (0, notifications_1.sendMentionNotification)(userId, organizationId, commentId, contextLabel);
        const toEmail = user.email;
        if (toEmail) {
            const commentRow = comment;
            let jobName = "a job";
            if (commentRow.entity_type === "job" && commentRow.entity_id) {
                const { data: job } = await supabaseClient_1.supabase
                    .from("jobs")
                    .select("client_name")
                    .eq("id", commentRow.entity_id)
                    .eq("organization_id", organizationId)
                    .maybeSingle();
                if (job && job.client_name) {
                    jobName = job.client_name;
                }
            }
            const { data: author } = await supabaseClient_1.supabase
                .from("users")
                .select("full_name")
                .eq("id", authReq.user.id)
                .maybeSingle();
            const mentionedByName = author?.full_name ?? "A teammate";
            const commentPreview = typeof commentRow.content === "string"
                ? commentRow.content.replace(/@\[[^\]]*\]\([^)]*\)/g, "").trim().slice(0, 120) || ""
                : "";
            const baseUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
            const commentUrl = commentRow.entity_type === "job" && commentRow.entity_id
                ? `${baseUrl}/jobs/${commentRow.entity_id}#comment-${commentId}`
                : baseUrl;
            await (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.mention, toEmail, { mentionedByName, jobName, commentPreview, commentUrl }, userId);
        }
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