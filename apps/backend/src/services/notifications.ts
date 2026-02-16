import fs from "fs";
import apn from "apn";
import { supabase } from "../lib/supabaseClient";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** Expo push token format (ExponentPushToken[xxx]). */
function isExpoToken(token: string): boolean {
  return (
    typeof token === "string" &&
    token.startsWith("ExponentPushToken[") &&
    token.endsWith("]")
  );
}

/** APNs device token: 64 hex chars. Used when backend sends via APNs directly. */
function isAPNsToken(token: string): boolean {
  return (
    typeof token === "string" &&
    /^[a-fA-F0-9]{64}$/.test(token.trim())
  );
}

/** Validate token format. Backend accepts Expo tokens or APNs tokens. */
export function validatePushToken(token: string): {
  valid: boolean;
  type: "expo" | "apns" | "invalid";
} {
  if (!token || typeof token !== "string" || !token.trim()) {
    return { valid: false, type: "invalid" };
  }
  const t = token.trim();
  if (isExpoToken(t)) return { valid: true, type: "expo" };
  if (isAPNsToken(t)) return { valid: true, type: "apns" };
  return { valid: false, type: "invalid" };
}

type DeviceTokenPayload = {
  userId: string;
  organizationId: string;
  token: string;
  platform?: string;
};

export async function registerDeviceToken({
  userId,
  organizationId,
  token,
  platform,
}: DeviceTokenPayload) {
  if (!token) return;

  const { valid } = validatePushToken(token);
  if (!valid) {
    throw new Error("INVALID_TOKEN");
  }

  const { error } = await supabase
    .from("device_tokens")
    .upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        token,
        platform: platform ?? null,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

  if (error) {
    console.error("Device token upsert failed:", error);
  }
}

export async function unregisterDeviceToken(token: string) {
  const { error } = await supabase
    .from("device_tokens")
    .delete()
    .eq("token", token);

  if (error) {
    console.error("Device token delete failed:", error);
  }
}

async function fetchOrgTokens(organizationId: string) {
  const { data, error } = await supabase
    .from("device_tokens")
    .select("token")
    .eq("organization_id", organizationId);

  if (error) {
    console.error("Failed to load device tokens:", error);
    return [];
  }

  return (data || []).map((row) => row.token);
}

/** Fetch org user IDs who have the given preference enabled, push_enabled on, and at least one device token. */
async function fetchOrgUserIdsWithPreference(
  organizationId: string,
  prefKey: keyof NotificationPreferences
): Promise<string[]> {
  const { data: tokensData, error: tokensError } = await supabase
    .from("device_tokens")
    .select("token, user_id")
    .eq("organization_id", organizationId);

  if (tokensError || !tokensData?.length) return [];

  const userIds = [...new Set(tokensData.map((r) => r.user_id))];
  const { data: prefsData } = await supabase
    .from("notification_preferences")
    .select("user_id, push_enabled, " + prefKey)
    .in("user_id", userIds);

  const prefsByUser = new Map<
    string,
    { push_enabled: boolean; prefValue: boolean }
  >(
    (prefsData || []).map((r: any) => {
      const push_enabled = r.push_enabled ?? true;
      const prefValue =
        prefKey === "weekly_summary_enabled"
          ? (r[prefKey] ?? false)
          : (r[prefKey] ?? true);
      return [r.user_id, { push_enabled, prefValue }];
    })
  );

  return [
    ...new Set(
      tokensData
        .filter((r) => {
          const effective = prefsByUser.get(r.user_id);
          const push_enabled = effective
            ? effective.push_enabled
            : DEFAULT_NOTIFICATION_PREFERENCES.push_enabled;
          const prefEnabled = effective
            ? effective.prefValue
            : DEFAULT_NOTIFICATION_PREFERENCES[prefKey];
          return push_enabled && prefEnabled;
        })
        .map((r) => r.user_id)
    ),
  ];
}

/** Default notification preferences. Master toggles on; weekly_summary off per spec; others on. */
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  push_enabled: true,
  email_enabled: true,
  mentions_enabled: true,
  job_assigned_enabled: true,
  signature_request_enabled: true,
  evidence_uploaded_enabled: true,
  hazard_added_enabled: true,
  deadline_enabled: true,
  weekly_summary_enabled: false,
  high_risk_job_enabled: true,
  report_ready_enabled: true,
} as const;

export type NotificationPreferences = typeof DEFAULT_NOTIFICATION_PREFERENCES;

