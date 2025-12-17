import express from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate } from "../middleware/auth";
import { recordAuditLog } from "../middleware/audit";
import { createErrorResponse } from "../utils/errorResponse";

export const accountRouter = express.Router();

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

      // Check permissions (owner/admin only)
      if (user.role !== "owner" && user.role !== "admin") {
        return res.status(403).json(createErrorResponse({
          message: "Only owners and admins can update organization name",
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

