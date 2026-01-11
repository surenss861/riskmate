import express, { type Router as ExpressRouter } from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate } from "../middleware/auth";
import { recordAuditLog } from "../middleware/audit";
import { createErrorResponse } from "../utils/errorResponse";

export const accountRouter: ExpressRouter = express.Router();

// Helper to log security events
async function logSecurityEvent(
  organizationId: string | null,
  userId: string,
  eventType: string,
  eventName: string,
  metadata: Record<string, unknown> = {},
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await supabase.from("security_events").insert({
      organization_id: organizationId,
      user_id: userId,
      event_type: eventType,
      event_name: eventName,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      metadata,
    });
  } catch (err) {
    console.error("Failed to log security event:", err);
  }
}

// PATCH /api/account/profile
// Updates user profile (full_name, phone)
accountRouter.patch(
  "/profile",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(createErrorResponse({
          message: "Unauthorized",
          code: "AUTH_UNAUTHORIZED",
          status: 401,
        }).response);
      }

      const { full_name, phone } = req.body;

      // Get current profile to compare
      const { data: currentProfile, error: fetchError } = await supabase
        .from("users")
        .select("id, email, full_name, phone, organization_id")
        .eq("id", userId)
        .single();

      if (fetchError || !currentProfile) {
        return res.status(404).json(createErrorResponse({
          message: "Profile not found",
          code: "ACCOUNT_PROFILE_NOT_FOUND",
          status: 404,
        }).response);
      }

      // Update profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from("users")
        .update({
          full_name: full_name !== undefined ? full_name : null,
          phone: phone !== undefined ? phone : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (updateError) {
        return res.status(400).json(createErrorResponse({
          message: "Failed to update profile",
          code: "ACCOUNT_UPDATE_FAILED",
          status: 400,
        }).response);
      }

      // Log audit event
      if (currentProfile.organization_id) {
        await recordAuditLog({
          organizationId: currentProfile.organization_id,
          actorId: userId,
          eventName: "account.profile_updated",
          targetType: "system",
          targetId: userId,
          metadata: {
            field: full_name !== undefined ? "full_name" : "phone",
            old_value: full_name !== undefined ? currentProfile.full_name : currentProfile.phone,
            new_value: full_name !== undefined ? full_name : phone,
          },
        });
      }

      res.json({
        data: updatedProfile,
        message: "Profile updated successfully",
      });
    } catch (err: any) {
      console.error("Profile update error:", err);
      res.status(500).json(createErrorResponse({
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        status: 500,
      }).response);
    }
  }
);

