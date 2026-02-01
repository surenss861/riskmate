import express, { type Router as ExpressRouter } from "express";
import crypto from "crypto";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { canInviteRole, onlyOwnerCanSetOwner, requireRole } from "../middleware/rbac";
import { limitsFor } from "../auth/planRules";
import { recordAuditLog, extractClientMetadata } from "../middleware/audit";

export const teamRouter: ExpressRouter = express.Router();

const ALLOWED_ROLES = new Set(["owner", "admin", "safety_lead", "executive", "member"]);

// Helper to log team events
async function logTeamEvent(
  organizationId: string,
  actorId: string,
  eventType: string,
  eventName: string,
  targetUserId?: string | null,
  targetInviteId?: string | null,
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase.from("team_events").insert({
      organization_id: organizationId,
      actor_id: actorId,
      event_type: eventType,
      event_name: eventName,
      target_user_id: targetUserId || null,
      target_invite_id: targetInviteId || null,
      metadata,
    });
  } catch (err) {
    console.error("Failed to log team event:", err);
  }
}

function generateTempPassword(length = 12) {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

teamRouter.use(authenticate as unknown as express.RequestHandler);

teamRouter.get("/", async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const organizationId = authReq.user.organization_id;

    // Try to filter by account_status, fallback to archived_at if column doesn't exist
    let membersQuery = supabase
      .from("users")
      .select("id, email, full_name, role, created_at, must_reset_password, account_status")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    try {
      membersQuery = membersQuery.eq("account_status", "active");
    } catch (e) {
      // Column doesn't exist, fallback to archived_at filter
      membersQuery = membersQuery.is("archived_at", null);
    }

    const { data: members, error: membersError } = await membersQuery;

    if (membersError) {
      throw membersError;
    }

    const { data: invites, error: invitesError } = await supabase
      .from("organization_invites")
      .select("id, email, role, created_at, invited_by, user_id")
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: true });

    if (invitesError) {
      throw invitesError;
    }
    const activeMembers = members?.length ?? 0;
    const pendingInvites = invites?.length ?? 0;
    const seatLimit =
      authReq.user.seatsLimit ?? limitsFor(authReq.user.plan).seats ?? null;

    // Calculate risk coverage (role distribution)
    const roleCounts = {
      owner: 0,
      admin: 0,
      safety_lead: 0,
      executive: 0,
      member: 0,
    };
    (members || []).forEach((member) => {
      if (roleCounts.hasOwnProperty(member.role)) {
        roleCounts[member.role as keyof typeof roleCounts]++;
      }
    });

    res.json({
      members: members ?? [],
      invites: invites ?? [],
      seats: {
        limit: seatLimit,
        used: activeMembers,
        pending: pendingInvites,
        available:
          seatLimit === null ? null : Math.max(seatLimit - activeMembers, 0),
      },
      risk_coverage: roleCounts,
      current_user_role: authReq.user.role ?? "member",
      plan: authReq.user.plan,
    });
  } catch (error: any) {
    console.error("Team fetch failed:", error);
    res.status(500).json({
      message: "Failed to load team",
      detail: error?.message ?? null,
      hint: error?.hint ?? null,
      code: error?.code ?? null,
    });
  }
});

