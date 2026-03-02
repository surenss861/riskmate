/**
 * Tests for sync resolve-conflict: divergent operation_type derivation, evidence/photo resolution,
 * and webhook emission for job/hazard mutations.
 *
 * - Divergent conflict (operation_id prefix "divergent:") with entity_type job/hazard/control: backend
 *   derives operation_type when omitted; client may send inferred operation_type.
 * - Evidence/photo conflicts: entity_type evidence or photo, no operation_type; server_wins or
 *   local_wins returns 200 (client applies discard upload or retry).
 * - Webhook emission: resolve-conflict must enqueue job.created, job.updated, hazard.created,
 *   hazard.updated, job.deleted as applicable (parity with /batch).
 *
 * Prerequisites: TEST_ORG_ID and test org "Riskmate Test Org"; setupTestData provides ownerToken.
 */

import request from "supertest";
import { setupTestData, cleanupTestData, TestData } from "../helpers/testData";
import { supabase } from "../../lib/supabaseClient";

const deliverEventMock = jest.fn().mockResolvedValue(undefined);
jest.mock("../../workers/webhookDelivery", () => ({
  deliverEvent: (...args: unknown[]) => deliverEventMock(...args),
}));

import app from "../../index";

describe("Sync resolve-conflict", () => {
  let testData: TestData;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData(testData.testOrgId);
  });

  describe("divergent conflict resolution", () => {
    it("accepts local_wins with divergent operation_id and entity_type job without operation_type (derives update_job)", async () => {
      const response = await request(app)
        .post("/api/sync/resolve-conflict")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .send({
          operation_id: "divergent:job:" + testData.testJobId + ":updated_at",
          strategy: "local_wins",
          resolved_value: {
            id: testData.testJobId,
            client_name: "Updated Client",
            job_type: "inspection",
            location: "Site A",
            updated_at: new Date().toISOString(),
          },
          entity_type: "job",
          entity_id: testData.testJobId,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ ok: true, strategy: "local_wins" });
    });

    it("accepts server_wins without entity_type or operation_type for divergent id", async () => {
      const response = await request(app)
        .post("/api/sync/resolve-conflict")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .send({
          operation_id: "divergent:job:any-id:updated_at",
          strategy: "server_wins",
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ ok: true, strategy: "server_wins" });
    });
  });

  describe("evidence/photo conflict resolution", () => {
    it("accepts evidence entity_type with server_wins and returns 200", async () => {
      const response = await request(app)
        .post("/api/sync/resolve-conflict")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .send({
          operation_id: "evidence:job-1:evidence-1",
          strategy: "server_wins",
          entity_type: "evidence",
          entity_id: "evidence-1",
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ ok: true, strategy: "server_wins" });
    });

    it("accepts photo entity_type with local_wins and returns 200", async () => {
      const response = await request(app)
        .post("/api/sync/resolve-conflict")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .send({
          operation_id: "evidence:job-1:photo-1",
          strategy: "local_wins",
          resolved_value: {},
          entity_type: "photo",
          entity_id: "photo-1",
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ ok: true, strategy: "local_wins" });
    });
  });

  describe("resolve-conflict webhook emission", () => {
    let hazardId: string;

    beforeAll(async () => {
      const { data: hazard, error } = await supabase
        .from("mitigation_items")
        .insert({
          job_id: testData.testJobId,
          organization_id: testData.testOrgId,
          title: "Resolve conflict hazard",
          description: "",
          done: false,
          is_completed: false,
          hazard_id: null,
        })
        .select("id")
        .single();
      if (error || !hazard) throw new Error(`Failed to create hazard: ${error?.message}`);
      hazardId = hazard.id;
    });

    afterAll(async () => {
      if (hazardId) {
        await supabase.from("mitigation_items").delete().eq("id", hazardId);
      }
    });

    beforeEach(() => {
      deliverEventMock.mockClear();
    });

    it("enqueues job.created when resolving with local_wins create_job", async () => {
      const client_name = "Resolved Job " + Date.now();
      const job_type = "inspection";
      const location = "Site Resolved";
      const response = await request(app)
        .post("/api/sync/resolve-conflict")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .set("Content-Type", "application/json")
        .send({
          operation_id: "op-create-job-1",
          strategy: "local_wins",
          resolved_value: {
            client_name,
            job_type,
            location,
            status: "draft",
          },
          entity_type: "job",
          entity_id: "temp-id-" + Date.now(),
          operation_type: "create_job",
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ ok: true, strategy: "local_wins" });
      expect(response.body.updated_job?.id).toBeDefined();

      const jobCreatedCalls = deliverEventMock.mock.calls.filter(
        (c) => c[1] === "job.created"
      );
      expect(jobCreatedCalls.length).toBe(1);
      expect(jobCreatedCalls[0][0]).toBe(testData.testOrgId);
      expect(jobCreatedCalls[0][2]).toMatchObject({
        client_name,
        job_type,
        location,
        status: "draft",
      });
    });

    it("enqueues hazard.updated when resolving with local_wins update_hazard", async () => {
      const response = await request(app)
        .post("/api/sync/resolve-conflict")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .set("Content-Type", "application/json")
        .send({
          operation_id: "divergent:hazard:" + hazardId + ":updated_at",
          strategy: "local_wins",
          resolved_value: {
            job_id: testData.testJobId,
            done: true,
            is_completed: true,
            completed_at: new Date().toISOString(),
          },
          entity_type: "hazard",
          entity_id: hazardId,
          operation_type: "update_hazard",
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ ok: true, strategy: "local_wins" });

      const hazardUpdatedCalls = deliverEventMock.mock.calls.filter(
        (c) => c[1] === "hazard.updated"
      );
      expect(hazardUpdatedCalls.length).toBe(1);
      expect(hazardUpdatedCalls[0][0]).toBe(testData.testOrgId);
      expect(hazardUpdatedCalls[0][2]).toMatchObject({
        id: hazardId,
        job_id: testData.testJobId,
        done: true,
        is_completed: true,
      });
    });
  });
});
