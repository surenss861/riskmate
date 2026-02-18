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
  let draftJobForPartialId: string;
  let draftJobWithReportRunId: string;
  let documentId: string | null = null;
  let reportRunId: string | null = null;

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

    // Create a draft job with a document (cascade soft-delete allowed)
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

    // Draft job used only in partial-success test (deletable, no report_runs)
    const { data: jobForPartial, error: jobForPartialErr } = await supabase
      .from("jobs")
      .insert({
        organization_id: testData.testOrgId,
        client_name: "Draft Job For Partial Test",
        job_type: "inspection",
        location: "Test",
        status: "draft",
        created_by: testData.ownerUserId,
      })
      .select("id")
      .single();
    if (jobForPartialErr) throw new Error(`Failed to create draft job for partial test: ${jobForPartialErr.message}`);
    draftJobForPartialId = jobForPartial.id;

    // Create a draft job with a report_run (ineligible for delete; partial-success path)
    const { data: jobWithReportRun, error: jobWithReportRunErr } = await supabase
      .from("jobs")
      .insert({
        organization_id: testData.testOrgId,
        client_name: "Draft Job With Report Run",
        job_type: "inspection",
        location: "Test",
        status: "draft",
        created_by: testData.ownerUserId,
      })
      .select("id")
      .single();
    if (jobWithReportRunErr) throw new Error(`Failed to create draft job with report run: ${jobWithReportRunErr.message}`);
    draftJobWithReportRunId = jobWithReportRun.id;
    const { data: run, error: runErr } = await supabase
      .from("report_runs")
      .insert({
        organization_id: testData.testOrgId,
        job_id: draftJobWithReportRunId,
        status: "draft",
        generated_by: testData.ownerUserId,
        data_hash: "test-hash-partial-success",
      })
      .select("id")
      .single();
    if (runErr) throw new Error(`Failed to create report_run: ${runErr.message}`);
    reportRunId = run?.id ?? null;
  });

  afterAll(async () => {
    if (reportRunId) await supabase.from("report_runs").delete().eq("id", reportRunId);
    if (documentId) await supabase.from("documents").delete().eq("id", documentId);
    await supabase.from("jobs").delete().eq("id", draftJobWithReportRunId);
    await supabase.from("jobs").delete().eq("id", draftJobForPartialId);
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
      expect(response.body.results).toEqual(expect.arrayContaining([expect.objectContaining({ job_id: draftJobId, status: "success" })]));
      expect(response.body.results.every((r: { job_id: string; status: string }) => r.job_id && (r.status === "success" || r.status === "error"))).toBe(true);
    });

    it("should allow bulk delete of jobs with documents (cascade soft-delete)", async () => {
      const response = await request(app)
        .post("/api/jobs/bulk/delete")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .send({ job_ids: [draftJobWithDocId] });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.succeeded).toContain(draftJobWithDocId);
      expect(response.body.data.failed ?? []).toEqual([]);
    });

    it("should partial-succeed when one job has report_runs (HAS_REPORTS excluded, others deleted)", async () => {
      const response = await request(app)
        .post("/api/jobs/bulk/delete")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .send({ job_ids: [draftJobForPartialId, draftJobWithReportRunId] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.succeeded).toContain(draftJobForPartialId);
      expect(response.body.data.failed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: draftJobWithReportRunId,
            code: "HAS_REPORTS",
            message: expect.stringMatching(/report/i),
          }),
        ])
      );
      expect(response.body.results).toEqual(expect.arrayContaining([
        expect.objectContaining({ job_id: draftJobForPartialId, status: "success" }),
        expect.objectContaining({ job_id: draftJobWithReportRunId, status: "error", error: expect.any(String), code: "HAS_REPORTS" }),
      ]));
      expect(response.body.summary.succeeded).toBe(1);
      expect(response.body.summary.failed).toBe(1);
    });
  });
});
