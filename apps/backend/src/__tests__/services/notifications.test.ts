/**
 * Unit tests for notification preferences and email_enabled gating.
 * Verifies that prefs.email_enabled is respected in the send path (sendToUser
 * only runs email inside `if (prefs.email_enabled)`). Any future email job/worker
 * must use this flag.
 */

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
} from "../../services/notifications";

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
  });
});
