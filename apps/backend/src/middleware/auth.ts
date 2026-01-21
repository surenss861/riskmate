import { Request, Response, NextFunction, type RequestHandler } from "express";
import { getSupabaseAuth } from "../lib/supabaseAuthClient";
import { supabase } from "../lib/supabaseClient";
import { LEGAL_VERSION } from "../utils/legal";
import { limitsFor, PlanCode } from "../auth/planRules";

export interface AuthenticatedUser {
    id: string;
    organization_id: string;
    email?: string;
    role?: string;
  mustResetPassword: boolean;
  plan: PlanCode;
  seatsLimit: number | null;
  jobsMonthlyLimit: number | null;
  features: string[];
  subscriptionStatus: string;
    legalAccepted: boolean;
    legalAcceptedAt?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

async function loadPlanForOrganization(organizationId: string) {
  const { data } = await supabase
    .from("org_subscriptions")
    .select("plan_code, seats_limit, jobs_limit_month")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data?.plan_code) {
    return {
      planCode: "starter" as PlanCode,
      status: "none",
      seatsLimit: 0,
      jobsMonthlyLimit: 0,
      features: [],
    };
  }

  const planCode = data.plan_code as PlanCode;
  const limits = limitsFor(planCode);
  // Default to active if status column doesn't exist yet
  const status = "active";
  const isActive = true;

  return {
    planCode,
    status,
    seatsLimit: isActive ? data.seats_limit ?? limits.seats ?? null : 0,
    jobsMonthlyLimit: isActive ? data.jobs_limit_month ?? limits.jobsMonthly ?? null : 0,
    features: isActive ? limits.features : [],
  };
}

// Helper to check if a string looks like a JWT (3 dot-separated parts)
function isProbablyJwt(token: string): boolean {
  return token.split(".").length === 3;
}

/**
 * Internal authenticate function with typed request
 */
