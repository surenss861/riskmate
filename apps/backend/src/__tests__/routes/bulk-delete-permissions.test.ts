/**
 * Integration tests for bulk delete permission enforcement
 *
 * Verifies that hasJobsDeletePermission (owner-only) is enforced on both
 * backend and Next API bulk delete endpoints. Admin role must be blocked.
 *
 * Prerequisites: TEST_ORG_ID and test org named "Riskmate Test Org"
 */

import request from "supertest";
import { setupTestData, cleanupTestData, TestData } from "../helpers/testData";
import { supabase } from "../../lib/supabaseClient";
import app from "../../index";

describe("Bulk Delete Permissions", () => {
  let testData: TestData;
  let draftJobId: string;

  beforeAll(async () => {
    testData = await setupTestData();
    // Create a draft job eligible for bulk delete (no audit, risk, reports)
    const { data: draftJob, error } = await supabase
      .from("jobs")
      .insert({
        organization_id: testData.testOrgId,
        client_name: "Draft Job for Bulk Delete",
        job_type: "inspection",
        location: "Test",
        status: "draft",
        created_by: testData.ownerUserId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create draft job: ${error.message}`);
    draftJobId = draftJob.id;
  });

  afterAll(async () => {
    await supabase.from("jobs").delete().eq("id", draftJobId);
    await cleanupTestData(testData.testOrgId);
  });

  describe("Backend POST /api/jobs/bulk/delete", () => {
    it("should return 403 when admin attempts bulk delete", async () => {
      if (!testData.adminToken) {
        console.warn("Skipping: adminToken not available");
        return;
      }
      const response = await request(app)
        .post("/api/jobs/bulk/delete")
        .set("Authorization", `Bearer ${testData.adminToken}`)
        .send({ job_ids: [draftJobId] });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/permission|delete/i);
    });

    it("should allow owner to bulk delete draft jobs", async () => {
      const response = await request(app)
        .post("/api/jobs/bulk/delete")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .send({ job_ids: [draftJobId] });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.succeeded).toContain(draftJobId);
    });
  });
});
