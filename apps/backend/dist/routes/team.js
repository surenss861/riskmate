"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamRouter = void 0;
const express_1 = __importDefault(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
const planRules_1 = require("../auth/planRules");
exports.teamRouter = express_1.default.Router();
const ALLOWED_ROLES = new Set(["owner", "admin", "member"]);
function generateTempPassword(length = 12) {
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = crypto_1.default.randomBytes(length);
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset[bytes[i] % charset.length];
    }
    return password;
}
exports.teamRouter.use(auth_1.authenticate);
exports.teamRouter.get("/", async (req, res) => {
    const authReq = req;
    try {
        const organizationId = authReq.user.organization_id;
        const { data: members, error: membersError } = await supabaseClient_1.supabase
            .from("users")
            .select("id, email, full_name, role, created_at, must_reset_password")
            .eq("organization_id", organizationId)
            .is("archived_at", null)
            .order("created_at", { ascending: true });
        if (membersError) {
            throw membersError;
        }
        const { data: invites, error: invitesError } = await supabaseClient_1.supabase
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
        const seatLimit = authReq.user.seatsLimit ?? (0, planRules_1.limitsFor)(authReq.user.plan).seats ?? null;
        res.json({
            members: members ?? [],
            invites: invites ?? [],
            seats: {
                limit: seatLimit,
                used: activeMembers,
                pending: pendingInvites,
                available: seatLimit === null ? null : Math.max(seatLimit - activeMembers, 0),
            },
            current_user_role: authReq.user.role ?? "member",
            plan: authReq.user.plan,
        });
    }
    catch (error) {
        console.error("Team fetch failed:", error);
        res.status(500).json({
            message: "Failed to load team",
            detail: error?.message ?? null,
            hint: error?.hint ?? null,
            code: error?.code ?? null,
        });
    }
});
exports.teamRouter.post("/invite", async (req, res) => {
    const authReq = req;
    try {
        const { email, role = "member" } = authReq.body ?? {};
        if (!email || typeof email !== "string") {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!ALLOWED_ROLES.has(role)) {
            return res.status(400).json({ message: "Invalid role selection" });
        }
        if (!["owner", "admin"].includes(authReq.user.role ?? "")) {
            return res.status(403).json({ message: "Only admins can invite teammates" });
        }
        if (authReq.user.subscriptionStatus === "past_due" || authReq.user.subscriptionStatus === "canceled") {
            return res.status(402).json({
                message: "Subscription inactive. Update billing to invite teammates.",
                code: "PLAN_INACTIVE",
            });
        }
        const organizationId = authReq.user.organization_id;
        const normalizedEmail = email.trim().toLowerCase();
        const { data: memberCountData, error: memberCountError, count: memberCount } = await supabaseClient_1.supabase
            .from("users")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .is("archived_at", null);
        if (memberCountError) {
            throw memberCountError;
        }
        const seatLimit = authReq.user.seatsLimit ?? (0, planRules_1.limitsFor)(authReq.user.plan).seats ?? null;
        if (seatLimit !== null && (memberCount ?? 0) >= seatLimit) {
            return res.status(402).json({
                message: "Seat limit reached. Upgrade your plan to add more teammates.",
                code: "SEAT_LIMIT_REACHED",
            });
        }
        const { data: existingMember } = await supabaseClient_1.supabase
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
        const { data: createdUser, error: createUserError } = await supabaseClient_1.supabase.auth.admin.createUser({
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
        const { error: insertUserError } = await supabaseClient_1.supabase.from("users").insert({
            id: newUserId,
            email: normalizedEmail,
            organization_id: organizationId,
            role,
            must_reset_password: true,
            invited_by: authReq.user.id,
        });
        if (insertUserError) {
            await supabaseClient_1.supabase.auth.admin.deleteUser(newUserId);
            throw insertUserError;
        }
        let inviteRow = null;
        try {
            const { data: inviteData, error: inviteInsertError } = await supabaseClient_1.supabase
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
        }
        catch (inviteInsertError) {
            console.warn("Invite row insert failed:", inviteInsertError?.message);
        }
        res.json({
            data: inviteRow,
            temporary_password: tempPassword,
            seats_remaining: seatLimit === null
                ? null
                : Math.max(seatLimit - ((memberCount ?? 0) + 1), 0),
        });
    }
    catch (error) {
        console.error("Team invite failed:", error);
        res.status(500).json({ message: "Failed to send invite" });
    }
});
exports.teamRouter.delete("/invite/:id", async (req, res) => {
    const authReq = req;
    try {
        if (!["owner", "admin"].includes(authReq.user.role ?? "")) {
            return res.status(403).json({ message: "Only admins can revoke invites" });
        }
        const { data: inviteRow, error: inviteFetchError } = await supabaseClient_1.supabase
            .from("organization_invites")
            .select("user_id")
            .eq("id", authReq.params.id)
            .eq("organization_id", authReq.user.organization_id)
            .is("accepted_at", null)
            .maybeSingle();
        if (inviteFetchError) {
            throw inviteFetchError;
        }
        if (inviteRow?.user_id) {
            await supabaseClient_1.supabase
                .from("users")
                .update({ archived_at: new Date().toISOString() })
                .eq("id", inviteRow.user_id);
            try {
                await supabaseClient_1.supabase.auth.admin.deleteUser(inviteRow.user_id);
            }
            catch (adminDeleteError) {
                console.warn("Supabase user deletion failed:", adminDeleteError?.message);
            }
        }
        const { error: revokeError } = await supabaseClient_1.supabase
            .from("organization_invites")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", authReq.params.id)
            .eq("organization_id", authReq.user.organization_id)
            .is("accepted_at", null);
        if (revokeError) {
            throw revokeError;
        }
        res.json({ status: "revoked" });
    }
    catch (error) {
        console.error("Invite revoke failed:", error);
        res.status(500).json({ message: "Failed to revoke invite" });
    }
});
exports.teamRouter.delete("/member/:id", async (req, res) => {
    const authReq = req;
    try {
        if (!["owner", "admin"].includes(authReq.user.role ?? "")) {
            return res.status(403).json({ message: "Only owners and admins can remove teammates" });
        }
        if (authReq.user.id === authReq.params.id) {
            return res.status(400).json({ message: "You cannot remove yourself." });
        }
        // Check if the target member is an owner
        const { data: targetMember, error: targetError } = await supabaseClient_1.supabase
            .from("users")
            .select("id, role")
            .eq("id", authReq.params.id)
            .eq("organization_id", authReq.user.organization_id)
            .is("archived_at", null)
            .maybeSingle();
        if (targetError) {
            throw targetError;
        }
        if (!targetMember) {
            return res.status(404).json({ message: "Teammate not found" });
        }
        // Prevent removing owners (only owners can remove other owners, and only if there are multiple)
        if (targetMember.role === "owner") {
            // Check if there are multiple owners
            const { count, error: ownerCountError } = await supabaseClient_1.supabase
                .from("users")
                .select("id", { count: "exact", head: true })
                .eq("organization_id", authReq.user.organization_id)
                .eq("role", "owner")
                .is("archived_at", null);
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
        const { error } = await supabaseClient_1.supabase
            .from("users")
            .update({ archived_at: new Date().toISOString() })
            .eq("id", authReq.params.id)
            .eq("organization_id", authReq.user.organization_id)
            .is("archived_at", null);
        if (error) {
            throw error;
        }
        res.json({ status: "removed" });
    }
    catch (error) {
        console.error("Member removal failed:", error);
        res.status(500).json({ message: "Failed to remove teammate" });
    }
});
exports.teamRouter.post("/acknowledge-reset", async (req, res) => {
    const authReq = req;
    try {
        await supabaseClient_1.supabase
            .from("users")
            .update({ must_reset_password: false })
            .eq("id", authReq.user.id);
        await supabaseClient_1.supabase
            .from("organization_invites")
            .update({ accepted_at: new Date().toISOString() })
            .eq("user_id", authReq.user.id)
            .is("accepted_at", null);
        res.json({ status: "ok" });
    }
    catch (error) {
        console.error("Reset acknowledgement failed:", error);
        res.status(500).json({ message: "Failed to acknowledge password reset" });
    }
});
//# sourceMappingURL=team.js.map