/**
 * Tests for sync resolve-conflict: divergent operation_type derivation and evidence/photo resolution.
 *
 * - Divergent conflict (operation_id prefix "divergent:") with entity_type job/hazard/control: backend
 *   derives operation_type when omitted; client may send inferred operation_type.
 * - Evidence/photo conflicts: entity_type evidence or photo, no operation_type; server_wins or
 *   local_wins returns 200 (client applies discard upload or retry).
 *
 * Prerequisites: TEST_ORG_ID and test org "Riskmate Test Org"; setupTestData provides ownerToken.
 */

import request from "supertest";
import { setupTestData, cleanupTestData, TestData } from "../helpers/testData";
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
});