// PATCH /api/account/organization
// Updates organization name (owner/admin only)
accountRouter.patch(
  "/organization",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(createErrorResponse({
          message: "Unauthorized",
          code: "AUTH_UNAUTHORIZED",
          status: 401,
        }).response);
      }

      const { name } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json(createErrorResponse({
          message: "Organization name is required",
          code: "ACCOUNT_ORG_NAME_REQUIRED",
          status: 400,
        }).response);
      }

      // Get user's role and organization
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, role, organization_id")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return res.status(404).json(createErrorResponse({
          message: "User not found",
          code: "ACCOUNT_USER_NOT_FOUND",
          status: 404,
        }).response);
      }

      // Check permissions (owner only for org name updates)
      // Admins can manage team but not org-level settings
      if (user.role !== "owner") {
        // Log capability violation for audit trail
        try {
          await recordAuditLog({
            organizationId: user.organization_id,
            actorId: userId,
            eventName: "auth.role_violation",
            targetType: "organization",
            targetId: user.organization_id,
            metadata: {
              role: user.role,
              attempted_action: "update_organization_name",
              result: "denied",
              reason: "Only owner role can update organization settings",
            },
          });
        } catch (auditError) {
          // Non-fatal: log but don't fail the request
          console.warn("Audit log failed for role violation:", auditError);
        }

        return res.status(403).json(createErrorResponse({
          message: "Only owners can update organization name",
          code: "AUTH_ROLE_FORBIDDEN",
          status: 403,
        }).response);
      }

      if (!user.organization_id) {
        return res.status(400).json(createErrorResponse({
          message: "User is not associated with an organization",
          code: "ACCOUNT_NO_ORGANIZATION",
          status: 400,
        }).response);
      }

      // Get current organization
      const { data: currentOrg, error: orgError } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", user.organization_id)
        .single();

      if (orgError || !currentOrg) {
        return res.status(404).json(createErrorResponse({
          message: "Organization not found",
          code: "ACCOUNT_ORG_NOT_FOUND",
          status: 404,
        }).response);
      }

      // Update organization
      const { data: updatedOrg, error: updateError } = await supabase
        .from("organizations")
        .update({
          name: name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.organization_id)
        .select()
        .single();

      if (updateError) {
        return res.status(400).json(createErrorResponse({
          message: "Failed to update organization",
          code: "ACCOUNT_ORG_UPDATE_FAILED",
          status: 400,
        }).response);
      }

      // Log audit event
      await recordAuditLog({
        organizationId: user.organization_id,
        actorId: userId,
        eventName: "account.organization_updated",
        targetType: "system",
        targetId: user.organization_id,
        metadata: {
          field: "name",
          old_value: currentOrg.name,
          new_value: updatedOrg.name,
        },
      });

      res.json({
        data: updatedOrg,
        message: "Organization updated successfully",
      });
    } catch (err: any) {
      console.error("Organization update error:", err);
      res.status(500).json(createErrorResponse({
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        status: 500,
      }).response);
    }
  }
);

// GET /api/account/billing
// Returns comprehensive billing information
accountRouter.get(
  "/billing",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organization_id;
      if (!userId || !organizationId) {
        return res.status(401).json(createErrorResponse({
          message: "Unauthorized",
          code: "AUTH_UNAUTHORIZED",
          status: 401,
        }).response);
      }

      // Get subscription from cache
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError && subError.code !== "PGRST116") {
        throw subError;
      }

      // Get org subscription for limits
      const { data: orgSub, error: orgSubError } = await supabase
        .from("org_subscriptions")
        .select("plan_code, seats_limit, jobs_limit_month, status")
        .eq("organization_id", organizationId)
        .maybeSingle();

      // Get seat count
      const { count: seatCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("account_status", "active");

      const billingData = {
        tier: subscription?.tier || orgSub?.plan_code || null,
        status: subscription?.status || orgSub?.status || "none",
        stripe_customer_id: subscription?.stripe_customer_id || null,
        stripe_subscription_id: subscription?.stripe_subscription_id || null,
        current_period_start: subscription?.current_period_start || null,
        current_period_end: subscription?.current_period_end || null,
        renewal_date: subscription?.current_period_end || null,
        seats_used: seatCount || 0,
        seats_limit: orgSub?.seats_limit || null,
        jobs_limit: orgSub?.jobs_limit_month || null,
        managed_by: subscription?.stripe_customer_id ? "stripe" : "internal",
      };

      res.json({ data: billingData });
    } catch (err: any) {
      console.error("Billing fetch error:", err);
      res.status(500).json(createErrorResponse({
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        status: 500,
      }).response);
    }
  }
);

// POST /api/account/security/revoke-sessions
// Revokes all user sessions except current one
accountRouter.post(
  "/security/revoke-sessions",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organization_id;
      if (!userId) {
        return res.status(401).json(createErrorResponse({
          message: "Unauthorized",
          code: "AUTH_UNAUTHORIZED",
          status: 401,
        }).response);
      }

      // Get IP and user agent from request
      const ipAddress = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.headers["user-agent"] || undefined;

      // Revoke all refresh tokens for this user (Supabase admin API)
      // Note: This requires service role key
      const { error: revokeError } = await supabase.auth.admin.signOut(userId, "global");

      if (revokeError) {
        console.error("Failed to revoke sessions:", revokeError);
        // Continue anyway - log the event
      }

      // Get organization_id if not provided
      let orgId = organizationId;
      if (!orgId) {
        const { data: user } = await supabase
          .from("users")
          .select("organization_id")
          .eq("id", userId)
          .maybeSingle();
        orgId = user?.organization_id || null;
      }

      // Log security event
      await logSecurityEvent(
        orgId,
        userId,
        "session_revoked",
        "security.sessions_revoked",
        { scope: "all" },
        ipAddress,
        userAgent
      );

      res.json({
        message: "All sessions revoked successfully",
      });
    } catch (err: any) {
      console.error("Revoke sessions error:", err);
      res.status(500).json(createErrorResponse({
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        status: 500,
      }).response);
    }
  }
);

