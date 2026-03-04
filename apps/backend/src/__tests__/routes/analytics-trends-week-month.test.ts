/**
 * Route-level tests for GET /api/analytics/trends with groupBy=week|month.
 * Covers 30d/90d/1y requests for jobs, risk, completion, jobs_completed to prevent regressions.
 */

import request from "supertest";
import express from "express";
import { analyticsRouter } from "../../routes/analytics";

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => mockFrom(table),
  },
}));

const mockAuthenticate = jest.fn((req: any, _res: any, next: () => void) => {
  req.user = {
    id: "user-1",
    organization_id: "org-1",
    subscriptionStatus: "active",
    features: ["analytics"],
  };
  next();
});
jest.mock("../../middleware/auth", () => ({
  authenticate: (req: any, res: any, next: () => void) => mockAuthenticate(req, res, next),
}));

jest.mock("../../middleware/limits", () => ({
  requireFeature: () => (_req: any, _res: any, next: () => void) => next(),
}));

function chainMock(data: unknown[]) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data, error: null }),
  };
}

const app = express();
app.use("/api/analytics", analyticsRouter);

describe("GET /api/analytics/trends (groupBy=week|month)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "analytics_weekly_job_stats") {
        return chainMock([
          { week_start: "2025-01-06", jobs_created: 10, avg_risk: 2.5 },
          { week_start: "2025-01-13", jobs_created: 5, avg_risk: 3.0 },
        ]);
      }
      if (table === "analytics_weekly_completion_stats") {
        return chainMock([
          { week_start: "2025-01-06", jobs_completed: 8 },
          { week_start: "2025-01-13", jobs_completed: 4 },
        ]);
      }
      if (table === "jobs") {
        return chainMock([]);
      }
      return chainMock([]);
    });
  });

  it("30d + groupBy=week + metric=jobs returns data array with week buckets", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ period: "30d", groupBy: "week", metric: "jobs" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: "30d",
      groupBy: "week",
      metric: "jobs",
      data: expect.any(Array),
    });
    expect(res.body.data.length).toBeGreaterThanOrEqual(0);
    res.body.data.forEach((p: { period: string; value: number; label: string }) => {
      expect(typeof p.period).toBe("string");
      expect(typeof p.value).toBe("number");
      expect(typeof p.label).toBe("string");
    });
  });

  it("90d + groupBy=week + metric=risk returns data array", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ period: "90d", groupBy: "week", metric: "risk" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: "90d",
      groupBy: "week",
      metric: "risk",
      data: expect.any(Array),
    });
  });

  it("1y + groupBy=month + metric=jobs returns data array", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ period: "1y", groupBy: "month", metric: "jobs" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: "1y",
      groupBy: "month",
      metric: "jobs",
      data: expect.any(Array),
    });
  });

  it("period=1y uses calendar-year bounds (Jan 1 .. today)", async () => {
    mockRpc.mockImplementation((name: string, params?: { p_since?: string; p_until?: string }) => {
      if (name === "get_trends_day_buckets" && params?.p_since && params?.p_until) {
        const year = new Date().getUTCFullYear();
        expect(params.p_since).toMatch(new RegExp(`^${year}-01-01`));
        const untilDate = new Date(params.p_until);
        expect(untilDate.getUTCFullYear()).toBe(year);
        expect(untilDate.getTime()).toBeLessThanOrEqual(Date.now() + 86400000);
      }
      return Promise.resolve({ data: [], error: null });
    });
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ period: "1y", groupBy: "day", metric: "jobs" });

    expect(res.status).toBe(200);
    expect(res.body.period).toBe("1y");
    expect(mockRpc).toHaveBeenCalledWith(
      "get_trends_day_buckets",
      expect.objectContaining({
        p_org_id: "org-1",
        p_metric: "jobs",
      })
    );
    const rpcCall = mockRpc.mock.calls.find((c) => c[0] === "get_trends_day_buckets");
    expect(rpcCall).toBeDefined();
    const year = new Date().getUTCFullYear();
    expect(rpcCall![1].p_since.startsWith(`${year}-01-01`)).toBe(true);
  });

  it("30d + groupBy=week + metric=completion returns data array (0-100 values)", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ period: "30d", groupBy: "week", metric: "completion" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: "30d",
      groupBy: "week",
      metric: "completion",
      data: expect.any(Array),
    });
    res.body.data.forEach((p: { value: number }) => {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    });
  });

  it("90d + groupBy=month + metric=jobs_completed returns data array", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ period: "90d", groupBy: "month", metric: "jobs_completed" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: "90d",
      groupBy: "month",
      metric: "jobs_completed",
      data: expect.any(Array),
    });
  });

  it("returns non-empty data when MV returns rows for jobs + week", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ period: "30d", groupBy: "week", metric: "jobs" });

    expect(res.status).toBe(200);
    expect(res.body.metric).toBe("jobs");
    expect(res.body.groupBy).toBe("week");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0]).toMatchObject({ period: "2025-01-06", value: 10, label: "2025-01-06" });
    expect(res.body.data[1]).toMatchObject({ period: "2025-01-13", value: 5, label: "2025-01-13" });
  });

  it("returns non-empty data when MV returns rows for risk + week", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ period: "30d", groupBy: "week", metric: "risk" });

    expect(res.status).toBe(200);
    expect(res.body.metric).toBe("risk");
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].value).toBe(2.5);
    expect(res.body.data[1].value).toBe(3);
  });

  it("returns non-empty data when MV returns rows for jobs_completed + week", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ period: "30d", groupBy: "week", metric: "jobs_completed" });

    expect(res.status).toBe(200);
    expect(res.body.metric).toBe("jobs_completed");
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0]).toMatchObject({ period: "2025-01-06", value: 8, label: "2025-01-06" });
    expect(res.body.data[1]).toMatchObject({ period: "2025-01-13", value: 4, label: "2025-01-13" });
  });

  it("returns completion rate when MV returns completion + creation rows", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ period: "30d", groupBy: "week", metric: "completion" });

    expect(res.status).toBe(200);
    expect(res.body.metric).toBe("completion");
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].value).toBe(80);
    expect(res.body.data[1].value).toBe(80);
  });

  it("explicit since/until >730 days: response period reflects range (fallback path, not 30d)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "analytics_weekly_job_stats" || table === "analytics_weekly_completion_stats") {
        return chainMock([]);
      }
      if (table === "jobs") {
        return chainMock([
          { id: "j1", risk_score: 2, status: "completed", created_at: "2021-06-01T00:00:00Z", completed_at: "2021-06-02T00:00:00Z" },
        ]);
      }
      return chainMock([]);
    });
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ since: "2020-01-01T00:00:00.000Z", until: "2022-12-31T23:59:59.999Z", groupBy: "week", metric: "jobs" });

    expect(res.status).toBe(200);
    expect(res.body.period).not.toBe("30d");
    expect(res.body.period).toBe("1y");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for impossible calendar date (e.g. Feb 30)", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ since: "2024-02-30", until: "2024-03-15", groupBy: "day", metric: "jobs" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toMatch(/invalid date format|since or until/i);
  });

  it("returns 400 VALIDATION_ERROR for impossible month (e.g. month 13)", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ since: "2025-13-01", until: "2025-12-31", groupBy: "day", metric: "jobs" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toMatch(/invalid date format|since or until/i);
  });

  it("returns 400 VALIDATION_ERROR when only since is provided (one-sided range)", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ since: "2025-01-01", groupBy: "day", metric: "jobs" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toMatch(/both since and until|requires both/i);
  });

  it("returns 400 VALIDATION_ERROR when only until is provided (one-sided range)", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ until: "2025-01-15", groupBy: "day", metric: "jobs" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toMatch(/both since and until|requires both/i);
  });

  it("date-only since/until: until normalized to end-of-day UTC", async () => {
    const res = await request(app)
      .get("/api/analytics/trends")
      .query({ since: "2025-01-01", until: "2025-01-15", groupBy: "day", metric: "jobs" });

    expect(res.status).toBe(200);
    expect(res.body.period).toBe("15d");
    expect(res.body.metric).toBe("jobs");
    expect(mockRpc).toHaveBeenCalledWith(
      "get_trends_day_buckets",
      expect.objectContaining({
        p_since: "2025-01-01T00:00:00.000Z",
        p_until: "2025-01-15T23:59:59.999Z",
      })
    );
  });
});

describe("GET /api/analytics/trends locked response", () => {
  it("locked response includes metric for schema parity with unlocked response", async () => {
    mockAuthenticate.mockImplementationOnce((req: any, _res: any, next: () => void) => {
      req.user = {
        id: "user-locked",
        organization_id: "org-locked",
        subscriptionStatus: "canceled",
        features: [],
      };
      next();
    });
    const res = await request(app).get("/api/analytics/trends").query({ period: "30d", metric: "jobs" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: "30d",
      groupBy: "day",
      metric: "jobs",
      data: [],
      locked: true,
    });
  });
});
