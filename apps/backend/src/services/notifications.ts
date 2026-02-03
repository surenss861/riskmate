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

