import express, { type Router as ExpressRouter } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import {
  registerDeviceToken,
  unregisterDeviceToken,
  sendEvidenceUploadedNotification,
  validatePushToken,
  getNotificationPreferences,
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsAsRead,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "../services/notifications";
import { requireFeature } from "../middleware/limits";
import { supabase } from "../lib/supabaseClient";

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

/** GET /api/notifications — list notifications for current user (paginated). Query: limit (default 50), offset (default 0). */
notificationsRouter.get(
  "/",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : 0;
      const result = await listNotifications(authReq.user.id, { limit, offset });
      res.json(result);
    } catch (err: any) {
      console.error("List notifications failed:", err);
      res.status(500).json({ message: "Failed to list notifications" });
    }
  }
);

/** GET /api/notifications/unread-count — unread count for badge (e.g. after fetching notifications). */
notificationsRouter.get(
  "/unread-count",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const count = await getUnreadNotificationCount(authReq.user.id);
      res.json({ count });
    } catch (err: any) {
      console.error("Get unread count failed:", err);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  }
);

/** PATCH /api/notifications/read — mark notifications as read (all for current user, or by id(s)). */
notificationsRouter.patch(
  "/read",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const body = (req.body || {}) as { ids?: string[] };
      const ids = Array.isArray(body.ids) ? body.ids : undefined;
      await markNotificationsAsRead(authReq.user.id, ids);
      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("Mark notifications as read failed:", err);
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  }
);

/** GET /api/notifications/preferences — get current user's notification preferences (defaults if no row). */
notificationsRouter.get(
  "/preferences",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const prefs = await getNotificationPreferences(authReq.user.id);
      res.json(prefs);
    } catch (err: any) {
      console.error("Get notification preferences failed:", err);
      res.status(500).json({ message: "Failed to load preferences" });
    }
  }
);

/** PATCH /api/notifications/preferences — update current user's notification preferences. */
notificationsRouter.patch(
  "/preferences",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const body = (req.body || {}) as Partial<NotificationPreferences>;
      const allowedKeys = Object.keys(
        DEFAULT_NOTIFICATION_PREFERENCES
      ) as (keyof NotificationPreferences)[];
      const updates: Record<string, boolean> = {};
      for (const key of allowedKeys) {
        if (typeof body[key] === "boolean") updates[key] = body[key];
      }
      if (Object.keys(updates).length === 0) {
        const prefs = await getNotificationPreferences(authReq.user.id);
        return res.json(prefs);
      }
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: authReq.user.id,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      const prefs = await getNotificationPreferences(authReq.user.id);
      res.json(prefs);
    } catch (err: any) {
      console.error("Update notification preferences failed:", err);
      res.status(500).json({ message: "Failed to update preferences" });
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

