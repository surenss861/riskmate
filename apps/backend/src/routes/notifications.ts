import express from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from "../services/notifications";
import { requireFeature } from "../middleware/limits";

export const notificationsRouter = express.Router();

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
          .json({ message: "Missing Expo push token", code: "INVALID_TOKEN" });
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

