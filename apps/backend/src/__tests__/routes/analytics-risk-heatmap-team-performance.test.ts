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

let mockUser: { id: string; organization_id: string; subscriptionStatus: string; features: string[] } = {
  id: "user-1",
  organization_id: "org-1",
  subscriptionStatus: "active",
  features: ["analytics"],
};
jest.mock("../../middleware/auth", () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    req.user = { ...mockUser };
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

  it("returns 400 VALIDATION_ERROR when only since is provided (one-sided range)", async () => {
    const res = await request(app)
      .get("/api/analytics/risk-heatmap")
      .query({ since: "2025-01-01" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toMatch(/both since and until|requires both/i);
  });

  it("returns 400 VALIDATION_ERROR when only until is provided (one-sided range)", async () => {
    const res = await request(app)
      .get("/api/analytics/risk-heatmap")
      .query({ until: "2025-01-15" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toMatch(/both since and until|requires both/i);
  });

  it("date-only since/until: until normalized to end-of-day UTC", async () => {
    const res = await request(app)
      .get("/api/analytics/risk-heatmap")
      .query({ since: "2025-01-01", until: "2025-01-15" });
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("15d");
    expect(mockRpc).toHaveBeenCalledWith(
      "get_risk_heatmap_buckets",
      expect.objectContaining({
        p_since: "2025-01-01T00:00:00.000Z",
        p_until: "2025-01-15T23:59:59.999Z",
      })
    );
  });
});

describe("GET /api/analytics/risk-heatmap locked response period parity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: "user-1",
      organization_id: "org-1",
      subscriptionStatus: "none",
      features: [],
    };
  });

  afterEach(() => {
    mockUser = {
      id: "user-1",
      organization_id: "org-1",
      subscriptionStatus: "active",
      features: ["analytics"],
    };
  });

  it("locked response includes period from period=30d", async () => {
    const res = await request(app).get("/api/analytics/risk-heatmap").query({ period: "30d" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: "30d", buckets: [], locked: true });
  });

  it("locked response includes period from period=1y", async () => {
    const res = await request(app).get("/api/analytics/risk-heatmap").query({ period: "1y" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: "1y", buckets: [], locked: true });
  });

  it("locked response includes period from custom since/until", async () => {
    const res = await request(app)
      .get("/api/analytics/risk-heatmap")
      .query({ since: "2025-01-01", until: "2025-01-10" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: "10d", buckets: [], locked: true });
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

  it("returns 400 VALIDATION_ERROR when only since is provided (one-sided range)", async () => {
    const res = await request(app)
      .get("/api/analytics/team-performance")
      .query({ since: "2025-01-01" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toMatch(/both since and until|requires both/i);
  });

  it("returns 400 VALIDATION_ERROR when only until is provided (one-sided range)", async () => {
    const res = await request(app)
      .get("/api/analytics/team-performance")
      .query({ until: "2025-01-15" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toMatch(/both since and until|requires both/i);
  });

  it("date-only since/until: until normalized to end-of-day UTC", async () => {
    const res = await request(app)
      .get("/api/analytics/team-performance")
      .query({ since: "2025-01-01", until: "2025-01-20" });
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("20d");
    const getTeamPerformanceCalls = (mockRpc.mock.calls as [string, Record<string, unknown>][]).filter(
      (c) => c[0] === "get_team_performance_kpis"
    );
    expect(getTeamPerformanceCalls.length).toBeGreaterThanOrEqual(1);
    expect(getTeamPerformanceCalls[0][1]).toMatchObject({
      p_since: "2025-01-01T00:00:00.000Z",
      p_until: "2025-01-20T23:59:59.999Z",
    });
  });
});

describe("GET /api/analytics/team-performance locked response period parity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: "user-1",
      organization_id: "org-1",
      subscriptionStatus: "none",
      features: [],
    };
  });

  afterEach(() => {
    mockUser = {
      id: "user-1",
      organization_id: "org-1",
      subscriptionStatus: "active",
      features: ["analytics"],
    };
  });

  it("locked response includes period from period=30d", async () => {
    const res = await request(app).get("/api/analytics/team-performance").query({ period: "30d" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: "30d", members: [], locked: true });
  });

  it("locked response includes period from period=1y", async () => {
    const res = await request(app).get("/api/analytics/team-performance").query({ period: "1y" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: "1y", members: [], locked: true });
  });

  it("locked response includes period from custom since/until", async () => {
    const res = await request(app)
      .get("/api/analytics/team-performance")
      .query({ since: "2025-01-01", until: "2025-01-10" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: "10d", members: [], locked: true });
  });
});
