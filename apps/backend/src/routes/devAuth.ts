import { Router, type Router as ExpressRouter } from "express";
import { createClient } from "@supabase/supabase-js";

const router: ExpressRouter = Router();

/**
 * GET /v1/dev/whoami?user_id=...&org_id=...
 * 
 * Requires header: X-Dev-Secret: <DEV_AUTH_SECRET>
 * 
 * Returns user info for a user_id/org_id without requiring auth token.
 * Useful for testing/debugging user data without needing a real Supabase session token.
 * 
 * Note: To test authenticated endpoints, you need a real Supabase access_token from login.
 * Get it from:
 * - Web: DevTools → Application → Local Storage → supabase.auth.token → access_token
 * - iOS: Check APIClient logs or session storage
 */
router.get("/whoami", async (req, res) => {
  const secret = process.env.DEV_AUTH_SECRET;
  if (!secret) {
    return res.status(500).json({ message: "DEV_AUTH_SECRET not configured" });
  }

  const headerSecret = req.header("X-Dev-Secret");
  if (!headerSecret || headerSecret !== secret) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const user_id = String(req.query.user_id || "").trim();
  const organization_id = String(req.query.org_id || "").trim();
  
  if (!user_id || !organization_id) {
    return res.status(400).json({ 
      message: "Missing user_id or org_id",
      example: "/v1/dev/whoami?user_id=<uuid>&org_id=<uuid>"
    });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, email, organization_id, role, archived_at")
      .eq("id", user_id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ 
        message: "User not found",
        user_id,
        organization_id
      });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        organization_id: user.organization_id,
        role: user.role,
        archived: !!user.archived_at
      },
      note: "This bypasses auth middleware. Use real tokens for production testing."
    });

  } catch (error: any) {
    return res.status(500).json({ 
      message: "Internal error",
      error: error.message 
    });
  }
});

export default router;
