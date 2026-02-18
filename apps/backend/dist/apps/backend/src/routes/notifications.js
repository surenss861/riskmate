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
//# sourceMappingURL=notifications.js.map