/**
 * Analytics trends: metric=completion returns completion-rate series (spec-aligned).
 * Ensures GET /api/analytics/trends?metric=completion is reachable and returns completion data.
 */

import request from "supertest";
import express from "express";
import { analyticsRouter } from "../../routes/analytics";

const mockRpc = jest.fn();
jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ order: () => ({ range: () => Promise.resolve({ data: [], error: null }) }) }) }) }) }) }),
  },
}));

jest.mock("../../middleware/auth", () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    req.user = {
      id: "user-1",
      organization_id: "org-1",
      subscriptionStatus: "active",
      features: ["analytics"],
    };
    next();
  },
}));

jest.mock("../../middleware/limits", () => ({
  requireFeature: () => (_req: any, _res: any, next: () => void) => next(),
}));

const app = express();
app.use("/api/analytics", analyticsRouter);

describe("GET /api/analytics/trends", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("metric=completion returns completion-rate series (day buckets)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { period_key: "2025-02-01", value: 75.5 },
        { period_key: "2025-02-02", value: 100 },
        { period_key: "2025-02-03", value: 0 },
      ],
      error: null,
    });

    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ metric: "completion", period: "7d", groupBy: "day" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: expect.any(String),
      groupBy: "day",
      metric: "completion",
      data: [
        { period: "2025-02-01", value: 75.5, label: "2025-02-01" },
        { period: "2025-02-02", value: 100, label: "2025-02-02" },
        { period: "2025-02-03", value: 0, label: "2025-02-03" },
      ],
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "get_trends_day_buckets",
      expect.objectContaining({
        p_org_id: "org-1",
        p_metric: "completion",
      })
    );
  });

  it("metric=completion_rate is accepted and routed to completion", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ period_key: "2025-02-01", value: 50 }],
      error: null,
    });

    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ metric: "completion_rate", period: "30d" });

    expect(res.status).toBe(200);
    expect(res.body.metric).toBe("completion");
    expect(mockRpc).toHaveBeenCalledWith(
      "get_trends_day_buckets",
      expect.objectContaining({ p_metric: "completion" })
    );
  });
});