async function authenticateInternal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // ✅ IMPORTANT: Skip auth for OPTIONS preflight requests
  // CORS middleware handles OPTIONS, but this prevents 401 errors
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Skip auth logging for health/version endpoints (they don't require auth)
  const isHealthEndpoint = req.path === '/health' || req.path === '/v1/health' || req.path === '/__version';
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized - No token provided" });
      return;
    }

    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) {
      res.status(401).json({ message: "Unauthorized - Invalid token format" });
      return;
    }

    // ✅ Fast fail for obviously invalid tokens (not JWT format)
    // This prevents garbage tokens like "not-a-real-token" from ever hitting Supabase
    if (!isProbablyJwt(token)) {
      // Only log JWT format errors for protected routes (not health/version endpoints)
      if (!isHealthEndpoint) {
        console.warn("[AUTH] Token failed JWT format check:", token.substring(0, 20) + "...");
      }
      res.status(401).json({ message: "Unauthorized - Invalid token format" });
      return;
    }

    // Use anon client for auth validation (not service role - more resilient)
    // Wrap getUser in try-catch to handle exceptions
    // This can fail if: (1) token is invalid → 401, (2) Supabase client init failed → 500
    let authData: any;
    let authError: any;
    try {
      const authClient = getSupabaseAuth();
      const result = await authClient.auth.getUser(token);
      authData = result.data;
      authError = result.error;
    } catch (getUserError: any) {
      // Check if this is an env/config error (Supabase client couldn't initialize)
      const errorMsg = getUserError?.message || String(getUserError || "");
      if (errorMsg.includes("[env]") || errorMsg.includes("SUPABASE_URL") || errorMsg.includes("Invalid supabase") || errorMsg.includes("Missing")) {
        console.error("[AUTH] Supabase auth client init failed in getUser:", errorMsg);
        res.status(500).json({ 
          message: "Backend configuration error",
          code: "BACKEND_CONFIG_ERROR",
          hint: "Server environment variables are misconfigured. Please contact support."
        });
        return;
      }
      // Otherwise, it's an invalid token - treat as 401
      console.warn("[AUTH] getUser exception (invalid token):", errorMsg);
      res.status(401).json({ message: "Unauthorized - Invalid token" });
      return;
    }

    if (authError || !authData?.user) {
      res.status(401).json({ message: "Unauthorized - Invalid token" });
      return;
    }

    const userId = authData.user.id;

    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("id, organization_id, email, role, archived_at, must_reset_password")
      .eq("id", userId)
      .maybeSingle();

    // Handle missing user record gracefully (return 403, not 500)
    if (userError) {
      console.error("[AUTH] Database error fetching user:", userError);
      res.status(500).json({ 
        message: "Internal server error",
        code: "DATABASE_ERROR",
        hint: "Failed to fetch user record from database"
      });
      return;
    }

    if (!userRecord) {
      // User exists in Supabase Auth but not in public.users table
      // This is a provisioning issue, not an auth failure
      res.status(403).json({ 
        message: "Account not provisioned",
        code: "USER_NOT_PROVISIONED",
        hint: "User account exists but has not been fully set up. Please contact support."
      });
      return;
    }

    if (!userRecord.organization_id) {
      // User exists but has no organization_id
      res.status(403).json({ 
        message: "No organization assigned",
        code: "NO_ORGANIZATION",
        hint: "User account is missing organization assignment. Please contact support."
      });
      return;
    }

    if (userRecord.archived_at) {
      res.status(403).json({ message: "Account disabled" });
      return;
    }

    const organizationId = userRecord.organization_id;
    const email = userRecord.email ?? authData.user.email ?? undefined;
    const role = userRecord.role ?? undefined;
    const mustResetPassword = Boolean(userRecord.must_reset_password);

    const planInfo = await loadPlanForOrganization(organizationId);
    const planCode: PlanCode = planInfo.planCode;
    const seatsLimit = planInfo.seatsLimit;
    const jobsMonthlyLimit = planInfo.jobsMonthlyLimit;
    const features = planInfo.features;
    const subscriptionStatus = planInfo.status;

    const { data: legalAcceptance } = await supabase
      .from("legal_acceptances")
      .select("accepted_at")
      .eq("user_id", userId)
      .eq("version", LEGAL_VERSION)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const legalAccepted = Boolean(legalAcceptance?.accepted_at);

    const path = req.originalUrl || req.url;
    if (!legalAccepted && !path.startsWith("/api/legal")) {
      res.status(428).json({
        message: "Legal terms not accepted",
        code: "LEGAL_ACCEPTANCE_REQUIRED",
        version: LEGAL_VERSION,
      });
      return;
    }

    req.user = {
      id: userId,
      organization_id: organizationId,
      email,
      role,
      mustResetPassword,
      plan: planCode,
      seatsLimit,
      jobsMonthlyLimit,
      features,
      subscriptionStatus,
      legalAccepted,
      legalAcceptedAt: legalAcceptance?.accepted_at ?? null,
    };

    next();
  } catch (err: any) {
    // ✅ DEBUG MARKER v2 - This confirms new code is running
    console.error("[AUTH] marker v2 - classify errors", err?.message || String(err || ""));
    console.error("[AUTH] error type:", typeof err);
    console.error("[AUTH] error keys:", Object.keys(err || {}));
    
    // Check for environment configuration errors (should be 500, not 401)
    const errorMessage = err?.message || String(err || "");
    const errorString = JSON.stringify(err || {});
    
    // Check multiple patterns for env errors
    const isEnvError = 
      errorMessage.includes("[env]") || 
      errorMessage.includes("SUPABASE_URL") || 
      errorMessage.includes("Missing") || 
      errorMessage.includes("Invalid supabaseUrl") ||
      errorMessage.includes("Invalid supabase") ||
      errorString.includes("SUPABASE_URL") ||
      errorString.includes("your_supabase_project_url");
    
    if (isEnvError) {
      console.error("[AUTH] Detected env config error, returning 500");
      res.status(500).json({ 
        message: "Backend configuration error",
        code: "BACKEND_CONFIG_ERROR",
        hint: "Server environment variables are misconfigured. Please contact support."
      });
      return;
    }
    
    // If it's a known auth-related error (token validation), return 401
    const isAuthError = 
      errorMessage.includes("token") || 
      errorMessage.includes("Unauthorized") || 
      errorMessage.includes("Invalid token") ||
      errorMessage.includes("JWT") ||
      errorMessage.includes("jwt");
    
    if (isAuthError) {
      console.error("[AUTH] Detected auth/token error, returning 401");
      res.status(401).json({ message: "Unauthorized - Invalid token" });
      return;
    }
    
    // Otherwise, it's a real server error
    console.error("[AUTH] Unknown error type, returning 500");
    res.status(500).json({ 
      message: "Internal server error",
      code: "INTERNAL_ERROR"
    });
    return;
  }
}

/**
 * Express RequestHandler wrapper for authenticate middleware
 * Properly typed to avoid 'as unknown as RequestHandler' casts
 */
export const authenticate: RequestHandler = (req, res, next) => {
  return authenticateInternal(req as AuthenticatedRequest, res, next);
};

