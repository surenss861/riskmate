/**
 * Regression test: updating a hazard via POST /api/sync/batch must enqueue exactly one hazard.updated
 * webhook event. Top-level hazards have hazard_id = null; the sync route must emit only for those rows.
 */

import request from "supertest";
import { setupTestData, cleanupTestData, TestData } from "../helpers/testData";
import { supabase } from "../../lib/supabaseClient";

const deliverEventMock = jest.fn().mockResolvedValue(undefined);
jest.mock("../../workers/webhookDelivery", () => ({
  deliverEvent: (...args: unknown[]) => deliverEventMock(...args),
}));

import app from "../../index";

describe("Sync batch update_hazard webhook emission", () => {
  let testData: TestData;
  let hazardId: string;

  beforeAll(async () => {
    testData = await setupTestData();
    const { data: hazard, error } = await supabase
      .from("mitigation_items")
      .insert({
        job_id: testData.testJobId,
        organization_id: testData.testOrgId,
        title: "Sync batch hazard",
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
    await cleanupTestData(testData.testOrgId);
  });

  beforeEach(() => {
    deliverEventMock.mockClear();
  });

  it("enqueues one hazard.updated when updating a hazard via POST /api/sync/batch", async () => {
    const res = await request(app)
      .post("/api/sync/batch")
      .set("Authorization", `Bearer ${testData.ownerToken}`)
      .set("Content-Type", "application/json")
      .send({
        operations: [
          {
            id: "op-update-hazard-1",
            type: "update_hazard",
            entity_id: hazardId,
            data: {
              job_id: testData.testJobId,
              done: true,
              is_completed: true,
              completed_at: new Date().toISOString(),
            },
            client_timestamp: new Date().toISOString(),
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body?.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({ operation_id: "op-update-hazard-1", status: "success", server_id: hazardId });

    expect(deliverEventMock).toHaveBeenCalledTimes(1);
    expect(deliverEventMock).toHaveBeenCalledWith(
      testData.testOrgId,
      "hazard.updated",
      expect.objectContaining({
        id: hazardId,
        job_id: testData.testJobId,
        done: true,
        is_completed: true,
      })
    );
  });
});