teamRouter.post("/invite", requireRole("safety_lead"), async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { email, role = "member" } = authReq.body ?? {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ message: "Invalid role selection" });
    }

    if (!onlyOwnerCanSetOwner(authReq.user.role, role)) {
      return res.status(403).json({ message: "Only owners can invite or create owners" });
    }

    if (!canInviteRole(authReq.user.role, role)) {
      return res.status(403).json({
        message: "You cannot invite this role. Owners can invite anyone; admins can invite member, safety lead, executive; safety leads can invite members only.",
      });
    }

    if (authReq.user.subscriptionStatus === "past_due" || authReq.user.subscriptionStatus === "canceled") {
      return res.status(402).json({
        message: "Subscription inactive. Update billing to invite teammates.",
        code: "PLAN_INACTIVE",
      });
    }

    const organizationId = authReq.user.organization_id;
    // Validate and normalize email
    const normalizedEmail = email.trim().toLowerCase();
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ 
        message: "Invalid email format",
        code: "INVALID_EMAIL"
      });
    }

    // Try to filter by account_status, fallback to archived_at if column doesn't exist
    let memberCountQuery = supabase
        .from("users")
        .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);

    try {
      memberCountQuery = memberCountQuery.eq("account_status", "active");
    } catch (e) {
      memberCountQuery = memberCountQuery.is("archived_at", null);
    }

    const { data: memberCountData, error: memberCountError, count: memberCount } = await memberCountQuery;

    if (memberCountError) {
      throw memberCountError;
    }

    const seatLimit =
      authReq.user.seatsLimit ?? limitsFor(authReq.user.plan).seats ?? null;

    if (seatLimit !== null && (memberCount ?? 0) >= seatLimit) {
      return res.status(402).json({
        message: "Seat limit reached. Upgrade your plan to add more teammates.",
        code: "SEAT_LIMIT_REACHED",
      });
    }

    const { data: existingMember } = await supabase
      .from("users")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", normalizedEmail)
      .is("archived_at", null)
      .maybeSingle();

    if (existingMember) {
      return res.status(409).json({
        message: "That teammate is already part of your organization.",
      });
    }

    const tempPassword = generateTempPassword(12);

    const { data: createdUser, error: createUserError } =
      await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          invited_by: authReq.user.id,
          organization_id: organizationId,
        },
      });

    if (createUserError || !createdUser?.user) {
      if (createUserError?.message?.includes("already registered")) {
        return res
          .status(409)
          .json({ message: "That email already has a RiskMate account." });
      }
      throw createUserError;
    }

    const newUserId = createdUser.user.id;

    const { error: insertUserError } = await supabase.from("users").insert({
      id: newUserId,
      email: normalizedEmail,
      organization_id: organizationId,
      role,
      must_reset_password: true,
      invited_by: authReq.user.id,
    });

    if (insertUserError) {
      await supabase.auth.admin.deleteUser(newUserId);
      throw insertUserError;
    }

    let inviteRow: any = null;
    try {
      const { data: inviteData, error: inviteInsertError } = await supabase
        .from("organization_invites")
        .insert({
          organization_id: organizationId,
          email: normalizedEmail,
          role,
          invited_by: authReq.user.id,
          user_id: newUserId,
        })
        .select("id, email, role, created_at, user_id")
        .single();

      if (inviteInsertError) {
        throw inviteInsertError;
      }
      inviteRow = inviteData;
    } catch (inviteInsertError: any) {
      console.warn("Invite row insert failed:", inviteInsertError?.message);
    }

    // Log team event
    await logTeamEvent(
      organizationId,
      authReq.user.id,
      "invite_sent",
      "team.invite_sent",
      newUserId,
      inviteRow?.id || null,
      {
        email: normalizedEmail,
        role,
      }
    );

    // Also log to audit_logs for consistency
    await recordAuditLog({
      organizationId,
      actorId: authReq.user.id,
      eventName: "team.invite_sent",
      targetType: "system",
      targetId: newUserId,
      metadata: {
        email: normalizedEmail,
        role,
        invite_id: inviteRow?.id || null,
      },
    });

    res.json({
      data: inviteRow,
      temporary_password: tempPassword,
      seats_remaining:
        seatLimit === null
          ? null
          : Math.max(seatLimit - ((memberCount ?? 0) + 1), 0),
    });
  } catch (error: any) {
    console.error("Team invite failed:", error);
    res.status(500).json({ message: "Failed to send invite" });
  }
});

teamRouter.delete("/invite/:id", requireRole("admin"), async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { data: inviteRow, error: inviteFetchError } = await supabase
      .from("organization_invites")
      .select("user_id, email")
      .eq("id", authReq.params.id)
      .eq("organization_id", authReq.user.organization_id)
      .is("accepted_at", null)
      .maybeSingle();

    if (inviteFetchError) {
      throw inviteFetchError;
    }

    if (inviteRow?.user_id) {
      await supabase
        .from("users")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", inviteRow.user_id);

      try {
        await supabase.auth.admin.deleteUser(inviteRow.user_id);
      } catch (adminDeleteError: any) {
        console.warn("Supabase user deletion failed:", adminDeleteError?.message);
      }
    }

    const { error: revokeError } = await supabase
      .from("organization_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", authReq.params.id)
      .eq("organization_id", authReq.user.organization_id)
      .is("accepted_at", null);

    if (revokeError) {
      throw revokeError;
    }

    // Log team event
    await logTeamEvent(
      authReq.user.organization_id,
      authReq.user.id,
      "invite_revoked",
      "team.invite_revoked",
      inviteRow?.user_id || null,
      authReq.params.id,
      {
        email: inviteRow?.email || null,
      }
    );

    res.json({ status: "revoked" });
  } catch (error: any) {
    console.error("Invite revoke failed:", error);
    res.status(500).json({ message: "Failed to revoke invite" });
  }
});

