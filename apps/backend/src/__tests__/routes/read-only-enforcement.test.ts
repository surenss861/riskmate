/**
 * Integration tests for read-only role enforcement
 * 
 * Tests that auditors and executives are blocked from write operations
 * while still being allowed to generate proof-packs (read-only output)
 * 
 * Test cases:
 * 1. auditor -> PATCH /jobs/:id => 403 AUTH_ROLE_READ_ONLY
 * 2. executive -> POST /jobs => 403 AUTH_ROLE_READ_ONLY
 * 3. auditor -> POST /jobs/:id/proof-pack => 200 (read-only output allowed)
 * 4. owner -> PATCH /jobs/:id => 200 (write access allowed)
 * 
 * Prerequisites:
 * - TEST_ORG_ID environment variable set to a test organization ID
 * - Test organization must be named "RiskMate Test Org" (safety fuse)
 * - TEST_OWNER_EMAIL, TEST_AUDITOR_EMAIL, TEST_EXEC_EMAIL (optional, auto-generated if not set)
 * - TEST_USER_PASSWORD (optional, defaults to "TestPassword123!")
 * 
 * Usage:
 *   TEST_ORG_ID=your-test-org-id npm test
 */

import request from "supertest";
import express from "express";
import { setupTestData, cleanupTestData, TestData } from "../helpers/testData";
import { supabase } from "../../lib/supabaseClient";
import app from "../../index";

describe("Read-Only Role Enforcement", () => {
  let testData: TestData;

  beforeAll(async () => {
    // Setup test data
    testData = await setupTestData();
  });

  describe("Auditor Role Enforcement", () => {
    it("should block PATCH /api/jobs/:id with 403 AUTH_ROLE_READ_ONLY", async () => {
      const response = await request(app)
        .patch(`/api/jobs/${testData.testJobId}`)
        .set("Authorization", `Bearer ${testData.auditorToken}`)
        .send({
          client_name: "Updated Name",
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        message: "Auditors have read-only access",
        code: "AUTH_ROLE_READ_ONLY",
      });
      expect(response.headers["x-error-id"]).toBeDefined();
    });

    it("should block POST /api/jobs with 403 AUTH_ROLE_READ_ONLY", async () => {
      const response = await request(app)
        .post("/api/jobs")
        .set("Authorization", `Bearer ${testData.auditorToken}`)
        .send({
          client_name: "New Job",
          job_type: "inspection",
          location: "Test Location",
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        message: "Auditors have read-only access",
        code: "AUTH_ROLE_READ_ONLY",
      });
      expect(response.headers["x-error-id"]).toBeDefined();
    });

    it("should block DELETE /api/jobs/:id with 403 AUTH_ROLE_READ_ONLY", async () => {
      const response = await request(app)
        .delete(`/api/jobs/${testData.testJobId}`)
        .set("Authorization", `Bearer ${testData.auditorToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        message: "Auditors have read-only access",
        code: "AUTH_ROLE_READ_ONLY",
      });
      expect(response.headers["x-error-id"]).toBeDefined();
    });

    it("should allow POST /api/jobs/:id/proof-pack with 200 (read-only output)", async () => {
      const response = await request(app)
        .post(`/api/jobs/${testData.testJobId}/proof-pack`)
        .set("Authorization", `Bearer ${testData.auditorToken}`)
        .send({
          pack_type: "audit",
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          pdf_base64: expect.any(String),
          generated_at: expect.any(String),
        }),
      });
    });

    it("should allow GET /api/jobs (read operations)", async () => {
      const response = await request(app)
        .get("/api/jobs")
        .set("Authorization", `Bearer ${testData.auditorToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
    });
  });

  describe("Executive Role Enforcement", () => {
    it("should block POST /api/jobs with 403 AUTH_ROLE_READ_ONLY", async () => {
      const response = await request(app)
        .post("/api/jobs")
        .set("Authorization", `Bearer ${testData.executiveToken}`)
        .send({
          client_name: "New Job",
          job_type: "inspection",
          location: "Test Location",
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        message: "Executives have read-only access",
        code: "AUTH_ROLE_READ_ONLY",
      });
      expect(response.headers["x-error-id"]).toBeDefined();
    });

    it("should block PATCH /api/jobs/:id with 403 AUTH_ROLE_READ_ONLY", async () => {
      const response = await request(app)
        .patch(`/api/jobs/${testData.testJobId}`)
        .set("Authorization", `Bearer ${testData.executiveToken}`)
        .send({
          client_name: "Updated Name",
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        message: "Executives have read-only access",
        code: "AUTH_ROLE_READ_ONLY",
      });
      expect(response.headers["x-error-id"]).toBeDefined();
    });

    it("should allow GET /api/jobs (read operations)", async () => {
      const response = await request(app)
        .get("/api/jobs")
        .set("Authorization", `Bearer ${testData.executiveToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
    });
  });

  describe("Owner Role (Full Access)", () => {
    it("should allow PATCH /api/jobs/:id with 200", async () => {
      const response = await request(app)
        .patch(`/api/jobs/${testData.testJobId}`)
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .send({
          client_name: "Updated Name",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
    });

    it("should allow POST /api/jobs with 201", async () => {
      const response = await request(app)
        .post("/api/jobs")
        .set("Authorization", `Bearer ${testData.ownerToken}`)
        .send({
          client_name: "New Job",
          job_type: "inspection",
          location: "Test Location",
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("data");
    });
  });

  describe("Audit Logging", () => {
    it("should log role violations to audit trail", async () => {
      // Attempt a write operation as auditor
      await request(app)
        .patch(`/api/jobs/${testData.testJobId}`)
        .set("Authorization", `Bearer ${testData.auditorToken}`)
        .send({
          client_name: "Attempted Update",
        });

      // Verify audit log was created
      const { data: auditLogs, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("event_name", "auth.role_violation")
        .eq("organization_id", testData.testOrgId)
        .order("created_at", { ascending: false })
        .limit(1);

      expect(error).toBeNull();
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs?.[0]).toMatchObject({
        event_name: "auth.role_violation",
        metadata: expect.objectContaining({
          role: "auditor",
          method: "PATCH",
        }),
      });
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData(testData.testOrgId);
  });
});
