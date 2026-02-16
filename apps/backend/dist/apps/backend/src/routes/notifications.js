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
        await (0, notifications_1.registerDeviceToken)({
            userId: authReq.user.id,
            organizationId: authReq.user.organization_id,
            token,
            platform,
        });
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
        await (0, notifications_1.unregisterDeviceToken)(token);
        res.json({ status: "ok" });
    }
    catch (err) {
        console.error("Device token unregister failed:", err);
        res.status(500).json({ message: "Failed to unregister device token" });
    }
});
/** POST /api/notifications/evidence-uploaded — notify a user that evidence was uploaded to a job (e.g. job owner). */
exports.notificationsRouter.post("/evidence-uploaded", auth_1.authenticate, async (req, res) => {
    try {
        const { userId, jobId, photoId } = req.body || {};
        if (!userId || !jobId || !photoId) {
            return res
                .status(400)
                .json({ message: "Missing userId, jobId, or photoId" });
        }
        await (0, notifications_1.sendEvidenceUploadedNotification)(userId, jobId, photoId);
        res.status(204).end();
    }
    catch (err) {
        console.error("Evidence uploaded notification failed:", err);
        res.status(500).json({ message: "Failed to send notification" });
    }
});
//# sourceMappingURL=notifications.js.map