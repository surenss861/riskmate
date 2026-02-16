"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NOTIFICATION_PREFERENCES = void 0;
exports.validatePushToken = validatePushToken;
exports.registerDeviceToken = registerDeviceToken;
exports.unregisterDeviceToken = unregisterDeviceToken;
exports.getNotificationPreferences = getNotificationPreferences;
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
const apn_1 = __importDefault(require("apn"));
const supabaseClient_1 = require("../lib/supabaseClient");
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
/** Expo push token format (ExponentPushToken[xxx]). */
function isExpoToken(token) {
    return (typeof token === "string" &&
        token.startsWith("ExponentPushToken[") &&
        token.endsWith("]"));
}
/** APNs device token: 64 hex chars. Used when backend sends via APNs directly. */
function isAPNsToken(token) {
    return (typeof token === "string" &&
        /^[a-fA-F0-9]{64}$/.test(token.trim()));
}
/** Validate token format. Backend accepts Expo tokens or APNs tokens. */
function validatePushToken(token) {
    if (!token || typeof token !== "string" || !token.trim()) {
        return { valid: false, type: "invalid" };
    }
    const t = token.trim();
    if (isExpoToken(t))
        return { valid: true, type: "expo" };
    if (isAPNsToken(t))
        return { valid: true, type: "apns" };
    return { valid: false, type: "invalid" };
}
async function registerDeviceToken({ userId, organizationId, token, platform, }) {
    if (!token)
        return;
    const { valid } = validatePushToken(token);
    if (!valid) {
        throw new Error("INVALID_TOKEN");
    }
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
/** Fetch org device tokens only for users who have the given preference enabled. */
async function fetchOrgTokensWithPreference(organizationId, prefKey) {
    const { data: tokensData, error: tokensError } = await supabaseClient_1.supabase
        .from("device_tokens")
        .select("token, user_id")
        .eq("organization_id", organizationId);
    if (tokensError || !tokensData?.length)
        return [];
    const userIds = [...new Set(tokensData.map((r) => r.user_id))];
    const { data: prefsData } = await supabaseClient_1.supabase
        .from("notification_preferences")
        .select("user_id, " + prefKey)
        .in("user_id", userIds);
    const prefsByUser = new Map((prefsData || []).map((r) => [r.user_id, r[prefKey] !== false]));
    return tokensData
        .filter((r) => prefsByUser.get(r.user_id) !== false)
        .map((r) => r.token);
}
/** Default notification preferences (all enabled). */
exports.DEFAULT_NOTIFICATION_PREFERENCES = {
    mentions_enabled: true,
    job_assigned_enabled: true,
    signature_request_enabled: true,
    evidence_uploaded_enabled: true,
    hazard_added_enabled: true,
    deadline_enabled: true,
    weekly_summary_enabled: true,
    high_risk_job_enabled: true,
    report_ready_enabled: true,
};
/** Fetch notification preferences for a user; returns defaults if no row exists. */
async function getNotificationPreferences(userId) {
    const { data, error } = await supabaseClient_1.supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) {
        console.error("Failed to load notification preferences:", error);
        return { ...exports.DEFAULT_NOTIFICATION_PREFERENCES };
    }
    if (!data)
        return { ...exports.DEFAULT_NOTIFICATION_PREFERENCES };
    return {
        mentions_enabled: data.mentions_enabled ?? true,
        job_assigned_enabled: data.job_assigned_enabled ?? true,
        signature_request_enabled: data.signature_request_enabled ?? true,
        evidence_uploaded_enabled: data.evidence_uploaded_enabled ?? true,
        hazard_added_enabled: data.hazard_added_enabled ?? true,
        deadline_enabled: data.deadline_enabled ?? true,
        weekly_summary_enabled: data.weekly_summary_enabled ?? true,
        high_risk_job_enabled: data.high_risk_job_enabled ?? true,
        report_ready_enabled: data.report_ready_enabled ?? true,
    };
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
let apnProvider = null;
function getAPnProvider() {
    if (apnProvider)
        return apnProvider;
    const keyPath = process.env.APNS_KEY_PATH;
    const keyId = process.env.APNS_KEY_ID;
    const teamId = process.env.APNS_TEAM_ID;
    if (!keyPath || !keyId || !teamId) {
        return null;
    }
    try {
        apnProvider = new apn_1.default.Provider({
            token: {
                key: keyPath,
                keyId,
                teamId,
            },
            production: process.env.APNS_PRODUCTION === "true",
        });
        return apnProvider;
    }
    catch (err) {
        console.error("APNs provider init failed:", err);
        return null;
    }
}
async function sendAPNs(tokens, payload) {
    if (!tokens.length)
        return;
    const provider = getAPnProvider();
    if (!provider) {
        if (tokens.length > 0) {
            console.warn("[Notifications] APNs tokens present but APNs not configured (APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID). iOS push will not be delivered.");
        }
        return;
    }
    const bundleId = process.env.APNS_BUNDLE_ID || "com.riskmate.Riskmate";
    for (const token of tokens) {
        try {
            const notification = new apn_1.default.Notification();
            notification.alert = { title: payload.title, body: payload.body };
            notification.sound = "default";
            notification.topic = bundleId;
            if (payload.data) {
                notification.payload = payload.data;
            }
            const result = await provider.send(notification, token);
            if (result.failed.length > 0) {
                console.warn("[Notifications] APNs send failed for token:", result.failed[0].response?.reason);
            }
        }
        catch (err) {
            console.error("[Notifications] APNs exception:", err);
        }
    }
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
/** Split tokens by type and send via appropriate channel (Expo vs APNs). */
async function sendPush(tokens, payload) {
    const expoTokens = [];
    const apnsTokens = [];
    for (const t of tokens) {
        const { valid, type } = validatePushToken(t);
        if (!valid)
            continue;
        if (type === "expo")
            expoTokens.push(t);
        else if (type === "apns")
            apnsTokens.push(t);
    }
    if (expoTokens.length > 0) {
        await sendExpoPush(expoTokens, {
            title: payload.title,
            body: payload.body,
            sound: payload.sound ?? "default",
            channelId: payload.channelId ?? "riskmate-alerts",
            data: payload.data,
        });
    }
    if (apnsTokens.length > 0) {
        await sendAPNs(apnsTokens, {
            title: payload.title,
            body: payload.body,
            data: payload.data,
        });
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
    const tokens = await fetchOrgTokensWithPreference(params.organizationId, "high_risk_job_enabled");
    await sendPush(tokens, {
        title: "⚠️ High-risk job detected",
        body: `${params.clientName} scored ${params.riskScore}. Review mitigation plan now.`,
        data: {
            type: "high_risk_job",
            jobId: params.jobId,
        },
    });
}
async function notifyReportReady(params) {
    const tokens = await fetchOrgTokensWithPreference(params.organizationId, "report_ready_enabled");
    await sendPush(tokens, {
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
    const tokens = await fetchOrgTokensWithPreference(params.organizationId, "weekly_summary_enabled");
    await sendPush(tokens, {
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
    await sendPush(tokens, {
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: "default",
        channelId: payload.categoryId ?? "riskmate-alerts",
    });
}
/** Notify user when they are assigned to a job. */
async function sendJobAssignedNotification(userId, jobId, jobTitle) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.job_assigned_enabled)
        return;
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
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.signature_request_enabled)
        return;
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
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.evidence_uploaded_enabled)
        return;
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
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.hazard_added_enabled)
        return;
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
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.deadline_enabled)
        return;
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
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.mentions_enabled)
        return;
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