// GET /api/account/security/events
// Returns recent security events for the user
accountRouter.get(
  "/security/events",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(createErrorResponse({
          message: "Unauthorized",
          code: "AUTH_UNAUTHORIZED",
          status: 401,
        }).response);
      }

      const limit = parseInt(req.query.limit as string) || 10;

      const { data: events, error } = await supabase
        .from("security_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      res.json({ data: events || [] });
    } catch (err: any) {
      console.error("Security events fetch error:", err);
      res.status(500).json(createErrorResponse({
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        status: 500,
      }).response);
    }
  }
);

// POST /api/account/deactivate
// Deactivates user account (safe deletion with retention)
accountRouter.post(
  "/deactivate",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organization_id;
      if (!userId) {
        return res.status(401).json(createErrorResponse({
          message: "Unauthorized",
          code: "AUTH_UNAUTHORIZED",
          status: 401,
        }).response);
      }

      const { confirmation, reason } = req.body;

      // Require confirmation text
      if (!confirmation || confirmation !== "DELETE") {
        return res.status(400).json(createErrorResponse({
          message: "Confirmation required. Type 'DELETE' to confirm.",
          code: "ACCOUNT_DELETE_CONFIRMATION_REQUIRED",
          status: 400,
        }).response);
      }

      // Get user to check if they're the owner
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, role, organization_id, account_status")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return res.status(404).json(createErrorResponse({
          message: "User not found",
          code: "ACCOUNT_USER_NOT_FOUND",
          status: 404,
        }).response);
      }

      // If owner, check if there are other active users
      if (user.role === "owner") {
        const { count: activeUsers } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", user.organization_id)
          .eq("account_status", "active")
          .neq("id", userId);

        if (activeUsers && activeUsers > 0) {
          return res.status(400).json(createErrorResponse({
            message: "Cannot deactivate account: you are the organization owner and there are other active users. Please transfer ownership first.",
            code: "ACCOUNT_OWNER_CANNOT_DELETE",
            status: 400,
          }).response);
        }
      }

      // Deactivate account
      const { error: updateError } = await supabase
        .from("users")
        .update({
          account_status: "pending_delete",
          deactivated_at: new Date().toISOString(),
          delete_requested_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        return res.status(400).json(createErrorResponse({
          message: "Failed to deactivate account",
          code: "ACCOUNT_DEACTIVATE_FAILED",
          status: 400,
        }).response);
      }

      // Log audit event
      if (organizationId) {
        await recordAuditLog({
          organizationId,
          actorId: userId,
          eventName: "account.deactivation_requested",
          targetType: "system",
          targetId: userId,
          metadata: {
            reason: reason || null,
            retention_days: 30,
          },
        });
      }

      // Log security event
      const ipAddress = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.headers["user-agent"] || undefined;
      await logSecurityEvent(
        organizationId || null,
        userId,
        "account_deactivation",
        "security.account_deactivation_requested",
        { reason: reason || null },
        ipAddress,
        userAgent
      );

      res.json({
        message: "Account deactivation requested. Data will be retained for 30 days before permanent deletion.",
        retention_days: 30,
      });
    } catch (err: any) {
      console.error("Account deactivation error:", err);
      res.status(500).json(createErrorResponse({
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        status: 500,
      }).response);
    }
  }
);

