/**
 * Dashboard summary: completion chart uses same-cohort data (get_dashboard_chart_data).
 * Numerator and denominator both by creation date; jobs_completed ≤ jobs_created so rate is 0–100 without needing clamp for >100.
 */

import request from "supertest";
import express from "express";
import { dashboardRouter } from "../../routes/dashboard";

const mockRpc = jest.fn();
jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock("../../middleware/auth", () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    req.user = { organization_id: "org-1" };
    next();
  },
}));

const app = express();
app.use("/api/dashboard", dashboardRouter);

const kpisRow = {
  jobs_total: 10,
  jobs_completed: 5,
  avg_risk: 2.5,
  on_time_count: 4,
  overdue_count: 1,
};
const complianceRow = {
  total_jobs: 10,
  jobs_with_signature: 8,
  jobs_with_photo: 7,
  jobs_checklist_complete: 6,
};
const emptyList: unknown[] = [];

function setupDefaultMocks(chartDataRes: { data: unknown; error?: unknown }) {
  mockRpc
    .mockResolvedValueOnce({ data: [kpisRow], error: null })
    .mockResolvedValueOnce({ data: [kpisRow], error: null })
    .mockResolvedValueOnce({ data: [complianceRow], error: null })
    .mockResolvedValueOnce({ data: [complianceRow], error: null })
    .mockResolvedValueOnce({ data: emptyList, error: null })
    .mockResolvedValueOnce({ data: emptyList, error: null })
    .mockResolvedValueOnce(chartDataRes);
}

describe("GET /api/dashboard/summary chartData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("chart completion rate is 100 when all created that day are completed (same-cohort)", async () => {
    const chartUntil = new Date();
    chartUntil.setHours(23, 59, 59, 999);
    const chartSince = new Date(chartUntil.getTime());
    chartSince.setDate(chartSince.getDate() - 6);
    chartSince.setHours(0, 0, 0, 0);
    const dateStr = chartSince.toISOString().slice(0, 10);

    setupDefaultMocks({
      data: [
        { period_key: dateStr, jobs_created: 2, jobs_completed: 2 },
      ],
      error: null,
    });

    const res = await request(app).get("/api/dashboard/summary").query({ period: "30d" });

    expect(res.status).toBe(200);
    const chartData = res.body?.data?.chartData as { date: string; value: number }[] | undefined;
    expect(chartData).toBeDefined();
    const point = chartData?.find((p: { date: string }) => p.date === dateStr);
    expect(point).toBeDefined();
    expect(point!.value).toBe(100);
    expect(point!.value).toBeLessThanOrEqual(100);
    expect(point!.value).toBeGreaterThanOrEqual(0);
  });

  it("chartData values are in 0–100 range for normal same-cohort rates", async () => {
    const chartUntil = new Date();
    chartUntil.setHours(23, 59, 59, 999);
    const chartSince = new Date(chartUntil.getTime());
    chartSince.setDate(chartSince.getDate() - 6);
    chartSince.setHours(0, 0, 0, 0);
    const dateStr = chartSince.toISOString().slice(0, 10);

    setupDefaultMocks({
      data: [{ period_key: dateStr, jobs_created: 4, jobs_completed: 2 }],
      error: null,
    });

    const res = await request(app).get("/api/dashboard/summary").query({ period: "30d" });

    expect(res.status).toBe(200);
    const chartData = res.body?.data?.chartData as { date: string; value: number }[] | undefined;
    expect(chartData).toBeDefined();
    const point = chartData?.find((p: { date: string }) => p.date === dateStr);
    expect(point?.value).toBe(50);
  });
});
