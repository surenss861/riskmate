/**
 * Integration tests: user with null users.organization_id but valid organization_members row
 * can hit backend analytics endpoints (parity with Next.js getAnalyticsContext semantics).
 *
 * Proxied analytics routes (compliance-rate, hazard-frequency, job-completion, status-by-period)
 * are allowed when backend auth resolves org via organization_members fallback.
 *
 * Prerequisites: same as read-only-enforcement (TEST_ORG_ID, test org "Riskmate Test Org", etc.)
 *
 * Uses a minimal app (auth + analytics router only) to avoid loading TSX email templates.
 */

import request from "supertest";
import express from "express";
import { setupTestData, cleanupTestData, TestData } from "../helpers/testData";
import { supabase } from "../../lib/supabaseClient";
import { LEGAL_VERSION } from "../../utils/legal";
import { analyticsRouter } from "../../routes/analytics";

const app = express();
app.use("/api/analytics", analyticsRouter);

const describeIntegration = process.env.TEST_ORG_ID ? describe : describe.skip;

describeIntegration("Analytics membership fallback (null users.organization_id)", () => {
  let testData: TestData;
  let savedOrganizationId: string | null = null;

  beforeAll(async () => {
    testData = await setupTestData();
    const { data: userRow } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", testData.auditorUserId)
      .single();
    savedOrganizationId = userRow?.organization_id ?? null;
    await supabase
      .from("users")
      .update({ organization_id: null })
      .eq("id", testData.auditorUserId);
    await supabase.from("legal_acceptances").upsert(
      { user_id: testData.auditorUserId, version: LEGAL_VERSION, accepted_at: new Date().toISOString() },
      { onConflict: "user_id,version" }
    );
  });

  afterAll(async () => {
    if (testData?.auditorUserId && savedOrganizationId != null) {
      await supabase
        .from("users")
        .update({ organization_id: savedOrganizationId })
        .eq("id", testData.auditorUserId);
    }
    if (testData?.testOrgId) await cleanupTestData(testData.testOrgId);
  });

  it("GET /api/analytics/compliance-rate returns 200 for user with membership fallback", async () => {
    const res = await request(app)
      .get("/api/analytics/compliance-rate")
      .set("Authorization", `Bearer ${testData.auditorToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body).toHaveProperty("locked");
  });

  it("GET /api/analytics/hazard-frequency returns 200 for user with membership fallback", async () => {
    const res = await request(app)
      .get("/api/analytics/hazard-frequency")
      .set("Authorization", `Bearer ${testData.auditorToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body).toHaveProperty("locked");
  });

  it("GET /api/analytics/job-completion returns 200 for user with membership fallback", async () => {
    const res = await request(app)
      .get("/api/analytics/job-completion")
      .set("Authorization", `Bearer ${testData.auditorToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body).toHaveProperty("locked");
  });

  it("GET /api/analytics/status-by-period returns 200 for user with membership fallback", async () => {
    const res = await request(app)
      .get("/api/analytics/status-by-period")
      .set("Authorization", `Bearer ${testData.auditorToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body).toHaveProperty("locked");
  });
});
