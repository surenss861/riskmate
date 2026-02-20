/**
 * Unit tests for PATCH /api/notifications/preferences.
 * Verifies that the upsert payload uses only contract column names (mention, reply,
 * job_assigned, etc.) so preference updates succeed after the notification_preferences
 * schema is aligned with NotificationPreferences.
 */

import request from "supertest";
import type { NotificationPreferences } from "../../services/notifications";

const CONTRACT_KEYS: (keyof NotificationPreferences)[] = [
  "push_enabled",
  "email_enabled",
  "mention",
  "reply",
  "job_assigned",
  "signature_requested",
  "evidence_uploaded",
  "hazard_added",
  "deadline_approaching",
  "email_deadline_reminder",
  "weekly_summary",
  "email_weekly_digest",
  "high_risk_job",
  "report_ready",
  "job_comment",
  "comment_resolved",
];

let upsertPayload: Record<string, unknown> | null = null;
const mockUpsertImpl = (payload: Record<string, unknown>) => {
  upsertPayload = payload;
  return Promise.resolve({ data: null, error: null });
};
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((table: string) => {
  if (table === "notification_preferences") {
    return {
      select: mockSelect,
      upsert: mockUpsertImpl,
    };
  }
  return { select: mockSelect };
});

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: mockFrom,
  },
}));

jest.mock("../../middleware/auth", () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    req.user = { id: "test-user-id", organization_id: "test-org-id" };
    next();
  },
}));

jest.mock("../../middleware/limits", () => ({
  requireFeature: () => (_req: any, _res: any, next: () => void) => next(),
}));

import express from "express";
import { notificationsRouter } from "../../routes/notifications";

const app = express();
app.use(express.json());
app.use("/api/notifications", notificationsRouter);

describe("PATCH /api/notifications/preferences", () => {
  const defaultPrefsRow = {
    user_id: "test-user-id",
    push_enabled: true,
    email_enabled: true,
    mention: true,
    reply: false,
    job_assigned: true,
    signature_requested: true,
    evidence_uploaded: true,
    hazard_added: true,
    deadline_approaching: true,
    email_deadline_reminder: false,
    weekly_summary: false,
    email_weekly_digest: true,
    high_risk_job: true,
    report_ready: true,
    job_comment: true,
    comment_resolved: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    upsertPayload = null;
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({
      data: defaultPrefsRow,
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "notification_preferences") {
        return {
          select: mockSelect,
          upsert: mockUpsertImpl,
        };
      }
      return { select: mockSelect };
    });
  });

  it("sends upsert with only user_id, updated_at, and contract preference keys", async () => {
    const response = await request(app)
      .patch("/api/notifications/preferences")
      .set("Content-Type", "application/json")
      .send({
        mention: false,
        reply: true,
        weekly_summary: true,
      });

    expect(response.status).toBe(200);
    expect(upsertPayload).not.toBeNull();
    const payload = upsertPayload!;
    const allowedPayloadKeys = new Set([
      "user_id",
      "updated_at",
      ...CONTRACT_KEYS,
    ]);
    for (const key of Object.keys(payload)) {
      expect(allowedPayloadKeys.has(key)).toBe(true);
    }
    expect(payload.user_id).toBe("test-user-id");
    expect(typeof payload.updated_at).toBe("string");
    expect(payload.mention).toBe(false);
    expect(payload.reply).toBe(true);
    expect(payload.weekly_summary).toBe(true);
  });

  it("succeeds when body has no boolean prefs (returns current prefs without upsert)", async () => {
    const response = await request(app)
      .patch("/api/notifications/preferences")
      .set("Content-Type", "application/json")
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      push_enabled: true,
      email_enabled: true,
      mention: true,
    });
  });
});
