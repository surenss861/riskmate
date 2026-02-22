"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPT_OUT_SAFE_PREFERENCES = exports.DEFAULT_NOTIFICATION_PREFERENCES = void 0;
exports.validatePushToken = validatePushToken;
exports.registerDeviceToken = registerDeviceToken;
exports.unregisterDeviceToken = unregisterDeviceToken;
exports.getNotificationPreferences = getNotificationPreferences;
exports.fetchUserTokens = fetchUserTokens;
exports.getUnreadNotificationCount = getUnreadNotificationCount;
exports.createNotificationRecord = createNotificationRecord;
exports.listNotifications = listNotifications;
exports.setNotificationsReadState = setNotificationsReadState;
exports.markNotificationsAsRead = markNotificationsAsRead;
exports.notifyHighRiskJob = notifyHighRiskJob;
exports.notifyReportReady = notifyReportReady;
exports.notifyWeeklySummary = notifyWeeklySummary;
exports.sendJobAssignedNotification = sendJobAssignedNotification;
exports.sendTaskAssignedNotification = sendTaskAssignedNotification;
exports.sendTaskCompletedNotification = sendTaskCompletedNotification;
exports.sendTaskOverdueNotification = sendTaskOverdueNotification;
exports.sendTaskDueSoonNotification = sendTaskDueSoonNotification;
exports.sendSignatureRequestNotification = sendSignatureRequestNotification;
exports.sendEvidenceUploadedNotification = sendEvidenceUploadedNotification;
exports.sendHazardAddedNotification = sendHazardAddedNotification;
exports.sendDeadlineNotification = sendDeadlineNotification;
exports.sendMentionNotification = sendMentionNotification;
exports.sendCommentReplyNotification = sendCommentReplyNotification;
exports.sendJobCommentNotification = sendJobCommentNotification;
exports.sendCommentResolvedNotification = sendCommentResolvedNotification;
const fs_1 = __importDefault(require("fs"));
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
/** Returns true if upsert succeeded, false on Supabase failure. Throws on invalid token. */
async function registerDeviceToken({ userId, organizationId, token, platform, }) {
    if (!token)
        return false;
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
    }, { onConflict: "token,user_id,organization_id" });
    if (error) {
        console.error("Device token upsert failed:", error);
        return false;
    }
    return true;
}
async function unregisterDeviceToken(token, userId, organizationId) {
    const { data, error } = await supabaseClient_1.supabase
        .from("device_tokens")
        .delete()
        .eq("token", token)
        .eq("user_id", userId)
        .eq("organization_id", organizationId)
        .select("id");
    if (error) {
        console.error("Device token delete failed:", error);
        return false;
    }
    return (data?.length ?? 0) > 0;
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
/** Fetch org user IDs who have the given preference enabled, push_enabled on, and at least one device token. */
async function fetchOrgUserIdsWithPreference(organizationId, prefKey) {
    const { data: tokensData, error: tokensError } = await supabaseClient_1.supabase
        .from("device_tokens")
        .select("token, user_id")
        .eq("organization_id", organizationId);
    if (tokensError || !tokensData?.length)
        return [];
    const userIds = [...new Set(tokensData.map((r) => r.user_id))];
    const { data: prefsData } = await supabaseClient_1.supabase
        .from("notification_preferences")
        .select("user_id, push_enabled, " + prefKey)
        .in("user_id", userIds);
    const defaultFalseKeys = [
        "weekly_summary",
    ];
    const prefsByUser = new Map((prefsData || []).map((r) => {
        const push_enabled = r.push_enabled ?? true;
        const prefValue = defaultFalseKeys.includes(prefKey)
            ? (r[prefKey] ?? false)
            : (r[prefKey] ?? true);
        return [r.user_id, { push_enabled, prefValue }];
    }));
    return [
        ...new Set(tokensData
            .filter((r) => {
            const effective = prefsByUser.get(r.user_id);
            const push_enabled = effective
                ? effective.push_enabled
                : exports.DEFAULT_NOTIFICATION_PREFERENCES.push_enabled;
            const prefEnabled = effective
                ? effective.prefValue
                : exports.DEFAULT_NOTIFICATION_PREFERENCES[prefKey];
            return push_enabled && prefEnabled;
        })
            .map((r) => r.user_id)),
    ];
}
exports.DEFAULT_NOTIFICATION_PREFERENCES = {
    push_enabled: true,
    email_enabled: true,
    mention: true,
    reply: true,
    job_assigned: true,
    signature_requested: true,
    evidence_uploaded: true,
    hazard_added: true,
    deadline_approaching: true,
    email_deadline_reminder: true,
    weekly_summary: false,
    email_weekly_digest: true,
    high_risk_job: true,
    report_ready: true,
    job_comment: true,
    comment_resolved: true,
};
/** Safe opt-out when preferences cannot be loaded (e.g. Supabase error). All delivery disabled to avoid re-enabling push/email for opted-out users. */
exports.OPT_OUT_SAFE_PREFERENCES = {
    push_enabled: false,
    email_enabled: false,
    mention: false,
    reply: false,
    job_assigned: false,
    signature_requested: false,
    evidence_uploaded: false,
    hazard_added: false,
    deadline_approaching: false,
    email_deadline_reminder: false,
    weekly_summary: false,
    email_weekly_digest: false,
    high_risk_job: false,
    report_ready: false,
    job_comment: false,
    comment_resolved: false,
};
/** Fetch notification preferences for a user; returns defaults if no row exists. On Supabase error returns OPT_OUT_SAFE_PREFERENCES so delivery is skipped (fail closed). */
async function getNotificationPreferences(userId) {
    const { data, error } = await supabaseClient_1.supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) {
        console.error("Failed to load notification preferences:", error);
        return { ...exports.OPT_OUT_SAFE_PREFERENCES };
    }
    if (!data)
        return { ...exports.DEFAULT_NOTIFICATION_PREFERENCES };
    return {
        push_enabled: data.push_enabled ?? true,
        email_enabled: data.email_enabled ?? true,
        mention: data.mention ?? true,
        reply: data.reply ?? true,
        job_assigned: data.job_assigned ?? true,
        signature_requested: data.signature_requested ?? true,
        evidence_uploaded: data.evidence_uploaded ?? true,
        hazard_added: data.hazard_added ?? true,
        deadline_approaching: data.deadline_approaching ?? true,
        email_deadline_reminder: data.email_deadline_reminder ?? true,
        weekly_summary: data.weekly_summary ?? false,
        email_weekly_digest: data.email_weekly_digest ?? true,
        high_risk_job: data.high_risk_job ?? true,
        report_ready: data.report_ready ?? true,
        job_comment: data.job_comment ?? true,
        comment_resolved: data.comment_resolved ?? true,
    };
}
/** Fetch push tokens for a single user in a given organization (for targeted notifications). */
async function fetchUserTokens(userId, organizationId) {
    const { data, error } = await supabaseClient_1.supabase
        .from("device_tokens")
        .select("token")
        .eq("user_id", userId)
        .eq("organization_id", organizationId);
    if (error) {
        console.error("Failed to load user device tokens:", error);
        return [];
    }
    return (data || []).map((row) => row.token);
}
/** Get unread notification count for a user in an organization (for badge in push payloads). */
async function getUnreadNotificationCount(userId, organizationId) {
    const { count, error } = await supabaseClient_1.supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("organization_id", organizationId)
        .eq("is_read", false);
    if (error) {
        console.error("Failed to get unread notification count:", error);
        return 0;
    }
    return typeof count === "number" ? count : 0;
}
/** Create a notification record so unread count and badge stay in sync. Returns the new notification id for push payload (data.id). */
async function createNotificationRecord(userId, organizationId, type, content, deepLink) {
    const { data: inserted, error } = await supabaseClient_1.supabase
        .from("notifications")
        .insert({
        user_id: userId,
        organization_id: organizationId,
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
/** List notifications for a user in an organization with pagination (newest first). Includes deepLink for navigation. */
async function listNotifications(userId, organizationId, options = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    let query = supabaseClient_1.supabase
        .from("notifications")
        .select("id, type, content, is_read, created_at, deep_link")
        .eq("user_id", userId)
        .eq("organization_id", organizationId);
    if (options.since) {
        query = query.gte("created_at", options.since);
    }
    const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) {
        console.error("Failed to list notifications:", error);
        return { data: [] };
    }
    return {
        data: (data || []).map((row) => ({
            id: row.id,
            type: row.type,
            content: row.content,
            is_read: !!row.is_read,
            created_at: row.created_at,
            deepLink: row.deep_link ?? null,
        })),
    };
}
/** Set notifications read state: all for the user in the org, or by id(s). Updates is_read and updated_at. */
async function setNotificationsReadState(userId, organizationId, read, ids) {
    const query = supabaseClient_1.supabase
        .from("notifications")
        .update({ is_read: read, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("organization_id", organizationId)
        .eq("is_read", !read);
    if (ids?.length) {
        query.in("id", ids);
    }
    const { error } = await query;
    if (error) {
        console.error("Failed to set notifications read state:", error);
    }
}
/** Mark notifications as read: all for the user in the org, or by id(s). Convenience wrapper. */
async function markNotificationsAsRead(userId, organizationId, ids) {
    await setNotificationsReadState(userId, organizationId, true, ids);
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
        if (!fs_1.default.existsSync(keyPath)) {
            console.error("[Notifications] APNs key file not found:", keyPath);
            return null;
        }
        const keyContents = fs_1.default.readFileSync(keyPath, "utf8");
        apnProvider = new apn_1.default.Provider({
            token: {
                key: keyContents,
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
            if (typeof payload.badge === "number") {
                notification.badge = payload.badge;
            }
            if (payload.priority === "high") {
                notification.priority = 10;
            }
            else if (payload.priority === "default") {
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
                    channelId: message.channelId ?? "riskmate-alerts",
                    ...(typeof message.badge === "number" && { badge: message.badge }),
                    ...(message.categoryId && { categoryId: message.categoryId }),
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
    const userIds = await fetchOrgUserIdsWithPreference(params.organizationId, "high_risk_job");
    const payload = {
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
        await sendToUser(userId, params.organizationId, payload);
    }
}
async function notifyReportReady(params) {
    const userIds = await fetchOrgUserIdsWithPreference(params.organizationId, "report_ready");
    const payload = {
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
        await sendToUser(userId, params.organizationId, payload);
    }
}
async function notifyWeeklySummary(params) {
    const userIds = await fetchOrgUserIdsWithPreference(params.organizationId, "weekly_summary");
    const payload = {
        title: "📈 Weekly compliance summary",
        body: params.message,
        data: {
            type: "weekly_summary",
        },
        priority: "default",
    };
    for (const userId of userIds) {
        await sendToUser(userId, params.organizationId, payload);
    }
}
async function sendToUser(userId, organizationId, payload) {
    const prefs = await getNotificationPreferences(userId);
    // Create notification record first; only proceed with badge/push when a row was created so payload IDs and badge stay in sync.
    const notificationType = typeof payload.data?.type === "string" ? payload.data.type : "push";
    const deepLink = typeof payload.data?.deepLink === "string" ? payload.data.deepLink : undefined;
    const notificationId = await createNotificationRecord(userId, organizationId, notificationType, payload.body, deepLink);
    if (notificationId == null)
        return;
    const badge = await getUnreadNotificationCount(userId, organizationId);
    // Include notification id in push payload so tap marks only this one as read; include deepLink for routing.
    const pushData = {
        ...payload.data,
        ...(notificationId && { id: notificationId }),
    };
    // Gate push delivery (Expo/APNs) on push_enabled; in-app history is always recorded.
    // Only send to tokens registered for this org to avoid cross-org notification leaks.
    if (prefs.push_enabled) {
        const tokens = await fetchUserTokens(userId, organizationId);
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
    // Email delivery is gated on prefs.email_enabled. Any email job/worker that sends
    // notification emails must respect this flag; send email only inside this block.
    if (prefs.email_enabled) {
        // Route-level handlers queue email jobs directly via emailQueue.ts.
        // This block remains a no-op for in-app push delivery.
    }
}
/** Notify user when they are assigned to a job. */
async function sendJobAssignedNotification(userId, organizationId, jobId, jobTitle) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.job_assigned) {
        console.log("[Notifications] Skipped job_assigned for user", userId, "(preference disabled)");
        return;
    }
    await sendToUser(userId, organizationId, {
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
async function sendTaskAssignedNotification(userId, organizationId, taskId, jobTitle, taskTitle) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.job_assigned) {
        console.log("[Notifications] Skipped task_assigned for user", userId, "(preference disabled)");
        return;
    }
    let jobId = null;
    const { data: task } = await supabaseClient_1.supabase
        .from("tasks")
        .select("job_id")
        .eq("id", taskId)
        .maybeSingle();
    if (task?.job_id) {
        jobId = task.job_id;
    }
    await sendToUser(userId, organizationId, {
        title: "Task Assigned",
        body: `You've been assigned '${taskTitle}' on '${jobTitle}'`,
        data: {
            type: "task_assigned",
            taskId,
            deepLink: `riskmate://jobs/${jobId ?? ""}/tasks/${taskId}`,
        },
        categoryId: "task_assigned",
        priority: "default",
    });
}
async function sendTaskCompletedNotification(userId, organizationId, taskId, taskTitle, jobTitle, jobId) {
    void jobTitle;
    const deepLink = jobId != null && jobId !== ""
        ? `riskmate://jobs/${jobId}/tasks?highlight=${taskId}`
        : undefined;
    await sendToUser(userId, organizationId, {
        title: "Task Completed",
        body: `'${taskTitle}' has been completed`,
        data: {
            type: "task_completed",
            taskId,
            ...(deepLink && { deepLink }),
        },
        priority: "default",
    });
}
async function sendTaskOverdueNotification(userId, organizationId, taskId, taskTitle, jobTitle) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.deadline_approaching) {
        console.log("[Notifications] Skipped task_overdue for user", userId, "(preference disabled)");
        return;
    }
    await sendToUser(userId, organizationId, {
        title: "Task Overdue",
        body: `'${taskTitle}' on '${jobTitle}' is overdue`,
        data: {
            type: "task_overdue",
            taskId,
        },
        priority: "high",
        categoryId: "deadline",
    });
}
/** Notify assignee that a task is due within 24 hours (push only; caller should queue email separately). */
async function sendTaskDueSoonNotification(userId, organizationId, taskId, taskTitle, jobTitle, hoursRemaining) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.deadline_approaching) {
        console.log("[Notifications] Skipped task_due_soon for user", userId, "(preference disabled)");
        return;
    }
    const h = Math.max(0, Math.round(hoursRemaining));
    const text = h <= 0 ? "Due now" : h === 1 ? "Due in 1 hour" : `Due in ${h} hours`;
    await sendToUser(userId, organizationId, {
        title: "Task due soon",
        body: `'${taskTitle}' on '${jobTitle}' – ${text}`,
        data: {
            type: "task_due_soon",
            taskId,
        },
        priority: "high",
        categoryId: "deadline",
    });
}
/** Notify user when their signature is requested on a report run. */
async function sendSignatureRequestNotification(userId, organizationId, reportRunId, jobTitle) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.signature_requested) {
        console.log("[Notifications] Skipped signature_request for user", userId, "(preference disabled)");
        return;
    }
    await sendToUser(userId, organizationId, {
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
async function sendEvidenceUploadedNotification(userId, organizationId, jobId, photoId) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.evidence_uploaded) {
        console.log("[Notifications] Skipped evidence_uploaded for user", userId, "(preference disabled)");
        return;
    }
    await sendToUser(userId, organizationId, {
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
async function sendHazardAddedNotification(userId, organizationId, jobId, hazardId) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.hazard_added) {
        console.log("[Notifications] Skipped hazard_added for user", userId, "(preference disabled)");
        return;
    }
    await sendToUser(userId, organizationId, {
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
async function sendDeadlineNotification(userId, organizationId, jobId, hoursRemaining, jobTitle) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.deadline_approaching) {
        console.log("[Notifications] Skipped deadline for user", userId, "(preference disabled)");
        return;
    }
    const h = Math.round(hoursRemaining);
    const text = h <= 0
        ? "Due now"
        : h < 24
            ? `Due in ${h} hour${h === 1 ? "" : "s"}`
            : `Due in ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? "" : "s"}`;
    await sendToUser(userId, organizationId, {
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
async function sendMentionNotification(userId, organizationId, commentId, contextLabel) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.mention) {
        console.log("[Notifications] Skipped mention for user", userId, "(preference disabled)");
        return;
    }
    await sendToUser(userId, organizationId, {
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
/** Notify user when someone replies to their comment. */
async function sendCommentReplyNotification(userId, organizationId, commentId, contextLabel) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.reply) {
        console.log("[Notifications] Skipped reply for user", userId, "(preference disabled)");
        return;
    }
    await sendToUser(userId, organizationId, {
        title: "Reply to your comment",
        body: contextLabel ?? "Someone replied to your comment.",
        data: {
            type: "reply",
            commentId,
            deepLink: `riskmate://comments/${commentId}`,
        },
        categoryId: "reply",
        priority: "high",
    });
}
/** Notify job owner when someone comments on a job they own (skips when author is the owner). */
async function sendJobCommentNotification(userId, organizationId, commentId, jobId, contextLabel) {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.job_comment) {
        console.log("[Notifications] Skipped job_comment for user", userId, "(preference disabled)");
        return;
    }
    await sendToUser(userId, organizationId, {
        title: "New comment on your job",
        body: contextLabel ?? "Someone commented on a job you own.",
        data: {
            type: "job_comment",
            commentId,
            jobId,
            deepLink: `riskmate://comments/${commentId}`,
        },
        categoryId: "job_comment",
        priority: "high",
    });
}
/** Notify comment author when someone else resolves their comment. */
async function sendCommentResolvedNotification(authorUserId, organizationId, commentId, contextLabel) {
    const prefs = await getNotificationPreferences(authorUserId);
    if (!prefs.comment_resolved) {
        console.log("[Notifications] Skipped comment_resolved for user", authorUserId, "(preference disabled)");
        return;
    }
    await sendToUser(authorUserId, organizationId, {
        title: "Comment resolved",
        body: contextLabel ?? "Your comment was marked resolved.",
        data: {
            type: "comment_resolved",
            commentId,
            deepLink: `riskmate://comments/${commentId}`,
        },
        categoryId: "comment_resolved",
        priority: "default",
    });
}
//# sourceMappingURL=notifications.js.map