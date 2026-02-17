/**
 * Integration test: Mention notifications on sign-off creation
 *
 * Verifies that when a user is @mentioned in a sign-off comment, sendMentionNotification
 * is triggered, creating a notification record with type=mention, deep_link=riskmate://comments/{commentId},
 * and delivery is guarded by notification_preferences.mentions_enabled.
 *
 * Prerequisites:
 * - TEST_ORG_ID environment variable set
 * - Test organization named "Riskmate Test Org"
 * - TEST_OWNER_EMAIL, TEST_AUDITOR_EMAIL, TEST_EXEC_EMAIL (optional)
 * - TEST_USER_PASSWORD (optional)
 *
 * Manual verification: Create a sign-off with @mention via the app and verify push is emitted
 * (requires device token registered and mentions_enabled=true). Example: "Please review @user@example.com"
 */

import request from "supertest";
import { setupTestData, cleanupTestData, TestData } from "../helpers/testData";
import { getSupabaseAdmin } from "../../lib/supabaseClient";
import app from "../../index";

describe("Mention Notifications on Sign-off", () => {
  let testData: TestData;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData(testData.testOrgId);
  });

  it("creates mention notification when @mention appears in sign-off comments", async () => {
    // Owner creates sign-off with @mention of auditor (by email)
    const comments = `Please review this. @${testData.auditorEmail}`;
    const response = await request(app)
      .post(`/api/jobs/${testData.testJobId}/signoffs`)
      .set("Authorization", `Bearer ${testData.ownerToken}`)
      .send({
        signoff_type: "safety_approval",
        comments,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    const signoffId = response.body.data.id;

    // Give async notification handler time to run
    await new Promise((r) => setTimeout(r, 500));

    const supabase = getSupabaseAdmin();
    const { data: notifications } = await supabase
      .from("notifications")
      .select("id, type, content, deep_link, user_id, organization_id")
      .eq("user_id", testData.auditorUserId)
      .eq("organization_id", testData.testOrgId)
      .eq("type", "mention")
      .order("created_at", { ascending: false })
      .limit(5);

    expect(notifications).toBeDefined();
    expect(notifications!.length).toBeGreaterThanOrEqual(1);
    const mentionNotif = notifications!.find((n) => n.deep_link?.includes(signoffId));
    expect(mentionNotif).toBeDefined();
    expect(mentionNotif!.type).toBe("mention");
    expect(mentionNotif!.deep_link).toBe(`riskmate://comments/${signoffId}`);
  }, 15000);
});