/** Fetch notification preferences for a user; returns defaults if no row exists. */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load notification preferences:", error);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  if (!data) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

  return {
    push_enabled: data.push_enabled ?? true,
    email_enabled: data.email_enabled ?? true,
    mentions_enabled: data.mentions_enabled ?? true,
    job_assigned_enabled: data.job_assigned_enabled ?? true,
    signature_request_enabled: data.signature_request_enabled ?? true,
    evidence_uploaded_enabled: data.evidence_uploaded_enabled ?? true,
    hazard_added_enabled: data.hazard_added_enabled ?? true,
    deadline_enabled: data.deadline_enabled ?? true,
    weekly_summary_enabled: data.weekly_summary_enabled ?? false,
    high_risk_job_enabled: data.high_risk_job_enabled ?? true,
    report_ready_enabled: data.report_ready_enabled ?? true,
  };
}

/** Fetch push tokens for a single user (for targeted notifications). */
export async function fetchUserTokens(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("device_tokens")
    .select("token")
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to load user device tokens:", error);
    return [];
  }

  return (data || []).map((row) => row.token);
}

/** Get unread notification count for a user (for badge in push payloads). */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("Failed to get unread notification count:", error);
    return 0;
  }
  return typeof count === "number" ? count : 0;
}

/** Create a notification record so unread count and badge stay in sync. Returns the new notification id for push payload (data.id). */
export async function createNotificationRecord(
  userId: string,
  type: string,
  content: string,
  deepLink?: string | null
): Promise<string | null> {
  const { data: inserted, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      content,
      is_read: false,
      ...(deepLink != null && deepLink !== "" && { deep_link: deepLink }),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create notification record:", error);
    return null;
  }
  return inserted?.id ?? null;
}

/** List notifications for a user with pagination (newest first). Includes deepLink for navigation. */
export async function listNotifications(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{
  data: Array<{
    id: string;
    type: string;
    content: string;
    is_read: boolean;
    created_at: string;
    deepLink?: string | null;
  }>;
}> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, content, is_read, created_at, deep_link")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Failed to list notifications:", error);
    return { data: [] };
  }
  return {
    data: (data || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      content: row.content,
      is_read: !!row.is_read,
      created_at: row.created_at,
      deepLink: row.deep_link ?? null,
    })),
  };
}

/** Mark notifications as read: all for the user, or by id(s). Updates is_read and updated_at. */
export async function markNotificationsAsRead(
  userId: string,
  ids?: string[]
): Promise<void> {
  const query = supabase
    .from("notifications")
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (ids?.length) {
    query.in("id", ids);
  }

  const { error } = await query;
  if (error) {
    console.error("Failed to mark notifications as read:", error);
  }
}

let apnProvider: apn.Provider | null = null;

function getAPnProvider(): apn.Provider | null {
  if (apnProvider) return apnProvider;
  const keyPath = process.env.APNS_KEY_PATH;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!keyPath || !keyId || !teamId) {
    return null;
  }
  try {
    if (!fs.existsSync(keyPath)) {
      console.error("[Notifications] APNs key file not found:", keyPath);
      return null;
    }
    const keyContents = fs.readFileSync(keyPath, "utf8");
    apnProvider = new apn.Provider({
      token: {
        key: keyContents,
        keyId,
        teamId,
      },
      production: process.env.APNS_PRODUCTION === "true",
    });
    return apnProvider;
  } catch (err) {
    console.error("APNs provider init failed:", err);
    return null;
  }
}

async function sendAPNs(
  tokens: string[],
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    badge?: number;
    priority?: "high" | "default";
    categoryId?: string;
  }
) {
  if (!tokens.length) return;
  const provider = getAPnProvider();
  if (!provider) {
    if (tokens.length > 0) {
      console.warn(
        "[Notifications] APNs tokens present but APNs not configured (APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID). iOS push will not be delivered."
      );
    }
    return;
  }
  const bundleId = process.env.APNS_BUNDLE_ID || "com.riskmate.Riskmate";
  for (const token of tokens) {
    try {
      const notification = new apn.Notification();
      notification.alert = { title: payload.title, body: payload.body };
      notification.sound = "default";
      notification.topic = bundleId;
      if (typeof payload.badge === "number") {
        notification.badge = payload.badge;
      }
      if (payload.priority === "high") {
        notification.priority = 10;
      } else if (payload.priority === "default") {
        notification.priority = 5;
      }
      if (payload.categoryId) {
        notification.aps = { ...(notification.aps || {}), category: payload.categoryId };
      }
      if (payload.data) {
        notification.payload = payload.data;
      }
      const result = await provider.send(notification, token);
      if (result.failed.length > 0) {
        console.warn("[Notifications] APNs send failed for token:", result.failed[0].response?.reason);
      }
    } catch (err) {
      console.error("[Notifications] APNs exception:", err);
    }
  }
}

