// ✅ BOOT MARKER - This MUST print if new code is running
console.log("[BOOT] COMMIT MARKER: c638206 / 2D92D8D-LAZY-ADMIN-v3");

// Load dotenv only in development (Railway injects env vars in production)
// This makes the server boot even if dotenv isn't installed in production
if (process.env.NODE_ENV !== "production") {
  try {
    require("dotenv/config");
  } catch {
    // dotenv not available, continue without it (Railway injects env vars)
  }
}

import express, { type Express } from "express";
import cors from "cors";
import { stripeWebhookHandler } from "./routes/stripeWebhook";
import { riskRouter } from "./routes/risk";
import { subscriptionsRouter } from "./routes/subscriptions";
import { jobsRouter } from "./routes/jobs";
import { reportsRouter } from "./routes/reports";
import { analyticsRouter } from "./routes/analytics";
import { legalRouter } from "./routes/legal";
import { notificationsRouter } from "./routes/notifications";
import { teamRouter } from "./routes/team";
import { accountRouter } from "./routes/account";
import { sitesRouter } from "./routes/sites";
import { auditRouter } from "./routes/audit";
import { executiveRouter } from "./routes/executive";
import { evidenceRouter } from "./routes/evidence";
import { syncRouter } from "./routes/sync";
import { exportsRouter } from "./routes/exports";
import { verificationRouter } from "./routes/verification";
import { publicVerificationRouter } from "./routes/publicVerification";
import { metricsRouter } from "./routes/metrics";
import { dashboardRouter } from "./routes/dashboard";
import { startExportWorker } from "./services/exportWorker";
import { startRetentionWorker } from "./services/retentionWorker";
import { startLedgerRootWorker } from "./services/ledgerRootWorker";
import { requestIdMiddleware, RequestWithId } from "./middleware/requestId";
import { createErrorResponse, logErrorForSupport } from "./utils/errorResponse";
import { authenticate } from "./middleware/auth";
import devAuthRouter from "./routes/devAuth";

const app: Express = express();

// ✅ Debug: Log Railway's injected port
console.log("[BOOT] raw PORT =", JSON.stringify(process.env.PORT));
console.log("[BOOT] raw HOST =", JSON.stringify(process.env.HOST));

const PORT = Number(process.env.PORT);
if (!Number.isFinite(PORT)) {
  throw new Error(`[BOOT] PORT is missing/invalid. Got: ${JSON.stringify(process.env.PORT)}`);
}