teamRouter.delete("/member/:id", requireRole("admin"), async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (authReq.user.id === authReq.params.id) {
      return res.status(400).json({ message: "You cannot remove yourself." });
    }

    // Check if the target member is an owner
    let targetMemberQuery = supabase
      .from("users")
      .select("id, role, email")
      .eq("id", authReq.params.id)
      .eq("organization_id", authReq.user.organization_id);

    try {
      targetMemberQuery = targetMemberQuery.eq("account_status", "active");
    } catch (e) {
      targetMemberQuery = targetMemberQuery.is("archived_at", null);
    }

    const { data: targetMember, error: targetError } = await targetMemberQuery.maybeSingle();

    if (targetError) {
      throw targetError;
    }

    if (!targetMember) {
      return res.status(404).json({ message: "Teammate not found" });
    }

    // Last-admin protection: cannot remove the last admin
    if (targetMember.role === "admin") {
      let adminCountQuery = supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", authReq.user.organization_id)
        .eq("role", "admin");
      try {
        adminCountQuery = adminCountQuery.eq("account_status", "active");
      } catch {
        adminCountQuery = adminCountQuery.is("archived_at", null);
      }
      const { count: adminCount, error: adminCountError } = await adminCountQuery;
      if (!adminCountError && (adminCount ?? 0) <= 1) {
        return res.status(400).json({
          message: "Cannot remove the last admin. Promote another user to admin first or transfer ownership.",
        });
      }
    }

    // Prevent removing owners (only owners can remove other owners, and only if there are multiple)
    if (targetMember.role === "owner") {
      // Check if there are multiple owners
      let ownerCountQuery = supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", authReq.user.organization_id)
        .eq("role", "owner");

      try {
        ownerCountQuery = ownerCountQuery.eq("account_status", "active");
      } catch (e) {
        ownerCountQuery = ownerCountQuery.is("archived_at", null);
      }

      const { count, error: ownerCountError } = await ownerCountQuery;

      if (ownerCountError) {
        throw ownerCountError;
      }

      // Only allow removing an owner if:
      // 1. The requester is an owner (not just an admin)
      // 2. There are multiple owners (so we don't leave the org without an owner)
      if (authReq.user.role !== "owner") {
        return res.status(403).json({ message: "Only owners can remove other owners" });
      }

      if ((count ?? 0) <= 1) {
        return res.status(400).json({
          message: "Cannot remove the last owner. Transfer ownership or add another owner first.",
        });
      }
    }

    // Deactivate access (soft delete)
    // Try to set account_status, fallback to just archived_at if column doesn't exist
    const updateData: any = {
      archived_at: new Date().toISOString(),
    };

    try {
      // Check if account_status column exists by trying to query it
      const { error: checkError } = await supabase
        .from("users")
        .select("account_status")
        .eq("id", authReq.params.id)
        .limit(1);
      
      if (!checkError) {
        // Column exists, use it
        updateData.account_status = "deactivated";
        updateData.deactivated_at = new Date().toISOString();
      }
    } catch (e) {
      // Column doesn't exist, just use archived_at
    }

    const { error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", authReq.params.id)
      .eq("organization_id", authReq.user.organization_id);

    if (error) {
      throw error;
    }

    // Log team event
    await logTeamEvent(
      authReq.user.organization_id,
      authReq.user.id,
      "access_revoked",
      "team.member_removed",
      authReq.params.id,
      null,
      {
        target_role: targetMember.role,
        target_email: targetMember.email || null,
      }
    );

    // Also log to audit_logs
    await recordAuditLog({
      organizationId: authReq.user.organization_id,
      actorId: authReq.user.id,
      eventName: "team.member_removed",
      targetType: "system",
      targetId: authReq.params.id,
      metadata: {
        target_role: targetMember.role,
        target_email: targetMember.email || null,
      },
    });

    res.json({ status: "removed" });
  } catch (error: any) {
    console.error("Member removal failed:", error);
    res.status(500).json({ message: "Failed to remove teammate" });
  }
});

