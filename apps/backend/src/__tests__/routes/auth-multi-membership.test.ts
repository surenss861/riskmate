/**
 * Integration tests: auth multi-membership resolution.
 * When users.organization_id is null and the user has multiple organization_members rows,
 * auth must require an explicit organization selector (X-Organization-Id or organization_id query)
 * and reject or resolve deterministically.
 *
 * Prerequisites: TEST_ORG_ID (same as analytics-membership-fallback).
 */

import request from "supertest";
import express from "express";
import { setupTestData, cleanupTestData, TestData } from "../helpers/testData";
import { supabase } from "../../lib/supabaseClient";
import { getSupabaseAdmin } from "../../lib/supabaseClient";
import { LEGAL_VERSION } from "../../utils/legal";
import { analyticsRouter } from "../../routes/analytics";

const app = express();
app.use("/api/analytics", analyticsRouter);

const describeIntegration = process.env.TEST_ORG_ID ? describe : describe.skip;

describeIntegration("Auth multi-membership resolution", () => {
  let testData: TestData;
  let savedOrganizationId: string | null = null;
  let secondOrgId: string | null = null;

  beforeAll(async () => {
    testData = await setupTestData();
    const admin = getSupabaseAdmin();

    // Create a second organization (admin to bypass RLS if needed)
    const { data: secondOrg, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: "Riskmate Test Org 2 (multi-membership)",
        trade_type: "other",
        subscription_tier: "starter",
        subscription_status: "trialing",
      })
      .select("id")
      .single();

    if (orgError || !secondOrg?.id) {
      throw new Error(`Failed to create second org: ${orgError?.message ?? "no id"}`);
    }
    secondOrgId = secondOrg.id;

    // Add auditor to second org so they have two memberships
    await supabase
      .from("organization_members")
      .upsert(
        {
          user_id: testData.auditorUserId,
          organization_id: secondOrgId,
          role: "viewer",
        },
        { onConflict: "user_id,organization_id" }
      );

    // Set user's organization_id to null so fallback path is used
    const { data: userRow } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", testData.auditorUserId)
      .single();
    savedOrganizationId = userRow?.organization_id ?? null;

    const { error: updateErr } = await getSupabaseAdmin()
      .from("users")
      .update({ organization_id: null })
      .eq("id", testData.auditorUserId);
    if (updateErr) {
      throw new Error(`Failed to set user organization_id to null: ${updateErr.message}. (users.organization_id may be NOT NULL in this schema.)`);
    }

    await supabase.from("legal_acceptances").upsert(
      { user_id: testData.auditorUserId, version: LEGAL_VERSION, accepted_at: new Date().toISOString() },
      { onConflict: "user_id,version" }
    );
  });

  afterAll(async () => {
    const admin = getSupabaseAdmin();
    if (testData?.auditorUserId && savedOrganizationId != null) {
      await admin
        .from("users")
        .update({ organization_id: savedOrganizationId })
        .eq("id", testData.auditorUserId);
    }
    if (testData?.auditorUserId && secondOrgId) {
      await admin
        .from("organization_members")
        .delete()
        .eq("user_id", testData.auditorUserId)
        .eq("organization_id", secondOrgId);
    }
    if (secondOrgId) {
      await admin.from("organizations").delete().eq("id", secondOrgId);
    }
    if (testData?.testOrgId) await cleanupTestData(testData.testOrgId);
  });

  it("returns 403 ORGANIZATION_SELECTION_REQUIRED when multiple memberships and no selector", async () => {
    const res = await request(app)
      .get("/api/analytics/compliance-rate")
      .set("Authorization", `Bearer ${testData.auditorToken}`);
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("ORGANIZATION_SELECTION_REQUIRED");
    expect(res.body?.hint).toMatch(/multiple organizations|X-Organization-Id|organization_id/);
  });

  it("returns 200 with first org when X-Organization-Id is test org", async () => {
    const res = await request(app)
      .get("/api/analytics/compliance-rate")
      .set("Authorization", `Bearer ${testData.auditorToken}`)
      .set("X-Organization-Id", testData.testOrgId);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body).toHaveProperty("locked");
  });

  it("returns 200 with second org when X-Organization-Id is second org", async () => {
    const res = await request(app)
      .get("/api/analytics/compliance-rate")
      .set("Authorization", `Bearer ${testData.auditorToken}`)
      .set("X-Organization-Id", secondOrgId!);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it("returns 403 ORGANIZATION_NOT_ACCESSIBLE when X-Organization-Id is not a membership", async () => {
    const randomUuid = "00000000-0000-4000-8000-000000000000";
    const res = await request(app)
      .get("/api/analytics/compliance-rate")
      .set("Authorization", `Bearer ${testData.auditorToken}`)
      .set("X-Organization-Id", randomUuid);
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("ORGANIZATION_NOT_ACCESSIBLE");
  });

  it("returns 200 when organization_id query param is valid", async () => {
    const res = await request(app)
      .get("/api/analytics/compliance-rate")
      .query({ organization_id: testData.testOrgId })
      .set("Authorization", `Bearer ${testData.auditorToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});
