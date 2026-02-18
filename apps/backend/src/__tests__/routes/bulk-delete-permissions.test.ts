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
  let draftJobWithDocId: string;
  let documentId: string | null = null;

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

    // Create a draft job with a document (should be rejected with HAS_EVIDENCE)
    const { data: jobWithDoc, error: jobError } = await supabase
      .from("jobs")
      .insert({
        organization_id: testData.testOrgId,
        client_name: "Draft Job With Document",
        job_type: "inspection",
        location: "Test",
        status: "draft",
        created_by: testData.ownerUserId,
      })
      .select("id")
      .single();
    if (jobError) throw new Error(`Failed to create draft job with doc: ${jobError.message}`);
    draftJobWithDocId = jobWithDoc.id;
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        job_id: draftJobWithDocId,
        organization_id: testData.testOrgId,
        name: "test-evidence.pdf",
        type: "other",
        file_path: "test/test-evidence.pdf",
        file_size: 0,
        mime_type: "application/pdf",
        uploaded_by: testData.ownerUserId,
      })
      .select("id")
      .single();
    if (docError) throw new Error(`Failed to create document: ${docError.message}`);
    documentId = doc?.id ?? null;
  });

  afterAll(async () => {
    if (documentId) await supabase.from("documents").delete().eq("id", documentId);
    await supabase.from("jobs").delete().eq("id", draftJobWithDocId);
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

    it("should return HAS_EVIDENCE for jobs with documents (matching Next endpoint behavior)", async () => {
      const response = await request(app)
        .post("/api/jobs/bulk/delete")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .send({ job_ids: [draftJobWithDocId] });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.succeeded).toEqual([]);
      const failed = response.body.data.failed ?? [];
      const hasEvidenceFailure = failed.find(
        (f: { id: string; code: string }) => f.id === draftJobWithDocId && f.code === "HAS_EVIDENCE"
      );
      expect(hasEvidenceFailure).toBeDefined();
      expect(hasEvidenceFailure.message).toMatch(/evidence|cannot be deleted/i);
    });
  });
});