async function sendExpoPush(
  tokens: string[],
  message: Record<string, unknown> & { badge?: number; categoryId?: string }
) {
  if (!tokens.length) return;

  for (const chunk of chunkArray(tokens, 50)) {
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          chunk.map((token) => ({
            to: token,
            sound: "default",
            channelId: message.channelId ?? "riskmate-alerts",
            ...(typeof message.badge === "number" && { badge: message.badge }),
            ...(message.categoryId && { categoryId: message.categoryId }),
            ...message,
          }))
        ),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error("Expo push failed:", result);
      }
    } catch (err) {
      console.error("Expo push exception:", err);
    }
  }
}

/** Split tokens by type and send via appropriate channel (Expo vs APNs). */
async function sendPush(
  tokens: string[],
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: string;
    channelId?: string;
    badge?: number;
    priority?: "high" | "default";
    categoryId?: string;
  }
) {
  const expoTokens: string[] = [];
  const apnsTokens: string[] = [];
  for (const t of tokens) {
    const { valid, type } = validatePushToken(t);
    if (!valid) continue;
    if (type === "expo") expoTokens.push(t);
    else if (type === "apns") apnsTokens.push(t);
  }

  if (expoTokens.length > 0) {
    await sendExpoPush(expoTokens, {
      title: payload.title,
      body: payload.body,
      sound: payload.sound ?? "default",
      channelId: payload.channelId ?? payload.categoryId ?? "riskmate-alerts",
      categoryId: payload.categoryId,
      ...(typeof payload.badge === "number" && { badge: payload.badge }),
      data: payload.data,
    });
  }

  if (apnsTokens.length > 0) {
    await sendAPNs(apnsTokens, {
      title: payload.title,
      body: payload.body,
      data: payload.data,
      ...(typeof payload.badge === "number" && { badge: payload.badge }),
      ...(payload.priority && { priority: payload.priority }),
      ...(payload.categoryId && { categoryId: payload.categoryId }),
    });
  }
}

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export async function notifyHighRiskJob(params: {
  organizationId: string;
  jobId: string;
  clientName: string;
  riskScore: number;
}) {
  if (params.riskScore < 75) return;

  const userIds = await fetchOrgUserIdsWithPreference(
    params.organizationId,
    "high_risk_job_enabled"
  );
  const payload: PushPayload = {
    title: "⚠️ High-risk job detected",
    body: `${params.clientName} scored ${params.riskScore}. Review mitigation plan now.`,
    data: {
      type: "high_risk_job",
      jobId: params.jobId,
      deepLink: `riskmate://jobs/${params.jobId}`,
    },
    priority: "default",
  };
  for (const userId of userIds) {
    await sendToUser(userId, payload);
  }
}

export async function notifyReportReady(params: {
  organizationId: string;
  jobId: string;
  pdfUrl?: string | null;
}) {
  const userIds = await fetchOrgUserIdsWithPreference(
    params.organizationId,
    "report_ready_enabled"
  );
  const payload: PushPayload = {
    title: "📄 Risk report ready",
    body: "Your Riskmate PDF report is ready to view.",
    data: {
      type: "report_ready",
      jobId: params.jobId,
      pdfUrl: params.pdfUrl,
      deepLink: `riskmate://jobs/${params.jobId}`,
    },
    priority: "default",
  };
  for (const userId of userIds) {
    await sendToUser(userId, payload);
  }
}

export async function notifyWeeklySummary(params: {
  organizationId: string;
  message: string;
}) {
  const userIds = await fetchOrgUserIdsWithPreference(
    params.organizationId,
    "weekly_summary_enabled"
  );
  const payload: PushPayload = {
    title: "📈 Weekly compliance summary",
    body: params.message,
    data: {
      type: "weekly_summary",
    },
    priority: "default",
  };
  for (const userId of userIds) {
    await sendToUser(userId, payload);
  }
}

// ----- Targeted (per-user) notifications with deep links -----

type PushPayload = {
  title: string;
  body: string;
  data: Record<string, unknown>;
  badge?: number;
  categoryId?: string;
  priority?: "high" | "default";
};

