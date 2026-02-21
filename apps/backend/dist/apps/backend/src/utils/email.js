"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendJobAssignedEmail = sendJobAssignedEmail;
exports.sendSignatureRequestEmail = sendSignatureRequestEmail;
exports.sendReportReadyEmail = sendReportReadyEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
exports.sendTeamInviteEmail = sendTeamInviteEmail;
exports.sendMentionEmail = sendMentionEmail;
exports.sendWeeklyDigestEmail = sendWeeklyDigestEmail;
exports.sendDeadlineReminderEmail = sendDeadlineReminderEmail;
exports.sendTaskAssignedEmail = sendTaskAssignedEmail;
exports.sendTaskCompletedEmail = sendTaskCompletedEmail;
exports.sendTaskReminderEmail = sendTaskReminderEmail;
exports.hashAlertPayload = hashAlertPayload;
const crypto_1 = __importDefault(require("crypto"));
const notifications_1 = require("../services/notifications");
const JobAssignedEmail_1 = require("../emails/JobAssignedEmail");
const SignatureRequestEmail_1 = require("../emails/SignatureRequestEmail");
const ReportReadyEmail_1 = require("../emails/ReportReadyEmail");
const WelcomeEmail_1 = require("../emails/WelcomeEmail");
const TeamInviteEmail_1 = require("../emails/TeamInviteEmail");
const MentionEmail_1 = require("../emails/MentionEmail");
const WeeklyDigestEmail_1 = require("../emails/WeeklyDigestEmail");
const DeadlineReminderEmail_1 = require("../emails/DeadlineReminderEmail");
const TaskReminderEmail_1 = require("../emails/TaskReminderEmail");
const TaskAssignedEmail_1 = require("../emails/TaskAssignedEmail");
const TaskCompletedEmail_1 = require("../emails/TaskCompletedEmail");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// Resend provider (best DX, great deliverability)
class ResendProvider {
    constructor(apiKey, from) {
        this.apiKey = apiKey;
        this.from = from;
    }
    async send(options) {
        const resend = await Promise.resolve().then(() => __importStar(require('resend'))).catch(() => null);
        if (!resend) {
            throw new Error('Resend package not installed. Run: pnpm add resend');
        }
        const client = new resend.Resend(this.apiKey);
        const recipients = Array.isArray(options.to) ? options.to : [options.to];
        for (const to of recipients) {
            let lastError = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await client.emails.send({
                        from: options.from || this.from,
                        to,
                        subject: options.subject,
                        html: options.html,
                        replyTo: options.replyTo,
                    });
                    lastError = null;
                    break;
                }
                catch (error) {
                    lastError = error;
                    if (attempt < 3) {
                        const backoffMs = 2 ** (attempt - 1) * 1000;
                        await sleep(backoffMs);
                    }
                }
            }
            if (lastError) {
                console.error('[Email] Resend failed after retries:', lastError);
                throw lastError instanceof Error ? lastError : new Error(String(lastError));
            }
        }
    }
}
// SMTP provider (works anywhere, no vendor lock-in)
class SMTPProvider {
    constructor(config) {
        this.host = config.host;
        this.port = config.port;
        this.user = config.user;
        this.pass = config.pass;
        this.from = config.from;
        this.secure = config.secure ?? (config.port === 465);
    }
    async send(options) {
        const nodemailer = await Promise.resolve().then(() => __importStar(require('nodemailer'))).catch(() => null);
        if (!nodemailer) {
            throw new Error('Nodemailer package not installed. Run: pnpm add nodemailer');
        }
        const transporter = nodemailer.createTransport({
            host: this.host,
            port: this.port,
            secure: this.secure,
            auth: {
                user: this.user,
                pass: this.pass,
            },
        });
        const recipients = Array.isArray(options.to) ? options.to : [options.to];
        for (const to of recipients) {
            await transporter.sendMail({
                from: options.from || this.from,
                to,
                subject: options.subject,
                html: options.html,
                replyTo: options.replyTo,
            });
        }
    }
}
// Initialize email provider based on env vars
function getEmailProvider() {
    // Prefer Resend if configured
    const resendKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM;
    if (resendKey && resendFrom) {
        return new ResendProvider(resendKey, resendFrom);
    }
    // Fall back to SMTP if configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpHost && smtpUser && smtpPass && resendFrom) {
        return new SMTPProvider({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            user: smtpUser,
            pass: smtpPass,
            from: resendFrom,
            secure: process.env.SMTP_SECURE === 'true',
        });
    }
    return null;
}
// Singleton email provider instance
let emailProvider = null;
async function sendEmail(options) {
    if (!emailProvider) {
        emailProvider = getEmailProvider();
    }
    if (!emailProvider) {
        console.warn('Email provider not configured. Set RESEND_API_KEY or SMTP_* environment variables.');
        return;
    }
    const replyTo = options.replyTo || process.env.EMAIL_REPLY_TO;
    await emailProvider.send({ ...options, replyTo });
}
function fallbackName(email) {
    const local = email.split('@')[0] || 'there';
    return local.replace(/[._-]/g, ' ');
}
async function sendJobAssignedEmail(to, userName, job, assignedByName, userId) {
    const prefs = await (0, notifications_1.getNotificationPreferences)(userId);
    if (!(prefs.email_enabled && prefs.job_assigned))
        return;
    const template = (0, JobAssignedEmail_1.JobAssignedEmail)({
        userName: userName || fallbackName(to),
        job,
        assignedByName,
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
async function sendSignatureRequestEmail(to, userName, reportName, jobTitle, reportRunId, deadline, userId) {
    const prefs = await (0, notifications_1.getNotificationPreferences)(userId);
    if (!(prefs.email_enabled && prefs.signature_requested))
        return;
    const template = (0, SignatureRequestEmail_1.SignatureRequestEmail)({
        userName: userName || fallbackName(to),
        reportName,
        jobTitle,
        reportRunId,
        deadline,
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
async function sendReportReadyEmail(to, userName, jobTitle, downloadUrl, viewUrl, userId) {
    const prefs = await (0, notifications_1.getNotificationPreferences)(userId);
    if (!(prefs.email_enabled && prefs.report_ready))
        return;
    const template = (0, ReportReadyEmail_1.ReportReadyEmail)({
        userName: userName || fallbackName(to),
        jobTitle,
        downloadUrl,
        viewUrl,
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
async function sendWelcomeEmail(to, userName, _userId) {
    const template = (0, WelcomeEmail_1.WelcomeEmail)({
        userName: userName || fallbackName(to),
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
async function sendTeamInviteEmail(to, orgName, inviterName, tempPassword, loginUrl, _userId) {
    const template = (0, TeamInviteEmail_1.TeamInviteEmail)({
        orgName,
        inviterName,
        tempPassword,
        loginUrl,
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
async function sendMentionEmail(to, userName, mentionedByName, jobName, commentPreview, commentUrl, userId) {
    const prefs = await (0, notifications_1.getNotificationPreferences)(userId);
    if (!(prefs.email_enabled && prefs.mention))
        return;
    const template = (0, MentionEmail_1.MentionEmail)({
        userName: userName || fallbackName(to),
        mentionedByName,
        jobName,
        commentPreview,
        commentUrl,
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
async function sendWeeklyDigestEmail(to, userName, digest, userId) {
    const prefs = await (0, notifications_1.getNotificationPreferences)(userId);
    if (!(prefs.email_enabled && prefs.email_weekly_digest))
        return;
    const template = (0, WeeklyDigestEmail_1.WeeklyDigestEmail)({
        userName: userName || fallbackName(to),
        digest,
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
async function sendDeadlineReminderEmail(to, userName, job, hoursRemaining, userId) {
    const prefs = await (0, notifications_1.getNotificationPreferences)(userId);
    if (!(prefs.email_enabled && prefs.email_deadline_reminder))
        return;
    const template = (0, DeadlineReminderEmail_1.DeadlineReminderEmail)({
        userName: userName || fallbackName(to),
        job,
        hoursRemaining,
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
async function sendTaskAssignedEmail(to, userName, params, userId) {
    const prefs = await (0, notifications_1.getNotificationPreferences)(userId);
    if (!(prefs.email_enabled && prefs.job_assigned))
        return;
    const template = (0, TaskAssignedEmail_1.TaskAssignedEmail)({
        userName: userName || fallbackName(to),
        taskTitle: params.taskTitle,
        jobTitle: params.jobTitle,
        jobId: params.jobId,
        taskId: params.taskId,
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
async function sendTaskCompletedEmail(to, userName, params, userId) {
    const prefs = await (0, notifications_1.getNotificationPreferences)(userId);
    if (!prefs.email_enabled)
        return;
    const template = (0, TaskCompletedEmail_1.TaskCompletedEmail)({
        userName: userName || fallbackName(to),
        taskTitle: params.taskTitle,
        jobTitle: params.jobTitle,
        taskId: params.taskId,
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
async function sendTaskReminderEmail(to, userName, params, userId) {
    const prefs = await (0, notifications_1.getNotificationPreferences)(userId);
    if (!(prefs.email_enabled && prefs.deadline_approaching))
        return;
    const template = (0, TaskReminderEmail_1.TaskReminderEmail)({
        userName: userName || fallbackName(to),
        taskTitle: params.taskTitle,
        jobTitle: params.jobTitle,
        dueDate: params.dueDate,
        isOverdue: params.isOverdue,
        hoursRemaining: params.hoursRemaining,
        jobId: params.jobId,
        taskId: params.taskId,
    });
    await sendEmail({
        to,
        subject: template.subject,
        html: template.html,
    });
}
// Generate hash of alert payload for deduplication
function hashAlertPayload(payload) {
    const normalized = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto_1.default.createHash('sha256').update(normalized).digest('hex');
}
//# sourceMappingURL=email.js.map