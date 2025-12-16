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
                .json({ message: "Missing Expo push token", code: "INVALID_TOKEN" });
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
//# sourceMappingURL=notifications.js.map