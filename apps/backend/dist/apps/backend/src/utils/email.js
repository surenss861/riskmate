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
exports.hashAlertPayload = hashAlertPayload;
const crypto_1 = __importDefault(require("crypto"));
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
            await client.emails.send({
                from: options.from || this.from,
                to,
                subject: options.subject,
                html: options.html,
            });
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
    await emailProvider.send(options);
}
// Generate hash of alert payload for deduplication
function hashAlertPayload(payload) {
    const normalized = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto_1.default.createHash('sha256').update(normalized).digest('hex');
}
//# sourceMappingURL=email.js.map