import express from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { supabase } from "../lib/supabaseClient";
import { LEGAL_VERSION, LEGAL_UPDATED_AT, getClientIp } from "../utils/legal";
import { recordAuditLog } from "../middleware/audit";

export const legalRouter = express.Router();

legalRouter.get("/version", authenticate as unknown as express.RequestHandler, async (_req: express.Request, res: express.Response) => {
  res.json({
    version: LEGAL_VERSION,
    updated_at: LEGAL_UPDATED_AT,
  });
});

legalRouter.get("/status", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  res.json({
    accepted: authReq.user.legalAccepted,
    accepted_at: authReq.user.legalAcceptedAt ?? null,
    version: LEGAL_VERSION,
  });
});

legalRouter.post("/accept", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id: userId, organization_id } = authReq.user;
    const ipAddress = getClientIp(authReq.headers) || authReq.ip;

    const { data, error } = await supabase
      .from("legal_acceptances")
      .upsert(
        {
          user_id: userId,
          organization_id,
          version: LEGAL_VERSION,
          ip_address: ipAddress ?? null,
        },
        { onConflict: "user_id,version" }
      )
      .select("accepted_at")
      .single();

    if (error) {
      throw error;
    }

    recordAuditLog({
      organizationId: organization_id,
      actorId: userId,
      eventName: "legal.accepted",
      targetType: "legal",
      metadata: {
        version: LEGAL_VERSION,
        ip_address: ipAddress ?? null,
      },
    });

    res.json({
      accepted: true,
      version: LEGAL_VERSION,
      accepted_at: data?.accepted_at ?? new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Legal acceptance failed:", err);
    res.status(500).json({ message: "Failed to record legal acceptance" });
  }
});