async function sendToUser(userId: string, payload: PushPayload) {
  const prefs = await getNotificationPreferences(userId);

  // Always create notification record and update badge so Notification Center and badges stay in sync.
  const notificationType =
    typeof payload.data?.type === "string" ? (payload.data.type as string) : "push";
  const deepLink =
    typeof payload.data?.deepLink === "string" ? (payload.data.deepLink as string) : undefined;
  const notificationId = await createNotificationRecord(
    userId,
    notificationType,
    payload.body,
    deepLink
  );

  const badge = await getUnreadNotificationCount(userId);

  // Include notification id in push payload so tap marks only this one as read; include deepLink for routing.
  const pushData = {
    ...payload.data,
    ...(notificationId && { id: notificationId }),
  };

  // Gate only push delivery (Expo/APNs) on push_enabled; in-app history is always recorded.
  if (prefs.push_enabled) {
    const tokens = await fetchUserTokens(userId);
    if (tokens.length > 0) {
      await sendPush(tokens, {
        title: payload.title,
        body: payload.body,
        data: pushData,
        sound: "default",
        channelId: payload.categoryId ?? "riskmate-alerts",
        badge,
        priority: payload.priority ?? "default",
        categoryId: payload.categoryId,
      });
    }
  }
}

/** Notify user when they are assigned to a job. */
export async function sendJobAssignedNotification(
  userId: string,
  jobId: string,
  jobTitle?: string
) {
  const prefs = await getNotificationPreferences(userId);
  if (!prefs.job_assigned_enabled) return;
  await sendToUser(userId, {
    title: "Job Assigned",
    body: jobTitle
      ? `You've been assigned to '${jobTitle}'`
      : "You've been assigned to a new job.",
    data: {
      type: "job_assigned",
      jobId,
      deepLink: `riskmate://jobs/${jobId}`,
    },
    categoryId: "job_assigned",
    priority: "default",
  });
}

/** Notify user when their signature is requested on a report run. */
export async function sendSignatureRequestNotification(
  userId: string,
  reportRunId: string,
  jobTitle?: string
) {
  const prefs = await getNotificationPreferences(userId);
  if (!prefs.signature_request_enabled) return;
  await sendToUser(userId, {
    title: "Signature Requested",
    body: jobTitle
      ? `Your signature is requested for '${jobTitle}'`
      : "Your signature is requested for a report.",
    data: {
      type: "signature_request",
      reportRunId,
      deepLink: `riskmate://reports/${reportRunId}`,
    },
    categoryId: "signature_request",
    priority: "high",
  });
}

/** Notify user when evidence is uploaded to a job they care about. */
export async function sendEvidenceUploadedNotification(
  userId: string,
  jobId: string,
  photoId: string
) {
  const prefs = await getNotificationPreferences(userId);
  if (!prefs.evidence_uploaded_enabled) return;
  await sendToUser(userId, {
    title: "Evidence Uploaded",
    body: "New evidence was added to a job.",
    data: {
      type: "evidence_uploaded",
      jobId,
      photoId,
      deepLink: `riskmate://jobs/${jobId}/evidence`,
    },
    categoryId: "evidence_uploaded",
    priority: "default",
  });
}

/** Notify user when a hazard is added to a job. */
export async function sendHazardAddedNotification(
  userId: string,
  jobId: string,
  hazardId: string
) {
  const prefs = await getNotificationPreferences(userId);
  if (!prefs.hazard_added_enabled) return;
  await sendToUser(userId, {
    title: "Hazard Added",
    body: "A new hazard was added to a job.",
    data: {
      type: "hazard_added",
      jobId,
      hazardId,
      deepLink: `riskmate://jobs/${jobId}/hazards/${hazardId}`,
    },
    categoryId: "hazard_added",
    priority: "default",
  });
}

/** Notify user about an approaching job deadline. */
export async function sendDeadlineNotification(
  userId: string,
  jobId: string,
  hoursRemaining: number,
  jobTitle?: string
) {
  const prefs = await getNotificationPreferences(userId);
  if (!prefs.deadline_enabled) return;
  const h = Math.round(hoursRemaining);
  const text =
    h <= 0
      ? "Due now"
      : h < 24
        ? `Due in ${h} hour${h === 1 ? "" : "s"}`
        : `Due in ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? "" : "s"}`;
  await sendToUser(userId, {
    title: "Deadline Approaching",
    body: jobTitle ? `'${jobTitle}' – ${text}` : text,
    data: {
      type: "deadline",
      jobId,
      hoursRemaining,
      deepLink: `riskmate://jobs/${jobId}`,
    },
    categoryId: "deadline",
    priority: "high",
  });
}

/** Notify user when they are mentioned in a comment. */
export async function sendMentionNotification(
  userId: string,
  commentId: string,
  contextLabel?: string
) {
  const prefs = await getNotificationPreferences(userId);
  if (!prefs.mentions_enabled) return;
  await sendToUser(userId, {
    title: "You were mentioned",
    body: contextLabel ?? "Someone mentioned you in a comment.",
    data: {
      type: "mention",
      commentId,
      deepLink: `riskmate://comments/${commentId}`,
    },
    categoryId: "mention",
    priority: "high",
  });
}

