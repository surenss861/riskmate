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
const emailQueue = [];
let workerStarted = false;
let workerTimer = null;
let processing = false;
function queueEmail(type, to, data, userId, scheduledAt) {
    const job = {
        id: crypto_1.default.randomUUID(),
        type,
        to,
        userId,
        data,
        scheduledAt,
        attempts: 0,
        createdAt: new Date(),
    };
    emailQueue.push(job);
    return job;
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
async function processJob(job) {
    const userName = await loadUserName(job.userId, job.to);
    if (job.type === EmailJobType.job_assigned) {
        if (!job.userId)
            throw new Error('job_assigned requires userId');
        const assignedByName = String(job.data.assignedByName || 'A teammate');
        const rawJob = job.data.job || {};
        await (0, email_1.sendJobAssignedEmail)(job.to, String(job.data.userName || userName), {
            id: typeof rawJob.id === 'string' ? rawJob.id : undefined,
            title: typeof rawJob.title === 'string' ? rawJob.title : null,
            client_name: typeof rawJob.client_name === 'string' ? rawJob.client_name : null,
            location: typeof rawJob.location === 'string' ? rawJob.location : null,
            due_date: typeof rawJob.due_date === 'string' ? rawJob.due_date : null,
            risk_level: typeof rawJob.risk_level === 'string' ? rawJob.risk_level : null,
        }, assignedByName, job.userId);
        return;
    }
    if (job.type === EmailJobType.signature_request) {
        if (!job.userId)
            throw new Error('signature_request requires userId');
        const reportRunId = String(job.data.reportRunId || '');
        await (0, email_1.sendSignatureRequestEmail)(job.to, userName, String(job.data.reportName || `Report ${reportRunId.slice(0, 8)}`), String(job.data.jobTitle || 'Risk report'), reportRunId, typeof job.data.deadline === 'string' ? job.data.deadline : undefined, job.userId);
        return;
    }
    if (job.type === EmailJobType.report_ready) {
        if (!job.userId)
            throw new Error('report_ready requires userId');
        await (0, email_1.sendReportReadyEmail)(job.to, userName, String(job.data.jobTitle || 'Risk report'), String(job.data.downloadUrl || ''), String(job.data.viewUrl || String(job.data.downloadUrl || '')), job.userId);
        return;
    }
    if (job.type === EmailJobType.welcome) {
        await (0, email_1.sendWelcomeEmail)(job.to, userName, job.userId);
        return;
    }
    if (job.type === EmailJobType.team_invite) {
        await (0, email_1.sendTeamInviteEmail)(job.to, String(job.data.orgName || 'your organization'), String(job.data.inviterName || 'A teammate'), String(job.data.tempPassword || ''), String(job.data.loginUrl || process.env.FRONTEND_URL || 'https://www.riskmate.dev'), job.userId);
        return;
    }
    if (job.type === EmailJobType.mention) {
        if (!job.userId)
            throw new Error('mention requires userId');
        await (0, email_1.sendMentionEmail)(job.to, userName, String(job.data.mentionedByName || 'A teammate'), String(job.data.jobName || 'a job'), String(job.data.commentPreview || ''), String(job.data.commentUrl || process.env.FRONTEND_URL || 'https://www.riskmate.dev'), job.userId);
        return;
    }
    if (job.type === EmailJobType.weekly_digest) {
        if (!job.userId)
            throw new Error('weekly_digest requires userId');
        await (0, email_1.sendWeeklyDigestEmail)(job.to, userName, job.data, job.userId);
        return;
    }
    if (job.type === EmailJobType.deadline_reminder) {
        if (!job.userId)
            throw new Error('deadline_reminder requires userId');
        const rawJob = job.data.job || {};
        await (0, email_1.sendDeadlineReminderEmail)(job.to, userName, {
            id: typeof rawJob.id === 'string' ? rawJob.id : undefined,
            title: typeof rawJob.title === 'string' ? rawJob.title : null,
            client_name: typeof rawJob.client_name === 'string' ? rawJob.client_name : null,
            due_date: typeof rawJob.due_date === 'string' ? rawJob.due_date : null,
        }, Number(job.data.hoursRemaining || 0), job.userId);
        return;
    }
    if (job.type === EmailJobType.task_reminder) {
        if (!job.userId)
            throw new Error('task_reminder requires userId');
        await (0, email_1.sendTaskReminderEmail)(job.to, userName, {
            taskTitle: String(job.data.taskTitle || ''),
            jobTitle: String(job.data.jobTitle || 'Job'),
            dueDate: typeof job.data.dueDate === 'string' ? job.data.dueDate : null,
            isOverdue: Boolean(job.data.isOverdue),
            hoursRemaining: typeof job.data.hoursRemaining === 'number' ? job.data.hoursRemaining : undefined,
            jobId: typeof job.data.jobId === 'string' ? job.data.jobId : undefined,
            taskId: typeof job.data.taskId === 'string' ? job.data.taskId : undefined,
        }, job.userId);
        return;
    }
    if (job.type === EmailJobType.task_assigned) {
        if (!job.userId)
            throw new Error('task_assigned requires userId');
        await (0, email_1.sendTaskAssignedEmail)(job.to, userName, {
            taskTitle: String(job.data.taskTitle || ''),
            jobTitle: String(job.data.jobTitle || 'Job'),
            jobId: String(job.data.jobId || ''),
            taskId: String(job.data.taskId || ''),
        }, job.userId);
        return;
    }
    if (job.type === EmailJobType.task_completed) {
        if (!job.userId)
            throw new Error('task_completed requires userId');
        await (0, email_1.sendTaskCompletedEmail)(job.to, userName, {
            taskTitle: String(job.data.taskTitle || ''),
            jobTitle: String(job.data.jobTitle || 'Job'),
            taskId: String(job.data.taskId || ''),
            jobId: String(job.data.jobId ?? ''),
        }, job.userId);
        return;
    }
    throw new Error(`Unsupported email job type: ${job.type}`);
}
async function runQueueCycle() {
    if (processing)
        return;
    processing = true;
    try {
        const now = new Date();
        const pending = emailQueue
            .filter((job) => !job.scheduledAt || job.scheduledAt <= now)
            .slice(0, 10);
        for (const job of pending) {
            try {
                await processJob(job);
                const index = emailQueue.findIndex((item) => item.id === job.id);
                if (index >= 0)
                    emailQueue.splice(index, 1);
            }
            catch (error) {
                job.attempts += 1;
                if (job.attempts >= 3) {
                    const index = emailQueue.findIndex((item) => item.id === job.id);
                    if (index >= 0)
                        emailQueue.splice(index, 1);
                    console.error('[EmailQueue] Job failed and removed after 3 attempts:', {
                        id: job.id,
                        type: job.type,
                        to: job.to,
                        error,
                    });
                }
                else {
                    console.error('[EmailQueue] Job failed, will retry:', {
                        id: job.id,
                        type: job.type,
                        attempts: job.attempts,
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