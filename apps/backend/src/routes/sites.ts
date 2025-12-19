import express from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { recordAuditLog } from "../middleware/audit";
import { RequestWithId } from "../middleware/requestId";
import { createErrorResponse, logErrorForSupport } from "../utils/errorResponse";

export const sitesRouter = express.Router();

// GET /api/sites
// Returns all sites for the organization
sitesRouter.get("/", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest & RequestWithId;
  const requestId = authReq.requestId || 'unknown';
  try {
    const { organization_id } = authReq.user;

    const { data, error } = await supabase
      .from("sites")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("archived", false)
      .order("name", { ascending: true });

    if (error) throw error;

    res.json({ data: data || [] });
  } catch (err: any) {
    console.error("Sites fetch failed:", err);
    const { response: errorResponse, errorId } = createErrorResponse({
      message: "Failed to fetch sites",
      internalMessage: err?.message || String(err),
      code: "SITES_FETCH_FAILED",
      requestId,
      statusCode: 500,
    });
    res.setHeader('X-Error-ID', errorId);
    res.status(500).json(errorResponse);
  }
});

// POST /api/sites
// Creates a new site
sitesRouter.post("/", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest & RequestWithId;
  const requestId = authReq.requestId || 'unknown';
  try {
    const { organization_id, id: userId } = authReq.user;
    const { name, address, city, state, postal_code, contact_name, contact_email, contact_phone } = req.body;

    if (!name) {
      const { response: errorResponse, errorId } = createErrorResponse({
        message: "Site name is required",
        internalMessage: "Site creation attempted without name",
        code: "VALIDATION_ERROR",
        requestId,
        statusCode: 400,
      });
      res.setHeader('X-Error-ID', errorId);
      return res.status(400).json(errorResponse);
    }

    const { data, error } = await supabase
      .from("sites")
      .insert({
        organization_id,
        name,
        address,
        city,
        state,
        postal_code,
        contact_name,
        contact_email,
        contact_phone,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    await recordAuditLog({
      organizationId: organization_id,
      actorId: userId,
      eventName: "site.created",
      targetType: "site",
      targetId: data.id,
      metadata: { site_name: name },
    });

    res.json({ data });
  } catch (err: any) {
    console.error("Site creation failed:", err);
    const { response: errorResponse, errorId } = createErrorResponse({
      message: "Failed to create site",
      internalMessage: err?.message || String(err),
      code: "SITE_CREATION_FAILED",
      requestId,
      statusCode: 500,
    });
    res.setHeader('X-Error-ID', errorId);
    res.status(500).json(errorResponse);
  }
});

