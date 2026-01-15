"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ✅ BOOT MARKER - This MUST print if new code is running
console.log("[BOOT] COMMIT MARKER: c638206 / 2D92D8D-LAZY-ADMIN-v3");
// Load dotenv only in development (Railway injects env vars in production)
// This makes the server boot even if dotenv isn't installed in production
if (process.env.NODE_ENV !== "production") {
    try {
        require("dotenv/config");
    }
    catch {
        // dotenv not available, continue without it (Railway injects env vars)
    }
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const stripeWebhook_1 = require("./routes/stripeWebhook");
const risk_1 = require("./routes/risk");
const subscriptions_1 = require("./routes/subscriptions");
const jobs_1 = require("./routes/jobs");
const reports_1 = require("./routes/reports");
const analytics_1 = require("./routes/analytics");
const legal_1 = require("./routes/legal");
const notifications_1 = require("./routes/notifications");
const team_1 = require("./routes/team");
const account_1 = require("./routes/account");
const sites_1 = require("./routes/sites");
const audit_1 = require("./routes/audit");
const executive_1 = require("./routes/executive");
const requestId_1 = require("./middleware/requestId");
const errorResponse_1 = require("./utils/errorResponse");
const app = (0, express_1.default)();
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
// Version endpoint - confirms which code is actually running
app.get("/__version", (_req, res) => {
    res.json({
        commit: process.env.RAILWAY_GIT_COMMIT_SHA || "dev",
        deploy: process.env.RAILWAY_DEPLOYMENT_ID || "local",
        marker: "c638206 / 2D92D8D-LAZY-ADMIN-v3",
        cors_config: {
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
            exposedHeaders: ['Content-Disposition', 'X-Error-ID', 'X-Request-ID'],
        },
    });
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
// iOS apps don't send Origin header, so missing origin = allowed (mobile client)
const isAllowedOrigin = (origin) => {
    if (!origin)
        return true; // server-to-server / curl / iOS apps (no Origin header)
    if (allowedOriginsSet.has(origin))
        return true;
    const isDev = process.env.NODE_ENV !== "production";
    return isDev && origin.startsWith("http://localhost");
};
// CORS config (shared for both app.use and app.options)
const corsConfig = {
    origin: (origin, cb) => {
        // Never pass Error to callback - just return true/false
        if (!origin)
            return cb(null, true); // server-to-server / curl
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
app.use((0, cors_1.default)(corsConfig));
// ✅ IMPORTANT: Handle preflight OPTIONS requests for ALL routes
// This must come after app.use(cors) but before route handlers
app.options('*', (0, cors_1.default)(corsConfig));
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
app.use(requestId_1.requestIdMiddleware);
app.post("/api/stripe/webhook", express_1.default.raw({ type: "application/json" }), stripeWebhook_1.stripeWebhookHandler);
app.use(express_1.default.json());
// API Routes
app.use("/api/risk", risk_1.riskRouter);
app.use("/api/subscriptions", subscriptions_1.subscriptionsRouter);
app.use("/api/jobs", jobs_1.jobsRouter);
app.use("/api/reports", reports_1.reportsRouter);
app.use("/api/analytics", analytics_1.analyticsRouter);
app.use("/api/legal", legal_1.legalRouter);
app.use("/api/notifications", notifications_1.notificationsRouter);
app.use("/api/team", team_1.teamRouter);
app.use("/api/account", account_1.accountRouter);
app.use("/api/sites", sites_1.sitesRouter);
app.use("/api/audit", audit_1.auditRouter);
app.use("/api/executive", executive_1.executiveRouter);
// 404 handler
// CORS headers are already set by cors() middleware, so this response will include them
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});
// Error handler
// CORS headers are already set by cors() middleware, so all error responses will include them
app.use((err, req, res, next) => {
    const requestId = req.requestId || 'unknown';
    const statusCode = err.status || 500;
    const organizationId = req.user?.organization_id;
    const code = err.code || (statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "UNKNOWN_ERROR");
    const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
        message: err.message || "Internal server error",
        internalMessage: err.stack || err.toString(),
        code,
        requestId,
        statusCode,
    });
    // Set error ID in response header
    res.setHeader('X-Error-ID', errorId);
    // Structured logging for support console (4xx/5xx)
    (0, errorResponse_1.logErrorForSupport)(statusCode, code, requestId, organizationId, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, req.path);
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
//# sourceMappingURL=index.js.map