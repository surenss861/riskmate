import { supabase } from "../lib/supabaseClient";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

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

async function sendExpoPush(tokens: string[], message: Record<string, unknown>) {
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
            channelId: "riskmate-alerts",
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

  const tokens = await fetchOrgTokens(params.organizationId);
  await sendExpoPush(tokens, {
    title: "⚠️ High-risk job detected",
    body: `${params.clientName} scored ${params.riskScore}. Review mitigation plan now.`,
    data: {
      type: "high_risk_job",
      jobId: params.jobId,
    },
  });
}

export async function notifyReportReady(params: {
  organizationId: string;
  jobId: string;
  pdfUrl?: string | null;
}) {
  const tokens = await fetchOrgTokens(params.organizationId);
  await sendExpoPush(tokens, {
    title: "📄 Risk report ready",
    body: "Your Riskmate PDF report is ready to view.",
    data: {
      type: "report_ready",
      jobId: params.jobId,
      pdfUrl: params.pdfUrl,
    },
  });
}

export async function notifyWeeklySummary(params: {
  organizationId: string;
  message: string;
}) {
  const tokens = await fetchOrgTokens(params.organizationId);
  await sendExpoPush(tokens, {
    title: "📈 Weekly compliance summary",
    body: params.message,
    data: {
      type: "weekly_summary",
    },
  });
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
  const tokens = await fetchUserTokens(userId);
  if (!tokens.length) return;
  await sendExpoPush(tokens, {
    ...payload,
    sound: "default",
    channelId: payload.categoryId ?? "riskmate-alerts",
    priority: payload.priority ?? "high",
  });
}

/** Notify user when they are assigned to a job. */
export async function sendJobAssignedNotification(
  userId: string,
  jobId: string,
  jobTitle?: string
) {
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
  });
}

/** Notify user when their signature is requested on a report run. */
export async function sendSignatureRequestNotification(
  userId: string,
  reportRunId: string,
  jobTitle?: string
) {
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
  });
}

/** Notify user when evidence is uploaded to a job they care about. */
export async function sendEvidenceUploadedNotification(
  userId: string,
  jobId: string,
  photoId: string
) {
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
  });
}

/** Notify user when a hazard is added to a job. */
export async function sendHazardAddedNotification(
  userId: string,
  jobId: string,
  hazardId: string
) {
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
  });
}

/** Notify user about an approaching job deadline. */
export async function sendDeadlineNotification(
  userId: string,
  jobId: string,
  hoursRemaining: number,
  jobTitle?: string
) {
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
  });
}

/** Notify user when they are mentioned in a comment. */
export async function sendMentionNotification(
  userId: string,
  commentId: string,
  contextLabel?: string
) {
  await sendToUser(userId, {
    title: "You were mentioned",
    body: contextLabel ?? "Someone mentioned you in a comment.",
    data: {
      type: "mention",
      commentId,
      deepLink: "riskmate://notifications",
    },
    categoryId: "mention",
  });
}