// Health check route - MUST be first (no Supabase dependency)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes debug endpoint - lists all registered routes
app.get("/__routes", (_req, res) => {
  const routes: string[] = [];

  function walk(stack: any[], prefix = "") {
    for (const layer of stack) {
      if (layer.route?.path) {
        const methods = Object.keys(layer.route.methods)
          .filter(Boolean)
          .map((m: string) => m.toUpperCase())
          .join(",");
        routes.push(`${methods} ${prefix}${layer.route.path}`);
      } else if (layer.name === "router" && layer.handle?.stack) {
        const routerPath = layer.regexp?.source
          ?.replace(/\\\/\^|\$\\\/|\?\(\?\$\/\)\?|\\\/\(\?\:|\$|\\\//g, "")
          .replace(/\\(\w+)/g, ":$1")
          .replace(/\(\?\<\w+\>/g, "")
          .replace(/\?/g, "") || "";
        walk(layer.handle.stack, prefix + routerPath);
      }
    }
  }

  // @ts-ignore - accessing internal Express router
  if (app._router && app._router.stack) {
    walk(app._router.stack, "");
  }

  // Filter and sort
  const filteredRoutes = routes
    .filter((r) => r.includes("hazards") || r.includes("controls") || r.includes("jobs"))
    .sort();

  res.json({
    count: routes.length,
    jobsRoutes: filteredRoutes,
    allRoutes: routes.sort(),
  });
});

// Version endpoint - confirms which code is actually running (matches /v1/health format)
app.get("/__version", async (_req, res) => {
  try {
    // Determine environment (same logic as /v1/health)
    const railwayEnv = process.env.RAILWAY_ENVIRONMENT;
    const nodeEnv = process.env.NODE_ENV;
    const hasRailwayDeployment = !!process.env.RAILWAY_DEPLOYMENT_ID;
    
    let environment = "development";
    if (railwayEnv) {
      environment = railwayEnv;
    } else if (nodeEnv === "production") {
      environment = "production";
    } else if (hasRailwayDeployment) {
      environment = "production";
    } else if (nodeEnv) {
      environment = nodeEnv;
    }

    // Try to check DB connectivity (optional)
    let dbStatus = "unknown";
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
      );
      const { error } = await supabase.from("organizations").select("id").limit(1);
      dbStatus = error ? "error" : "ok";
    } catch {
      dbStatus = "error";
    }

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "dev",
      service: "riskmate-api",
      version: process.env.npm_package_version || "0.1.0",
      environment: environment,
      deployment: process.env.RAILWAY_DEPLOYMENT_ID || "local",
      db: dbStatus,
      marker: "c638206 / 2D92D8D-LAZY-ADMIN-v3",
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Create v1 router to wrap all API routes
const v1Router = express.Router();

// v1 health endpoint with build metadata (contract check)
v1Router.get("/health", async (_req, res) => {
  try {
    // Try to ping Supabase to check DB connectivity (optional)
    let dbStatus = "unknown";
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
      );
      // Simple query to check DB
      const { error } = await supabase.from("organizations").select("id").limit(1);
      dbStatus = error ? "error" : "ok";
    } catch {
      dbStatus = "error";
    }

    // Determine environment: Railway sets RAILWAY_ENVIRONMENT, or use NODE_ENV, or infer from Railway presence
    const railwayEnv = process.env.RAILWAY_ENVIRONMENT;
    const nodeEnv = process.env.NODE_ENV;
    const hasRailwayDeployment = !!process.env.RAILWAY_DEPLOYMENT_ID;
    
    let environment = "development";
    if (railwayEnv) {
      environment = railwayEnv; // Railway sets this to "production" in prod
    } else if (nodeEnv === "production") {
      environment = "production";
    } else if (hasRailwayDeployment) {
      // If we have Railway deployment ID but no explicit env, assume production
      environment = "production";
    } else if (nodeEnv) {
      environment = nodeEnv;
    }

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "dev",
      service: "riskmate-api",
      version: process.env.npm_package_version || "0.1.0",
      environment: environment,
      deployment: process.env.RAILWAY_DEPLOYMENT_ID || "local",
      db: dbStatus,
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Top-level /v1/me endpoint (delegates to account router)
// This provides a cleaner API surface: /v1/me instead of /v1/account/me
v1Router.get("/me", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user?.id;
    const organizationId = (req as any).user?.organization_id;
    const email = (req as any).user?.email;
    const role = (req as any).user?.role;
    
    if (!userId || !organizationId) {
      return res.status(401).json({ 
        message: "Unauthorized",
        code: "AUTH_UNAUTHORIZED"
      });
    }

    res.json({
      data: {
        id: userId,
        email: email,
        organization_id: organizationId,
        role: role,
      },
    });
  } catch (err: any) {
    console.error("Me endpoint error:", err);
    res.status(500).json({ 
      message: "Internal server error",
      code: "INTERNAL_ERROR"
    });
  }
});

// Production allowed origins (from env var, comma-separated)
const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Default allowed origins
// Production: include www.riskmate.dev and riskmate.dev
// Development: include localhost ports
const defaultAllowedOrigins = process.env.NODE_ENV === "production" 
  ? [
      "https://www.riskmate.dev",
      "https://riskmate.dev",
    ]
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3003",
      "http://localhost:5173",
    ];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));
const allowedOriginsSet = new Set(allowedOrigins);

// Helper to check if origin is allowed (never throws)
// iOS apps don't send Origin header, so missing origin = allowed (mobile client)
const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // server-to-server / curl / iOS apps (no Origin header)
  if (allowedOriginsSet.has(origin)) return true;
  const isDev = process.env.NODE_ENV !== "production";
  return isDev && origin.startsWith("http://localhost");
};

// CORS config (shared for both app.use and app.options)
const corsConfig: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Never pass Error to callback - just return true/false
    if (!origin) return cb(null, true); // server-to-server / curl
    return cb(null, isAllowedOrigin(origin)); // false = no CORS header, but NO throw
  },
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
  exposedHeaders: ['Content-Disposition', 'X-Error-ID', 'X-Request-ID'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
};

// ✅ CORS middleware MUST run first (before any blocking or routes)
// This ensures CORS headers are set on ALL responses, including errors
app.use(cors(corsConfig));

// ✅ IMPORTANT: Handle preflight OPTIONS requests for ALL routes
// This must come after app.use(cors) but before route handlers
app.options('*', cors(corsConfig));

