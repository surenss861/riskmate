/**
 * Route-level tests for GET /api/analytics/risk-heatmap and GET /api/analytics/team-performance.
 * Asserts that period=1y uses calendar-year bounds (Jan 1..today UTC) and not a rolling 365-day window.
 */

import request from "supertest";
import express from "express";
import { analyticsRouter } from "../../routes/analytics";

const mockRpc = jest.fn();

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
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

describe("GET /api/analytics/risk-heatmap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it("period=1y uses calendar-year bounds (Jan 1..today UTC), not rolling 365 days", async () => {
    const res = await request(app)
      .get("/api/analytics/risk-heatmap")
      .query({ period: "1y" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: "1y", buckets: expect.any(Array) });

    expect(mockRpc).toHaveBeenCalledWith(
      "get_risk_heatmap_buckets",
      expect.objectContaining({
        p_org_id: "org-1",
        p_since: expect.any(String),
        p_until: expect.any(String),
      })
    );

    const [, params] = mockRpc.mock.calls[0] as [string, { p_since: string; p_until: string }];
    const since = new Date(params.p_since);
    const until = new Date(params.p_until);
    const now = new Date();
    const currentYear = now.getUTCFullYear();

    expect(since.getUTCFullYear()).toBe(currentYear);
    expect(since.getUTCMonth()).toBe(0);
    expect(since.getUTCDate()).toBe(1);
    expect(since.getUTCHours()).toBe(0);
    expect(since.getUTCMinutes()).toBe(0);
    expect(since.getUTCSeconds()).toBe(0);

    expect(until.getUTCFullYear()).toBe(currentYear);
    expect(until.getUTCMonth()).toBe(now.getUTCMonth());
    expect(until.getUTCDate()).toBe(now.getUTCDate());

    const daysDiff = Math.round((until.getTime() - since.getTime()) / (24 * 60 * 60 * 1000));
    expect(daysDiff).toBeLessThanOrEqual(366);
    expect(daysDiff).toBeGreaterThanOrEqual(0);
  });
});

describe("GET /api/analytics/team-performance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
  });

  it("period=1y uses calendar-year bounds (Jan 1..today UTC), not rolling 365 days", async () => {
    const res = await request(app)
      .get("/api/analytics/team-performance")
      .query({ period: "1y" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: "1y", members: expect.any(Array) });

    const getTeamPerformanceCalls = (mockRpc.mock.calls as [string, Record<string, unknown>][]).filter(
      (c) => c[0] === "get_team_performance_kpis"
    );
    expect(getTeamPerformanceCalls.length).toBeGreaterThanOrEqual(1);

    const params = getTeamPerformanceCalls[0][1];
    const p_since = params.p_since as string;
    const p_until = params.p_until as string;
    const since = new Date(p_since);
    const until = new Date(p_until);
    const now = new Date();
    const currentYear = now.getUTCFullYear();

    expect(since.getUTCFullYear()).toBe(currentYear);
    expect(since.getUTCMonth()).toBe(0);
    expect(since.getUTCDate()).toBe(1);
    expect(since.getUTCHours()).toBe(0);
    expect(since.getUTCMinutes()).toBe(0);
    expect(since.getUTCSeconds()).toBe(0);

    expect(until.getUTCFullYear()).toBe(currentYear);
    expect(until.getUTCMonth()).toBe(now.getUTCMonth());
    expect(until.getUTCDate()).toBe(now.getUTCDate());
  });
});
