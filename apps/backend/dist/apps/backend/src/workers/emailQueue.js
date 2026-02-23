"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailJobType = void 0;
exports.queueEmail = queueEmail;
exports.startEmailQueueWorker = startEmailQueueWorker;
exports.stopEmailQueueWorker = stopEmailQueueWorker;
const crypto_1 = __importDefault(require("crypto"));
const email_1 = require("../utils/email");
const supabaseClient_1 = require("../lib/supabaseClient");
const workerLock_1 = require("../lib/workerLock");
const LEASE_VISIBILITY_SEC = 120;
const MAX_CLAIM = 10;
const MAX_ATTEMPTS = 3;
/** Domain identifier (task/job/report id) from email job data; null when not applicable. */
function getDomainJobId(job) {
    const d = job.data;
    switch (job.type) {
        case EmailJobType.job_assigned:
        case EmailJobType.deadline_reminder: {
            const raw = d.job;
            return typeof raw?.id === 'string' ? raw.id : null;
        }
        case EmailJobType.signature_request:
        case EmailJobType.report_ready:
            return typeof d.reportRunId === 'string' ? d.reportRunId : null;
        case EmailJobType.mention:
            return typeof d.jobId === 'string' ? d.jobId : null;
        case EmailJobType.task_reminder:
        case EmailJobType.task_assigned:
        case EmailJobType.task_completed:
            return typeof d.taskId === 'string' ? d.taskId : typeof d.jobId === 'string' ? d.jobId : null;
        default:
            return null;
    }
}
/** Log email event to console and optionally to email_logs table (if present). */
async function logEmailEvent(domainJobId, queueId, type, to, userId, status, errorMessage, providerMessageId) {
    const payload = { domainJobId, queueId, type, to, userId, status, errorMessage, providerMessageId };
    if (status === 'sent') {
        console.info('[EmailQueue] Sent', payload);
    }
    else {
        console.error('[EmailQueue] Event', payload);
    }
    try {
        await supabaseClient_1.supabase.from('email_logs').insert({
            job_id: domainJobId,
            queue_id: queueId,
            type,
            recipient: to,
            user_id: userId ?? null,
            status,
            error_message: errorMessage ?? null,
            ...(providerMessageId != null && { provider_message_id: providerMessageId }),
        });
    }
    catch (e) {
        // Table may not exist yet; avoid breaking the queue
        if (status !== 'sent')
            console.error('[EmailQueue] email_logs insert failed', e);
    }
}
var EmailJobType;
(function (EmailJobType) {
    EmailJobType["job_assigned"] = "job_assigned";
    EmailJobType["signature_request"] = "signature_request";
    EmailJobType["report_ready"] = "report_ready";
    EmailJobType["welcome"] = "welcome";
    EmailJobType["team_invite"] = "team_invite";
    EmailJobType["mention"] = "mention";
    EmailJobType["weekly_digest"] = "weekly_digest";
    EmailJobType["deadline_reminder"] = "deadline_reminder";
    EmailJobType["task_reminder"] = "task_reminder";
    EmailJobType["task_assigned"] = "task_assigned";
    EmailJobType["task_completed"] = "task_completed";
})(EmailJobType || (exports.EmailJobType = EmailJobType = {}));
let workerStarted = false;
let workerTimer = null;
let processing = false;
function rowToJob(row) {
    return {
        id: row.id,
        type: row.type,
        to: row.recipient,
        userId: row.user_id ?? undefined,
        data: row.data ?? {},
        scheduledAt: new Date(row.scheduled_at),
        attempts: row.attempts,
        createdAt: new Date(row.created_at),
    };
}
async function queueEmail(type, to, data, userId, scheduledAt) {
    if (process.env.DISABLE_EMAIL_QUEUE === 'true' || process.env.DISABLE_EMAIL_QUEUE === '1') {
        const id = crypto_1.default.randomUUID();
        console.warn('[EmailQueue] Enqueue skipped (DISABLE_EMAIL_QUEUE). type=%s to=%s', type, to);
        return {
            id,
            type,
            to,
            userId,
            data,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
            attempts: 0,
            createdAt: new Date(),
        };
    }
    const id = crypto_1.default.randomUUID();
    const now = new Date().toISOString();
    const scheduled = (scheduledAt ?? new Date()).toISOString();
    const { error } = await supabaseClient_1.supabase.from('email_queue').insert({
        id,
        type,
        recipient: to,
        user_id: userId ?? null,
        data: data ?? {},
        scheduled_at: scheduled,
        attempts: 0,
        created_at: now,
    });
    if (error) {
        console.error('[EmailQueue] Insert failed:', error);
        throw new Error(`Email queue insert failed: ${error.message}`);
    }
    return {
        id,
        type,
        to,
        userId,
        data,
        scheduledAt: scheduledAt ? new Date(scheduled) : undefined,
        attempts: 0,
        createdAt: new Date(now),
    };
}
function deriveName(email) {
    const local = email.split('@')[0] || 'there';
    return local.replace(/[._-]/g, ' ');
}
async function loadUserName(userId, fallbackEmail) {
    if (!userId)
        return deriveName(fallbackEmail);
    const { data } = await supabaseClient_1.supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();
    return data?.full_name || deriveName(fallbackEmail);
}
/** Returns { dispatched, providerId } if an email was actually dispatched; otherwise { dispatched: false }. */
async function processJob(job) {
    const userName = await loadUserName(job.userId, job.to);
    if (job.type === EmailJobType.job_assigned) {
        if (!job.userId)
            throw new Error('job_assigned requires userId');
        const assignedByName = String(job.data.assignedByName || 'A teammate');
        const rawJob = job.data.job || {};
        const result = await (0, email_1.sendJobAssignedEmail)(job.to, String(job.data.userName || userName), {
            id: typeof rawJob.id === 'string' ? rawJob.id : undefined,
            title: typeof rawJob.title === 'string' ? rawJob.title : null,
            client_name: typeof rawJob.client_name === 'string' ? rawJob.client_name : null,
            location: typeof rawJob.location === 'string' ? rawJob.location : null,
            due_date: typeof rawJob.due_date === 'string' ? rawJob.due_date : null,
            risk_level: typeof rawJob.risk_level === 'string' ? rawJob.risk_level : null,
        }, assignedByName, job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    if (job.type === EmailJobType.signature_request) {
        if (!job.userId)
            throw new Error('signature_request requires userId');
        const reportRunId = String(job.data.reportRunId || '');
        const result = await (0, email_1.sendSignatureRequestEmail)(job.to, userName, String(job.data.reportName || `Report ${reportRunId.slice(0, 8)}`), String(job.data.jobTitle || 'Risk report'), reportRunId, typeof job.data.deadline === 'string' ? job.data.deadline : undefined, job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    if (job.type === EmailJobType.report_ready) {
        if (!job.userId)
            throw new Error('report_ready requires userId');
        const result = await (0, email_1.sendReportReadyEmail)(job.to, userName, String(job.data.jobTitle || 'Risk report'), String(job.data.downloadUrl || ''), String(job.data.viewUrl || String(job.data.downloadUrl || '')), job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    if (job.type === EmailJobType.welcome) {
        const result = await (0, email_1.sendWelcomeEmail)(job.to, userName, job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    if (job.type === EmailJobType.team_invite) {
        const result = await (0, email_1.sendTeamInviteEmail)(job.to, String(job.data.orgName || 'your organization'), String(job.data.inviterName || 'A teammate'), String(job.data.tempPassword || ''), String(job.data.loginUrl || process.env.FRONTEND_URL || 'https://www.riskmate.dev'), job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    if (job.type === EmailJobType.mention) {
        if (!job.userId)
            throw new Error('mention requires userId');
        const result = await (0, email_1.sendMentionEmail)(job.to, userName, String(job.data.mentionedByName || 'A teammate'), String(job.data.jobName || 'a job'), String(job.data.commentPreview || ''), String(job.data.commentUrl || process.env.FRONTEND_URL || 'https://www.riskmate.dev'), job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    if (job.type === EmailJobType.weekly_digest) {
        if (!job.userId)
            throw new Error('weekly_digest requires userId');
        const result = await (0, email_1.sendWeeklyDigestEmail)(job.to, userName, job.data, job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    if (job.type === EmailJobType.deadline_reminder) {
        if (!job.userId)
            throw new Error('deadline_reminder requires userId');
        const rawJob = job.data.job || {};
        const result = await (0, email_1.sendDeadlineReminderEmail)(job.to, userName, {
            id: typeof rawJob.id === 'string' ? rawJob.id : undefined,
            title: typeof rawJob.title === 'string' ? rawJob.title : null,
            client_name: typeof rawJob.client_name === 'string' ? rawJob.client_name : null,
            due_date: typeof rawJob.due_date === 'string' ? rawJob.due_date : null,
        }, Number(job.data.hoursRemaining || 0), job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    if (job.type === EmailJobType.task_reminder) {
        if (!job.userId)
            throw new Error('task_reminder requires userId');
        const result = await (0, email_1.sendTaskReminderEmail)(job.to, userName, {
            taskTitle: String(job.data.taskTitle || ''),
            jobTitle: String(job.data.jobTitle || 'Job'),
            dueDate: typeof job.data.dueDate === 'string' ? job.data.dueDate : null,
            isOverdue: Boolean(job.data.isOverdue),
            hoursRemaining: typeof job.data.hoursRemaining === 'number' ? job.data.hoursRemaining : undefined,
            jobId: typeof job.data.jobId === 'string' ? job.data.jobId : undefined,
            taskId: typeof job.data.taskId === 'string' ? job.data.taskId : undefined,
        }, job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    if (job.type === EmailJobType.task_assigned) {
        if (!job.userId)
            throw new Error('task_assigned requires userId');
        const result = await (0, email_1.sendTaskAssignedEmail)(job.to, userName, {
            taskTitle: String(job.data.taskTitle || ''),
            jobTitle: String(job.data.jobTitle || 'Job'),
            jobId: String(job.data.jobId || ''),
            taskId: String(job.data.taskId || ''),
        }, job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    if (job.type === EmailJobType.task_completed) {
        if (!job.userId)
            throw new Error('task_completed requires userId');
        const result = await (0, email_1.sendTaskCompletedEmail)(job.to, userName, {
            taskTitle: String(job.data.taskTitle || ''),
            jobTitle: String(job.data.jobTitle || 'Job'),
            taskId: String(job.data.taskId || ''),
            jobId: String(job.data.jobId ?? ''),
        }, job.userId);
        return { dispatched: result.sent, providerId: result.sent ? result.providerId : undefined };
    }
    throw new Error(`Unsupported email job type: ${job.type}`);
}
async function runQueueCycle() {
    if (processing)
        return;
    if (process.env.DISABLE_EMAIL_QUEUE === 'true' || process.env.DISABLE_EMAIL_QUEUE === '1') {
        return;
    }
    if (!(await (0, email_1.isEmailConfigured)())) {
        console.warn('[EmailQueue] Skipping cycle: no email provider configured. Set RESEND_API_KEY or SMTP_* (or DISABLE_EMAIL_QUEUE=1 to disable processing).');
        return;
    }
    const hasLease = await (0, workerLock_1.tryAcquireWorkerLease)(workerLock_1.WORKER_LEASE_KEYS.email_queue, 60);
    if (!hasLease)
        return;
    processing = true;
    const holderId = `${process.pid}-${crypto_1.default.randomUUID().slice(0, 8)}`;
    try {
        const { data: rows, error: claimError } = await supabaseClient_1.supabase.rpc('claim_email_queue_jobs', {
            p_holder_id: holderId,
            p_visibility_sec: LEASE_VISIBILITY_SEC,
            p_max: MAX_CLAIM,
        });
        if (claimError) {
            // Table or RPC may not exist yet (e.g. before migration)
            if (claimError.code !== 'PGRST204' && claimError.message?.includes('claim_email_queue_jobs') === false) {
                console.error('[EmailQueue] Claim failed:', claimError);
            }
            return;
        }
        const claimed = (rows ?? []);
        for (const row of claimed) {
            const job = rowToJob(row);
            const domainJobId = getDomainJobId(job);
            try {
                const { dispatched, providerId } = await processJob(job);
                if (dispatched) {
                    await logEmailEvent(domainJobId, job.id, job.type, job.to, job.userId, 'sent', undefined, providerId);
                }
                await supabaseClient_1.supabase.from('email_queue').delete().eq('id', job.id);
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                const newAttempts = job.attempts + 1;
                if (newAttempts >= MAX_ATTEMPTS) {
                    await logEmailEvent(domainJobId, job.id, job.type, job.to, job.userId, 'failed', errMsg);
                    try {
                        await supabaseClient_1.supabase.from('email_queue_dlq').insert({
                            original_queue_id: job.id,
                            type: job.type,
                            recipient: job.to,
                            user_id: job.userId ?? null,
                            data: job.data,
                            attempts: newAttempts,
                            last_error: errMsg,
                            failed_at: new Date().toISOString(),
                            created_at: job.createdAt.toISOString(),
                        });
                    }
                    catch (dlqErr) {
                        console.error('[EmailQueue] DLQ insert failed (job still removed):', dlqErr);
                    }
                    await supabaseClient_1.supabase.from('email_queue').delete().eq('id', job.id);
                    console.error('[EmailQueue] PERMANENT_FAILURE', {
                        metric: 'email_queue_permanent_failure',
                        id: job.id,
                        type: job.type,
                        to: job.to,
                        attempts: newAttempts,
                        error: errMsg,
                    });
                }
                else {
                    const backoffSec = 2 ** (newAttempts - 1);
                    const scheduledAt = new Date(Date.now() + backoffSec * 1000).toISOString();
                    await supabaseClient_1.supabase
                        .from('email_queue')
                        .update({
                        attempts: newAttempts,
                        scheduled_at: scheduledAt,
                        lease_holder: null,
                        lease_expires_at: null,
                    })
                        .eq('id', job.id);
                    console.error('[EmailQueue] Job failed, will retry after backoff:', {
                        id: job.id,
                        type: job.type,
                        attempts: newAttempts,
                        nextAttemptAt: scheduledAt,
                        error,
                    });
                }
            }
        }
    }
    finally {
        processing = false;
    }
}
function startEmailQueueWorker() {
    if (workerStarted) {
        console.log('[EmailQueue] Already running');
        return;
    }
    workerStarted = true;
    console.log('[EmailQueue] Starting...');
    runQueueCycle().catch((error) => {
        console.error('[EmailQueue] Initial cycle failed:', error);
    });
    workerTimer = setInterval(() => {
        runQueueCycle().catch((error) => {
            console.error('[EmailQueue] Queue cycle failed:', error);
        });
    }, 5000);
}
function stopEmailQueueWorker() {
    if (workerTimer) {
        clearInterval(workerTimer);
        workerTimer = null;
    }
    workerStarted = false;
}
//# sourceMappingURL=emailQueue.js.map