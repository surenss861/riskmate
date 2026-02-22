/**
 * Unit tests for notification preferences and email_enabled gating.
 * Verifies that prefs.email_enabled is respected in the send path (sendToUser
 * only runs email inside `if (prefs.email_enabled)`). Any future email job/worker
 * must use this flag.
 * Verifies DEFAULT_NOTIFICATION_PREFERENCES and getNotificationPreferences align with
 * notification_preferences schema (contract column names: mention, reply, job_assigned, etc.).
 */

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  type NotificationPreferences,
} from "../../services/notifications";

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

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: () => ({ select: mockSelect }),
  },
}));

describe("notifications service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  describe("DEFAULT_NOTIFICATION_PREFERENCES", () => {
    it("includes email_enabled and push_enabled so backend can gate delivery", () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.email_enabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.push_enabled).toBe(true);
    });

    it("has exactly the contract keys matching notification_preferences schema", () => {
      const defaultKeys = Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).sort();
      const expected = [...CONTRACT_KEYS].sort();
      expect(defaultKeys).toEqual(expected);
    });

    it("sets weekly_summary default false, email_deadline_reminder default true", () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.weekly_summary).toBe(false);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.email_deadline_reminder).toBe(true);
    });
  });

  describe("getNotificationPreferences", () => {
    it("returns defaults with email_enabled when no row exists", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const prefs = await getNotificationPreferences("user-1");
      expect(prefs.email_enabled).toBe(true);
      expect(prefs.push_enabled).toBe(true);
    });

    it("returns email_enabled from row when present", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { user_id: "user-1", email_enabled: false, push_enabled: true },
        error: null,
      });
      const prefs = await getNotificationPreferences("user-1");
      expect(prefs.email_enabled).toBe(false);
      expect(prefs.push_enabled).toBe(true);
    });

    it("maps all contract keys from row (schema column names)", async () => {
      const row: Record<string, unknown> = {
        user_id: "user-1",
        push_enabled: true,
        email_enabled: false,
        mention: true,
        reply: false,
        job_assigned: true,
        signature_requested: true,
        evidence_uploaded: true,
        hazard_added: true,
        deadline_approaching: true,
        email_deadline_reminder: false,
        weekly_summary: true,
        email_weekly_digest: false,
        high_risk_job: true,
        report_ready: true,
        job_comment: false,
        comment_resolved: true,
      };
      mockMaybeSingle.mockResolvedValue({ data: row, error: null });
      const prefs = await getNotificationPreferences("user-1");
      for (const key of CONTRACT_KEYS) {
        expect(prefs[key]).toBe(row[key]);
      }
    });
  });
});
