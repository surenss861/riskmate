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

import express from "express";
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
import { requestIdMiddleware, RequestWithId } from "./middleware/requestId";
import { createErrorResponse, logErrorForSupport } from "./utils/errorResponse";

const app = express();

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

// Production allowed origins (from env var, comma-separated)
const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// In development, allow localhost for local testing
const defaultAllowedOrigins = process.env.NODE_ENV === "production" 
  ? [] 
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3003",
      "http://localhost:5173",
    ];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));
const allowedOriginsSet = new Set(allowedOrigins);

// Helper to check if origin is allowed (never throws)
const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // server-to-server / curl without Origin
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

// API Routes
app.use("/api/risk", riskRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/legal", legalRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/team", teamRouter);
app.use("/api/account", accountRouter);
app.use("/api/sites", sitesRouter);
app.use("/api/audit", auditRouter);
app.use("/api/executive", executiveRouter);

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOOT] Listening on 0.0.0.0:${PORT} (raw PORT=${process.env.PORT})`);
  console.log(`🚀 RiskMate Backend API running on port ${PORT}`);
  console.log(`📡 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Build: ${process.env.RAILWAY_DEPLOYMENT_ID || 'local'} | Commit: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'dev'}`);
});

