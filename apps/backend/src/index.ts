import "dotenv/config";
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

const app = express();
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

const isAllowedOrigin = (origin?: string) => {
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
  } catch (error) {
    console.warn(`Invalid origin received from request: ${origin}`, error);
  }

  return false;
};

// Middleware
const corsOptions: cors.CorsOptionsDelegate = (req, callback) => {
  const origin = req.header("Origin") || undefined;

  if (isAllowedOrigin(origin)) {
    const options: cors.CorsOptions = {
      origin: origin ?? true,
      credentials: true,
      optionsSuccessStatus: 200,
    };
    callback(null, options);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
};

app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 RiskMate Backend API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

