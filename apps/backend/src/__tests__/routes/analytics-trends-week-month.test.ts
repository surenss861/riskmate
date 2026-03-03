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

function chainMock(data: unknown[]) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
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
});
