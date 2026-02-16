import express, { type Router as ExpressRouter } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import {
  registerDeviceToken,
  unregisterDeviceToken,
  sendEvidenceUploadedNotification,
  validatePushToken,
} from "../services/notifications";
import { requireFeature } from "../middleware/limits";

export const notificationsRouter: ExpressRouter = express.Router();

notificationsRouter.post(
  "/register",
  authenticate as unknown as express.RequestHandler,
  requireFeature("notifications") as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
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

      const { valid } = validatePushToken(token);
      if (!valid) {
        return res
          .status(400)
          .json({
            message:
              "Invalid token format. Must be Expo (ExponentPushToken[...]) or APNs (64-char hex).",
            code: "INVALID_TOKEN",
          });
      }

      await registerDeviceToken({
        userId: authReq.user.id,
        organizationId: authReq.user.organization_id,
        token,
        platform,
      });

      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("Device token registration failed:", err);
      res.status(500).json({ message: "Failed to register device token" });
    }
  }
);

notificationsRouter.delete(
  "/register",
  authenticate as unknown as express.RequestHandler,
  requireFeature("notifications") as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { token } = authReq.body || {};
      if (!token || typeof token !== "string") {
        return res
          .status(400)
          .json({ message: "Missing token", code: "INVALID_TOKEN" });
      }

      await unregisterDeviceToken(token);
      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("Device token unregister failed:", err);
      res.status(500).json({ message: "Failed to unregister device token" });
    }
  }
);

/** POST /api/notifications/evidence-uploaded — notify a user that evidence was uploaded to a job (e.g. job owner). */
notificationsRouter.post(
  "/evidence-uploaded",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    try {
      const { userId, jobId, photoId } = req.body || {};
      if (!userId || !jobId || !photoId) {
        return res
          .status(400)
          .json({ message: "Missing userId, jobId, or photoId" });
      }
      await sendEvidenceUploadedNotification(userId, jobId, photoId);
      res.status(204).end();
    } catch (err: any) {
      console.error("Evidence uploaded notification failed:", err);
      res.status(500).json({ message: "Failed to send notification" });
    }
  }
);

