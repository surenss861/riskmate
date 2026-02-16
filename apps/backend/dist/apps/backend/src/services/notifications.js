"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDeviceToken = registerDeviceToken;
exports.unregisterDeviceToken = unregisterDeviceToken;
exports.fetchUserTokens = fetchUserTokens;
exports.notifyHighRiskJob = notifyHighRiskJob;
exports.notifyReportReady = notifyReportReady;
exports.notifyWeeklySummary = notifyWeeklySummary;
exports.sendJobAssignedNotification = sendJobAssignedNotification;
exports.sendSignatureRequestNotification = sendSignatureRequestNotification;
exports.sendEvidenceUploadedNotification = sendEvidenceUploadedNotification;
exports.sendHazardAddedNotification = sendHazardAddedNotification;
exports.sendDeadlineNotification = sendDeadlineNotification;
exports.sendMentionNotification = sendMentionNotification;
const supabaseClient_1 = require("../lib/supabaseClient");
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
async function registerDeviceToken({ userId, organizationId, token, platform, }) {
    if (!token)
        return;
    const { error } = await supabaseClient_1.supabase
        .from("device_tokens")
        .upsert({
        user_id: userId,
        organization_id: organizationId,
        token,
        platform: platform ?? null,
        last_seen: new Date().toISOString(),
    }, { onConflict: "token" });
    if (error) {
        console.error("Device token upsert failed:", error);
    }
}
async function unregisterDeviceToken(token) {
    const { error } = await supabaseClient_1.supabase
        .from("device_tokens")
        .delete()
        .eq("token", token);
    if (error) {
        console.error("Device token delete failed:", error);
    }
}
async function fetchOrgTokens(organizationId) {
    const { data, error } = await supabaseClient_1.supabase
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
async function fetchUserTokens(userId) {
    const { data, error } = await supabaseClient_1.supabase
        .from("device_tokens")
        .select("token")
        .eq("user_id", userId);
    if (error) {
        console.error("Failed to load user device tokens:", error);
        return [];
    }
    return (data || []).map((row) => row.token);
}
async function sendExpoPush(tokens, message) {
    if (!tokens.length)
        return;
    for (const chunk of chunkArray(tokens, 50)) {
        try {
            const response = await fetch(EXPO_PUSH_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(chunk.map((token) => ({
                    to: token,
                    sound: "default",
                    channelId: "riskmate-alerts",
                    ...message,
                }))),
            });
            const result = await response.json();
            if (!response.ok) {
                console.error("Expo push failed:", result);
            }
        }
        catch (err) {
            console.error("Expo push exception:", err);
        }
    }
}
const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};
async function notifyHighRiskJob(params) {
    if (params.riskScore < 75)
        return;
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
async function notifyReportReady(params) {
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
async function notifyWeeklySummary(params) {
    const tokens = await fetchOrgTokens(params.organizationId);
    await sendExpoPush(tokens, {
        title: "📈 Weekly compliance summary",
        body: params.message,
        data: {
            type: "weekly_summary",
        },
    });
}
async function sendToUser(userId, payload) {
    const tokens = await fetchUserTokens(userId);
    if (!tokens.length)
        return;
    await sendExpoPush(tokens, {
        ...payload,
        sound: "default",
        channelId: payload.categoryId ?? "riskmate-alerts",
        priority: payload.priority ?? "high",
    });
}
/** Notify user when they are assigned to a job. */
async function sendJobAssignedNotification(userId, jobId, jobTitle) {
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
async function sendSignatureRequestNotification(userId, reportRunId, jobTitle) {
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
async function sendEvidenceUploadedNotification(userId, jobId, photoId) {
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
async function sendHazardAddedNotification(userId, jobId, hazardId) {
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
async function sendDeadlineNotification(userId, jobId, hoursRemaining, jobTitle) {
    const h = Math.round(hoursRemaining);
    const text = h <= 0
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
async function sendMentionNotification(userId, commentId, contextLabel) {
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
//# sourceMappingURL=notifications.js.map