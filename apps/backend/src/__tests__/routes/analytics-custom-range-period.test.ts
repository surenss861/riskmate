/**
 * Backend route tests: GET /api/analytics/hazard-frequency, /compliance-rate, /job-completion
 * with active subscription and custom since/until. Asserts response period metadata is derived
 * from the explicit range (effectiveDaysFromRange + periodLabelFromDays), not from period param.
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

const mockUser = {
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

describe("GET /api/analytics/hazard-frequency active subscription custom range period", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it("returns period derived from since/until when custom range provided", async () => {
    const res = await request(app)
      .get("/api/analytics/hazard-frequency")
      .query({ since: "2025-01-01", until: "2025-01-10" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: "10d", groupBy: "type", items: expect.any(Array) });
    expect(mockRpc).toHaveBeenCalledWith(
      "get_hazard_frequency_buckets",
      expect.objectContaining({
        p_org_id: "org-1",
        p_since: "2025-01-01T00:00:00.000Z",
        p_until: "2025-01-10T23:59:59.999Z",
      })
    );
  });

  it("returns period 1y when custom range spans >= 365 days", async () => {
    const res = await request(app)
      .get("/api/analytics/hazard-frequency")
      .query({ since: "2024-01-01", until: "2024-12-31" });

    expect(res.status).toBe(200);
    expect(res.body.period).toBe("1y");
  });

  it("uses period param when no since/until (default range)", async () => {
    const res = await request(app)
      .get("/api/analytics/hazard-frequency")
      .query({ period: "7d" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: "7d", items: expect.any(Array) });
  });
});

describe("GET /api/analytics/compliance-rate active subscription custom range period", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: [
        {
          total_jobs: 10,
          jobs_with_signature: 8,
          jobs_with_photo: 7,
          jobs_checklist_complete: 6,
        },
      ],
      error: null,
    });
  });

  it("returns period derived from since/until when custom range provided", async () => {
    const res = await request(app)
      .get("/api/analytics/compliance-rate")
      .query({ since: "2025-01-01", until: "2025-01-15" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: "15d",
      signatures: expect.any(Number),
      photos: expect.any(Number),
      checklists: expect.any(Number),
      overall: expect.any(Number),
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "get_compliance_rate_kpis",
      expect.objectContaining({
        p_org_id: "org-1",
        p_since: "2025-01-01T00:00:00.000Z",
        p_until: "2025-01-15T23:59:59.999Z",
      })
    );
  });

  it("empty result (totalJobs === 0) still returns period from custom range", async () => {
    mockRpc.mockResolvedValue({
      data: [{ total_jobs: 0, jobs_with_signature: 0, jobs_with_photo: 0, jobs_checklist_complete: 0 }],
      error: null,
    });
    const res = await request(app)
      .get("/api/analytics/compliance-rate")
      .query({ since: "2025-02-01", until: "2025-02-28" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: "28d",
      signatures: 0,
      photos: 0,
      checklists: 0,
      overall: 0,
    });
  });

  it("uses period param when no since/until", async () => {
    const res = await request(app)
      .get("/api/analytics/compliance-rate")
      .query({ period: "90d" });

    expect(res.status).toBe(200);
    expect(res.body.period).toBe("90d");
  });
});

describe("GET /api/analytics/job-completion active subscription custom range period", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: [
        {
          total: 20,
          completed: 15,
          avg_days_to_complete: 3.5,
          on_time_count: 12,
          overdue_count_period: 1,
          overdue_count_all_time: 2,
        },
      ],
      error: null,
    });
  });

  it("returns period derived from since/until when custom range provided", async () => {
    const res = await request(app)
      .get("/api/analytics/job-completion")
      .query({ since: "2025-01-01", until: "2025-01-22" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: "22d",
      completion_rate: expect.any(Number),
      avg_days: expect.any(Number),
      on_time_rate: expect.any(Number),
      overdue_count: expect.any(Number),
      total: 20,
      completed: 15,
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "get_job_completion_kpis",
      expect.objectContaining({
        p_org_id: "org-1",
        p_since: "2025-01-01T00:00:00.000Z",
        p_until: "2025-01-22T23:59:59.999Z",
      })
    );
  });

  it("empty result (no row) still returns period from custom range", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const res = await request(app)
      .get("/api/analytics/job-completion")
      .query({ since: "2025-03-01", until: "2025-03-14" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: "14d",
      completion_rate: 0,
      avg_days: 0,
      on_time_rate: 0,
      overdue_count: 0,
      overdue_count_all_time: 0,
      total: 0,
      completed: 0,
      avg_days_to_complete: 0,
    });
  });

  it("uses period param when no since/until", async () => {
    const res = await request(app)
      .get("/api/analytics/job-completion")
      .query({ period: "30d" });

    expect(res.status).toBe(200);
    expect(res.body.period).toBe("30d");
  });
});
