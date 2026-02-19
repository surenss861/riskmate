"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const evidence_1 = require("./routes/evidence");
const sync_1 = require("./routes/sync");
const exports_1 = require("./routes/exports");
const verification_1 = require("./routes/verification");
const publicVerification_1 = require("./routes/publicVerification");
const metrics_1 = require("./routes/metrics");
const dashboard_1 = require("./routes/dashboard");
const comments_1 = require("./routes/comments");
const exportWorker_1 = require("./services/exportWorker");
const retentionWorker_1 = require("./services/retentionWorker");
const ledgerRootWorker_1 = require("./services/ledgerRootWorker");
const emailQueue_1 = require("./workers/emailQueue");
const weeklyDigest_1 = require("./workers/weeklyDigest");
const deadlineReminders_1 = require("./workers/deadlineReminders");
const taskReminders_1 = require("./workers/taskReminders");
const requestId_1 = require("./middleware/requestId");
const errorResponse_1 = require("./utils/errorResponse");
const auth_1 = require("./middleware/auth");
const devAuth_1 = __importDefault(require("./routes/devAuth"));
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
// Routes debug endpoint - lists all registered routes
app.get("/__routes", (_req, res) => {
    const routes = [];
    function walk(stack, prefix = "") {
        for (const layer of stack) {
            if (layer.route?.path) {
                const methods = Object.keys(layer.route.methods)
                    .filter(Boolean)
                    .map((m) => m.toUpperCase())
                    .join(",");
                routes.push(`${methods} ${prefix}${layer.route.path}`);
            }
            else if (layer.name === "router" && layer.handle?.stack) {
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
        }
        else if (nodeEnv === "production") {
            environment = "production";
        }
        else if (hasRailwayDeployment) {
            environment = "production";
        }
        else if (nodeEnv) {
            environment = nodeEnv;
        }
        // Try to check DB connectivity (optional)
        let dbStatus = "unknown";
        try {
            const { createClient } = await Promise.resolve().then(() => __importStar(require("@supabase/supabase-js")));
            const supabase = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");
            const { error } = await supabase.from("organizations").select("id").limit(1);
            dbStatus = error ? "error" : "ok";
        }
        catch {
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
    }
    catch (error) {
        res.status(500).json({
            status: "error",
            timestamp: new Date().toISOString(),
            error: error.message,
        });
    }
});
// Create v1 router to wrap all API routes
const v1Router = express_1.default.Router();
// v1 health endpoint with build metadata (contract check)
v1Router.get("/health", async (_req, res) => {
    try {
        // Try to ping Supabase to check DB connectivity (optional)
        let dbStatus = "unknown";
        try {
            const { createClient } = await Promise.resolve().then(() => __importStar(require("@supabase/supabase-js")));
            const supabase = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");
            // Simple query to check DB
            const { error } = await supabase.from("organizations").select("id").limit(1);
            dbStatus = error ? "error" : "ok";
        }
        catch {
            dbStatus = "error";
        }
        // Determine environment: Railway sets RAILWAY_ENVIRONMENT, or use NODE_ENV, or infer from Railway presence
        const railwayEnv = process.env.RAILWAY_ENVIRONMENT;
        const nodeEnv = process.env.NODE_ENV;
        const hasRailwayDeployment = !!process.env.RAILWAY_DEPLOYMENT_ID;
        let environment = "development";
        if (railwayEnv) {
            environment = railwayEnv; // Railway sets this to "production" in prod
        }
        else if (nodeEnv === "production") {
            environment = "production";
        }
        else if (hasRailwayDeployment) {
            // If we have Railway deployment ID but no explicit env, assume production
            environment = "production";
        }
        else if (nodeEnv) {
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
    }
    catch (error) {
        res.status(500).json({
            status: "error",
            timestamp: new Date().toISOString(),
            error: error.message,
        });
    }
});
// Top-level /v1/me endpoint (delegates to account router)
// This provides a cleaner API surface: /v1/me instead of /v1/account/me
v1Router.get("/me", auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organization_id;
        const email = req.user?.email;
        const role = req.user?.role;
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
    }
    catch (err) {
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
// API Routes (keep /api/* for backward compatibility)
app.use("/api/risk", risk_1.riskRouter);
app.use("/api/subscriptions", subscriptions_1.subscriptionsRouter);
console.log("[ROUTES] ✅ Jobs router mounted at /api/jobs");
app.use("/api/jobs", jobs_1.jobsRouter);
app.use("/api/reports", reports_1.reportsRouter);
app.use("/api/analytics", analytics_1.analyticsRouter);
app.use("/api/legal", legal_1.legalRouter);
app.use("/api/notifications", notifications_1.notificationsRouter);
app.use("/api/team", team_1.teamRouter);
app.use("/api/account", account_1.accountRouter);
app.use("/api/sites", sites_1.sitesRouter);
app.use("/api/audit", audit_1.auditRouter);
console.log("[ROUTES] ✅ Audit router mounted at /api/audit");
app.use("/api/executive", executive_1.executiveRouter);
app.use("/api/sync", sync_1.syncRouter);
app.use("/api", evidence_1.evidenceRouter);
app.use("/api", exports_1.exportsRouter);
app.use("/api", verification_1.verificationRouter);
app.use("/api/public", publicVerification_1.publicVerificationRouter);
app.use("/api/metrics", metrics_1.metricsRouter);
app.use("/api/dashboard", dashboard_1.dashboardRouter);
app.use("/api/comments", comments_1.commentsRouter);
// Mount all /api routes under /v1 as well (versioned API)
v1Router.use("/risk", risk_1.riskRouter);
v1Router.use("/subscriptions", subscriptions_1.subscriptionsRouter);
v1Router.use("/jobs", jobs_1.jobsRouter);
v1Router.use("/reports", reports_1.reportsRouter);
v1Router.use("/analytics", analytics_1.analyticsRouter);
v1Router.use("/legal", legal_1.legalRouter);
v1Router.use("/notifications", notifications_1.notificationsRouter);
v1Router.use("/team", team_1.teamRouter);
v1Router.use("/account", account_1.accountRouter);
v1Router.use("/sites", sites_1.sitesRouter);
v1Router.use("/audit", audit_1.auditRouter);
v1Router.use("/executive", executive_1.executiveRouter);
v1Router.use("/sync", sync_1.syncRouter);
v1Router.use("/", evidence_1.evidenceRouter);
v1Router.use("/", exports_1.exportsRouter);
v1Router.use("/", verification_1.verificationRouter);
v1Router.use("/public", publicVerification_1.publicVerificationRouter);
v1Router.use("/metrics", metrics_1.metricsRouter);
v1Router.use("/dashboard", dashboard_1.dashboardRouter);
v1Router.use("/comments", comments_1.commentsRouter);
// Dev endpoints (only available when DEV_AUTH_SECRET is set)
// MUST be mounted BEFORE app.use("/v1", v1Router) to ensure Express registers it
if (process.env.DEV_AUTH_SECRET) {
    v1Router.use("/dev", devAuth_1.default);
    console.log("[BOOT] ✅ Dev auth endpoints enabled at /v1/dev/*");
}
else {
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
// Export app for testing
exports.default = app;
// Only start server if not in test mode
if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[BOOT] Listening on 0.0.0.0:${PORT} (raw PORT=${process.env.PORT})`);
        console.log(`🚀 Riskmate Backend API running on port ${PORT}`);
        console.log(`📡 Health check: http://0.0.0.0:${PORT}/health`);
        console.log(`✅ Build: ${process.env.RAILWAY_DEPLOYMENT_ID || 'local'} | Commit: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'dev'}`);
        // Start background workers
        (0, exportWorker_1.startExportWorker)();
        (0, retentionWorker_1.startRetentionWorker)();
        (0, ledgerRootWorker_1.startLedgerRootWorker)();
        (0, emailQueue_1.startEmailQueueWorker)();
        (0, weeklyDigest_1.startWeeklyDigestWorker)();
        (0, deadlineReminders_1.startDeadlineReminderWorker)();
        (0, taskReminders_1.startTaskReminderWorker)();
    });
}
//# sourceMappingURL=index.js.map