"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
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
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5173;
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
const isAllowedOrigin = (origin) => {
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
    }
    catch (error) {
        console.warn(`Invalid origin received from request: ${origin}`, error);
    }
    return false;
};
// Middleware
const corsOptions = (req, callback) => {
    const origin = req.headers.origin || undefined;
    if (isAllowedOrigin(origin)) {
        const options = {
            origin: origin ?? true,
            credentials: true,
            optionsSuccessStatus: 200,
        };
        callback(null, options);
    }
    else {
        callback(new Error("Not allowed by CORS"));
    }
};
app.use((req, res, next) => {
    res.header("Vary", "Origin");
    next();
});
app.use((0, cors_1.default)(corsOptions));
app.options("*", (0, cors_1.default)(corsOptions));
app.post("/api/stripe/webhook", express_1.default.raw({ type: "application/json" }), stripeWebhook_1.stripeWebhookHandler);
app.use(express_1.default.json());
// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// API Routes
app.use("/api/risk", risk_1.riskRouter);
app.use("/api/subscriptions", subscriptions_1.subscriptionsRouter);
app.use("/api/jobs", jobs_1.jobsRouter);
app.use("/api/reports", reports_1.reportsRouter);
app.use("/api/analytics", analytics_1.analyticsRouter);
app.use("/api/legal", legal_1.legalRouter);
app.use("/api/notifications", notifications_1.notificationsRouter);
app.use("/api/team", team_1.teamRouter);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});
// Error handler
app.use((err, req, res, next) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({
        message: err.message || "Internal server error",
    });
});
app.listen(PORT, () => {
    console.log(`🚀 RiskMate Backend API running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
});
//# sourceMappingURL=index.js.map