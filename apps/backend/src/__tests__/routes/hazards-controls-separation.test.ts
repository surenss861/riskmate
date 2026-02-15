/**
 * Regression tests for hazards and controls endpoint separation
 *
 * Verifies that GET /api/jobs/:id/hazards returns only hazards (mitigation_items with hazard_id IS NULL)
 * and GET /api/jobs/:id/controls returns only controls (mitigation_items with hazard_id IS NOT NULL).
 * A job with both hazards and controls must never return controls from the hazards endpoint or hazards from the controls endpoint.
 */

import request from "supertest";
import { setupTestData, cleanupTestData, TestData } from "../helpers/testData";
import { supabase } from "../../lib/supabaseClient";
import app from "../../index";

describe("Hazards and Controls Endpoint Separation", () => {
  let testData: TestData;
  let hazardId: string | undefined;
  let controlId: string | undefined;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData(testData.testOrgId);
  });

  beforeEach(async () => {
    // Create a hazard (mitigation_item with hazard_id NULL)
    const { data: hazard, error: hazardErr } = await supabase
      .from("mitigation_items")
      .insert({
        job_id: testData.testJobId,
        organization_id: testData.testOrgId,
        title: "Test Hazard",
        description: "Hazard for regression test",
        done: false,
        is_completed: false,
        hazard_id: null,
      })
      .select("id")
      .single();

    if (hazardErr || !hazard) {
      throw new Error(`Failed to create hazard: ${hazardErr?.message}`);
    }
    hazardId = hazard.id;

    // Create a control (mitigation_item with hazard_id referencing the hazard)
    const { data: control, error: controlErr } = await supabase
      .from("mitigation_items")
      .insert({
        job_id: testData.testJobId,
        organization_id: testData.testOrgId,
        hazard_id: hazardId,
        title: "Test Control",
        description: "Control for regression test",
        done: false,
        is_completed: false,
      })
      .select("id")
      .single();

    if (controlErr || !control) {
      throw new Error(`Failed to create control: ${controlErr?.message}`);
    }
    controlId = control.id;
  });

  afterEach(async () => {
    const ids = [hazardId, controlId].filter(Boolean) as string[];
    if (ids.length > 0) {
      await supabase.from("mitigation_items").delete().in("id", ids);
    }
  });

  it("hazards endpoint must never return controls", async () => {
    const response = await request(app)
      .get(`/api/jobs/${testData.testJobId}/hazards`)
      .set("Authorization", `Bearer ${testData.ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    const hazards = response.body.data;

    // All returned items must be hazards (no controls)
    expect(Array.isArray(hazards)).toBe(true);
    const hazardIds = hazards.map((h: { id: string }) => h.id);
    expect(hazardId).toBeDefined();
    expect(controlId).toBeDefined();
    expect(hazardIds).toContain(hazardId);
    expect(hazardIds).not.toContain(controlId);
  });

  it("controls endpoint must never return hazards", async () => {
    const response = await request(app)
      .get(`/api/jobs/${testData.testJobId}/controls`)
      .set("Authorization", `Bearer ${testData.ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    const controls = response.body.data;

    // All returned items must be controls (no hazards)
    expect(Array.isArray(controls)).toBe(true);
    const controlIds = controls.map((c: { id: string }) => c.id);
    expect(hazardId).toBeDefined();
    expect(controlId).toBeDefined();
    expect(controlIds).toContain(controlId);
    expect(controlIds).not.toContain(hazardId);
  });
});
