/**
 * Integration test: only one signature.added event is emitted per signing action.
 * The backend POST /api/jobs/:id/signoffs is the single source of emission for this route;
 * the Next.js app/api/jobs/[id]/signoffs route owns emission for web clients. Each path
 * must emit at most once per signoff creation to avoid duplicate webhook deliveries.
 */

import request from "supertest";
import { setupTestData, cleanupTestData, TestData } from "../helpers/testData";
import { supabase } from "../../lib/supabaseClient";

const deliverEventMock = jest.fn().mockResolvedValue(undefined);
jest.mock("../../workers/webhookDelivery", () => ({
  deliverEvent: (...args: unknown[]) => deliverEventMock(...args),
}));

import app from "../../index";

describe("signature.added single emit per signoff", () => {
  let testData: TestData;
  let jobId: string;

  beforeAll(async () => {
    testData = await setupTestData();
    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        organization_id: testData.testOrgId,
        client_name: "Signoff webhook test job",
        job_type: "inspection",
        location: "Test",
        status: "in_progress",
        created_by: testData.ownerUserId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create test job: ${error.message}`);
    jobId = job.id;
  });

  afterAll(async () => {
    if (jobId) {
      await supabase.from("job_signoffs").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
    }
    await cleanupTestData(testData.testOrgId);
  });

  beforeEach(() => {
    deliverEventMock.mockClear();
  });

  it("emits exactly one signature.added event when creating a signoff via POST /api/jobs/:id/signoffs", async () => {
    const res = await request(app)
      .post(`/api/jobs/${jobId}/signoffs`)
      .set("Authorization", `Bearer ${testData.ownerToken}`)
      .set("Content-Type", "application/json")
      .send({
        signoff_type: "safety_approval",
        comments: "Integration test signoff",
      });

    expect(res.status).toBe(201);
    expect(res.body?.data?.id).toBeDefined();

    expect(deliverEventMock).toHaveBeenCalledTimes(1);
    expect(deliverEventMock).toHaveBeenCalledWith(
      testData.testOrgId,
      "signature.added",
      expect.objectContaining({
        signoff_id: res.body.data.id,
        job_id: jobId,
        signoff_type: "safety_approval",
      })
    );
  });
});