// PATCH /api/team/member/:id/role — change user role (Admin+). Only Owner can set Owner. Logs user_role_changed to audit.
teamRouter.patch("/member/:id/role", requireRole("admin"), async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const targetUserId = req.params.id;
    const { new_role: newRole, reason } = req.body ?? {};

    if (!ALLOWED_ROLES.has(newRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (!onlyOwnerCanSetOwner(authReq.user.role, newRole)) {
      return res.status(403).json({ message: "Only owners can promote to owner" });
    }

    if (authReq.user.role === "admin" && !["member", "safety_lead", "executive"].includes(newRole)) {
      return res.status(403).json({ message: "Admins can only set roles: member, safety_lead, executive" });
    }

    const { data: targetUser, error: fetchError } = await supabase
      .from("users")
      .select("id, role, organization_id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (fetchError || !targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.organization_id !== authReq.user.organization_id) {
      return res.status(403).json({ message: "User not in your organization" });
    }

    const oldRole = targetUser.role ?? "member";
    if (oldRole === newRole) {
      return res.status(200).json({ message: "Role unchanged", role: oldRole });
    }

    // Last-admin protection: cannot demote the last admin
    if (oldRole === "admin") {
      let adminCountQuery = supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", authReq.user.organization_id)
        .eq("role", "admin");
      try {
        adminCountQuery = adminCountQuery.eq("account_status", "active");
      } catch {
        adminCountQuery = adminCountQuery.is("archived_at", null);
      }
      const { count: adminCount } = await adminCountQuery;
      if ((adminCount ?? 0) <= 1) {
        return res.status(400).json({
          message: "Cannot change role of the last admin. Promote another user to admin first.",
        });
      }
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", targetUserId)
      .eq("organization_id", authReq.user.organization_id);

    if (updateError) {
      throw updateError;
    }

    const clientMeta = extractClientMetadata(req);
    await recordAuditLog({
      organizationId: authReq.user.organization_id,
      actorId: authReq.user.id,
      eventName: "user_role_changed",
      targetType: "user",
      targetId: targetUserId,
      metadata: {
        old_role: oldRole,
        new_role: newRole,
        actor_role: authReq.user.role ?? "member",
        reason: reason ?? null,
      },
      client: clientMeta.client,
      appVersion: clientMeta.appVersion,
      deviceId: clientMeta.deviceId,
    });

    await logTeamEvent(
      authReq.user.organization_id,
      authReq.user.id,
      "role_changed",
      "team.role_changed",
      targetUserId,
      null,
      { old_role: oldRole, new_role: newRole, reason: reason ?? null }
    );

    res.json({
      message: "Role updated",
      user_id: targetUserId,
      old_role: oldRole,
      new_role: newRole,
    });
  } catch (error: any) {
    console.error("Role change failed:", error);
    res.status(500).json({ message: "Failed to change role" });
  }
});

teamRouter.post("/acknowledge-reset", async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    await supabase
      .from("users")
      .update({ must_reset_password: false })
      .eq("id", authReq.user.id);

    const { data: invite } = await supabase
      .from("organization_invites")
      .select("id, email, role")
      .eq("user_id", authReq.user.id)
      .is("accepted_at", null)
      .maybeSingle();

    await supabase
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("user_id", authReq.user.id)
      .is("accepted_at", null);

    // Log team event
    if (invite) {
      await logTeamEvent(
        authReq.user.organization_id,
        authReq.user.id,
        "invite_accepted",
        "team.invite_accepted",
        authReq.user.id,
        invite.id,
        {
          email: invite.email,
          role: invite.role,
        }
      );
    }

    res.json({ status: "ok" });
  } catch (error: any) {
    console.error("Reset acknowledgement failed:", error);
    res.status(500).json({ message: "Failed to acknowledge password reset" });
  }
});