// Post-CORS middleware: block invalid origins with 403 (AFTER CORS headers are set)
// This ensures even blocked requests return CORS headers (so browser shows real error, not CORS error)
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Non-browser requests (no Origin header) should pass
  if (!origin) {
    return next();
  }

  // Check if origin is in allowlist
  if (!isAllowedOrigin(origin)) {
    console.warn(`[CORS] Rejected origin: ${origin}`);
    // CORS headers are already set by cors() middleware above
    // This ensures browser sees the real 403 error, not a CORS error
    return res.status(403).json({
      message: "Not allowed by CORS",
      code: "CORS_FORBIDDEN",
    });
  }

  return next();
});

app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

// Request ID middleware (must be early in the chain)
app.use(requestIdMiddleware);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json());

// API Routes (keep /api/* for backward compatibility)
app.use("/api/risk", riskRouter);
app.use("/api/subscriptions", subscriptionsRouter);
console.log("[ROUTES] ✅ Jobs router mounted at /api/jobs");
app.use("/api/jobs", jobsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/legal", legalRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/team", teamRouter);
app.use("/api/account", accountRouter);
app.use("/api/sites", sitesRouter);
app.use("/api/audit", auditRouter);
console.log("[ROUTES] ✅ Audit router mounted at /api/audit");
app.use("/api/executive", executiveRouter);
app.use("/api/sync", syncRouter);
app.use("/api", evidenceRouter);
app.use("/api", exportsRouter);
app.use("/api", verificationRouter);
app.use("/api/public", publicVerificationRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/dashboard", dashboardRouter);

// Mount all /api routes under /v1 as well (versioned API)
v1Router.use("/risk", riskRouter);
v1Router.use("/subscriptions", subscriptionsRouter);
v1Router.use("/jobs", jobsRouter);
v1Router.use("/reports", reportsRouter);
v1Router.use("/analytics", analyticsRouter);
v1Router.use("/legal", legalRouter);
v1Router.use("/notifications", notificationsRouter);
v1Router.use("/team", teamRouter);
v1Router.use("/account", accountRouter);
v1Router.use("/sites", sitesRouter);
v1Router.use("/audit", auditRouter);
v1Router.use("/executive", executiveRouter);
v1Router.use("/sync", syncRouter);
v1Router.use("/", evidenceRouter);
v1Router.use("/", exportsRouter);
v1Router.use("/", verificationRouter);
v1Router.use("/public", publicVerificationRouter);
v1Router.use("/metrics", metricsRouter);
v1Router.use("/dashboard", dashboardRouter);

// Dev endpoints (only available when DEV_AUTH_SECRET is set)
// MUST be mounted BEFORE app.use("/v1", v1Router) to ensure Express registers it
if (process.env.DEV_AUTH_SECRET) {
  v1Router.use("/dev", devAuthRouter);
  console.log("[BOOT] ✅ Dev auth endpoints enabled at /v1/dev/*");
} else {
  console.log("[BOOT] ⚠️ Dev auth endpoints disabled (DEV_AUTH_SECRET not set)");
}

// Mount v1 router (after all routes are added to v1Router)
app.use("/v1", v1Router);

// 404 handler
// CORS headers are already set by cors() middleware, so this response will include them
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
// CORS headers are already set by cors() middleware, so all error responses will include them
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = (req as RequestWithId).requestId || 'unknown';
  const statusCode = err.status || 500;
  const organizationId = (req as any).user?.organization_id;
  const code = err.code || (statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "UNKNOWN_ERROR");
  
  const { response: errorResponse, errorId } = createErrorResponse({
    message: err.message || "Internal server error",
    internalMessage: err.stack || err.toString(),
    code,
    requestId,
    statusCode,
  });
  
  // Set error ID in response header
  res.setHeader('X-Error-ID', errorId);
  
  // Structured logging for support console (4xx/5xx)
  logErrorForSupport(
    statusCode,
    code,
    requestId,
    organizationId,
    errorResponse.message,
    errorResponse.internal_message,
    errorResponse.category,
    errorResponse.severity,
    req.path
  );
  
  console.error("Error:", err);
  
  // CORS headers are already set by cors() middleware above
  // This ensures 401/403/500 errors all include CORS headers
  res.status(statusCode).json(errorResponse);
});

// Export app for testing
export default app;

// Only start server if not in test mode
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BOOT] Listening on 0.0.0.0:${PORT} (raw PORT=${process.env.PORT})`);
    console.log(`🚀 Riskmate Backend API running on port ${PORT}`);
    console.log(`📡 Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`✅ Build: ${process.env.RAILWAY_DEPLOYMENT_ID || 'local'} | Commit: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'dev'}`);
    
    // Start background workers
    startExportWorker();
    startRetentionWorker();
    startLedgerRootWorker();
  });
}

