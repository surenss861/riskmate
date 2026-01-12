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

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3003",
  "http://localhost:5173",
];

const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

const isAllowedOrigin = (origin?: string) => {
  // Allow requests with no origin (server-to-server, like Next.js API routes)
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }
    // Allow Vercel domains
    if (hostname.includes("vercel.app") || hostname.includes("vercel.com")) {
      return true;
    }
  } catch (error) {
    console.warn(`Invalid origin received from request: ${origin}`, error);
  }

  return false;
};

// Middleware
const corsOptions: cors.CorsOptionsDelegate = (req, callback) => {
  const origin = req.headers.origin || undefined;

  if (isAllowedOrigin(origin)) {
    const options: cors.CorsOptions = {
      origin: origin ?? true, // Allow all origins if no origin (server-to-server)
      credentials: true,
      optionsSuccessStatus: 200,
      // Allow common headers used by Next.js API routes
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    };
    callback(null, options);
  } else {
    // Log the rejected origin for debugging
    console.warn(`CORS rejected origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  }
};

app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

// Request ID middleware (must be early in the chain)
app.use(requestIdMiddleware);

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = (req as RequestWithId).requestId || 'unknown';
  const statusCode = err.status || 500;
  const organizationId = (req as any).user?.organization_id;
  const code = err.code || (statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "UNKNOWN_ERROR");
  
  // Use error response utility for consistent formatting
  const { createErrorResponse, logErrorForSupport } = require("./utils/errorResponse");
  
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
  
  res.status(statusCode).json(errorResponse);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOOT] Listening on 0.0.0.0:${PORT} (raw PORT=${process.env.PORT})`);
  console.log(`🚀 RiskMate Backend API running on port ${PORT}`);
  console.log(`📡 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Build: ${process.env.RAILWAY_DEPLOYMENT_ID || 'local'} | Commit: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'dev'}`);
});

