import crypto from 'crypto'
import { getNotificationPreferences } from '../services/notifications'
import { JobAssignedEmail } from '../emails/JobAssignedEmail'
import { SignatureRequestEmail } from '../emails/SignatureRequestEmail'
import { ReportReadyEmail } from '../emails/ReportReadyEmail'
import { WelcomeEmail } from '../emails/WelcomeEmail'
import { TeamInviteEmail } from '../emails/TeamInviteEmail'
import { MentionEmail } from '../emails/MentionEmail'
import { WeeklyDigestEmail, type WeeklyDigestData } from '../emails/WeeklyDigestEmail'
import { DeadlineReminderEmail } from '../emails/DeadlineReminderEmail'
import { TaskReminderEmail } from '../emails/TaskReminderEmail'
import { TaskAssignedEmail } from '../emails/TaskAssignedEmail'
import { TaskCompletedEmail } from '../emails/TaskCompletedEmail'

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}

interface EmailProvider {
  send(options: EmailOptions): Promise<void>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Resend provider (best DX, great deliverability)
class ResendProvider implements EmailProvider {
  private apiKey: string
  private from: string

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey
    this.from = from
  }

  async send(options: EmailOptions): Promise<void> {
    const resend = await import('resend').catch(() => null)
    if (!resend) {
      throw new Error('Resend package not installed. Run: pnpm add resend')
    }

    const client = new resend.Resend(this.apiKey)
    const recipients = Array.isArray(options.to) ? options.to : [options.to]

    for (const to of recipients) {
      let lastError: unknown = null

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await client.emails.send({
            from: options.from || this.from,
            to,
            subject: options.subject,
            html: options.html,
            replyTo: options.replyTo,
          })
          lastError = null
          break
        } catch (error) {
          lastError = error
          if (attempt < 3) {
            const backoffMs = 2 ** (attempt - 1) * 1000
            await sleep(backoffMs)
          }
        }
      }

      if (lastError) {
        console.error('[Email] Resend failed after retries:', lastError)
        throw lastError instanceof Error ? lastError : new Error(String(lastError))
      }
    }
  }
}

// SMTP provider (works anywhere, no vendor lock-in)
class SMTPProvider implements EmailProvider {
  private host: string
  private port: number
  private user: string
  private pass: string
  private from: string
  private secure: boolean

  constructor(config: {
    host: string
    port: number
    user: string
    pass: string
    from: string
    secure?: boolean
  }) {
    this.host = config.host
    this.port = config.port
    this.user = config.user
    this.pass = config.pass
    this.from = config.from
    this.secure = config.secure ?? (config.port === 465)
  }

  async send(options: EmailOptions): Promise<void> {
    const nodemailer = await import('nodemailer').catch(() => null)
    if (!nodemailer) {
      throw new Error('Nodemailer package not installed. Run: pnpm add nodemailer')
    }

    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.user,
        pass: this.pass,
      },
    })

    const recipients = Array.isArray(options.to) ? options.to : [options.to]

    for (const to of recipients) {
      await transporter.sendMail({
        from: options.from || this.from,
        to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
      })
    }
  }
}

// Initialize email provider based on env vars
function getEmailProvider(): EmailProvider | null {
  // Prefer Resend if configured
  const resendKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM

  if (resendKey && resendFrom) {
    return new ResendProvider(resendKey, resendFrom)
  }

  // Fall back to SMTP if configured
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (smtpHost && smtpUser && smtpPass && resendFrom) {
    return new SMTPProvider({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: smtpUser,
      pass: smtpPass,
      from: resendFrom,
      secure: process.env.SMTP_SECURE === 'true',
    })
  }

  return null
}

// Singleton email provider instance
let emailProvider: EmailProvider | null = null

export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!emailProvider) {
    emailProvider = getEmailProvider()
  }

  if (!emailProvider) {
    console.warn('Email provider not configured. Set RESEND_API_KEY or SMTP_* environment variables.')
    return
  }

  const replyTo = options.replyTo || process.env.EMAIL_REPLY_TO
  await emailProvider.send({ ...options, replyTo })
}

function fallbackName(email: string): string {
  const local = email.split('@')[0] || 'there'
  return local.replace(/[._-]/g, ' ')
}

export async function sendJobAssignedEmail(
  to: string,
  userName: string,
  job: {
    id?: string
    title?: string | null
    client_name?: string | null
    location?: string | null
    due_date?: string | null
    risk_level?: string | null
  },
  assignedByName: string,
  userId: string
): Promise<void> {
  const prefs = await getNotificationPreferences(userId)
  if (!(prefs.email_enabled && prefs.job_assigned)) return

  const template = JobAssignedEmail({
    userName: userName || fallbackName(to),
    job,
    assignedByName,
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

export async function sendSignatureRequestEmail(
  to: string,
  userName: string,
  reportName: string,
  jobTitle: string,
  reportRunId: string,
  deadline: string | undefined,
  userId: string
): Promise<void> {
  const prefs = await getNotificationPreferences(userId)
  if (!(prefs.email_enabled && prefs.signature_requested)) return

  const template = SignatureRequestEmail({
    userName: userName || fallbackName(to),
    reportName,
    jobTitle,
    reportRunId,
    deadline,
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

export async function sendReportReadyEmail(
  to: string,
  userName: string,
  jobTitle: string,
  downloadUrl: string,
  viewUrl: string,
  userId: string
): Promise<void> {
  const prefs = await getNotificationPreferences(userId)
  if (!(prefs.email_enabled && prefs.report_ready)) return

  const template = ReportReadyEmail({
    userName: userName || fallbackName(to),
    jobTitle,
    downloadUrl,
    viewUrl,
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

export async function sendWelcomeEmail(
  to: string,
  userName: string,
  _userId?: string
): Promise<void> {
  const template = WelcomeEmail({
    userName: userName || fallbackName(to),
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

export async function sendTeamInviteEmail(
  to: string,
  orgName: string,
  inviterName: string,
  tempPassword: string,
  loginUrl: string,
  _userId?: string
): Promise<void> {
  const template = TeamInviteEmail({
    orgName,
    inviterName,
    tempPassword,
    loginUrl,
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

export async function sendMentionEmail(
  to: string,
  userName: string,
  mentionedByName: string,
  jobName: string,
  commentPreview: string,
  commentUrl: string,
  userId: string
): Promise<void> {
  const prefs = await getNotificationPreferences(userId)
  if (!(prefs.email_enabled && prefs.mention)) return

  const template = MentionEmail({
    userName: userName || fallbackName(to),
    mentionedByName,
    jobName,
    commentPreview,
    commentUrl,
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

export async function sendWeeklyDigestEmail(
  to: string,
  userName: string,
  digest: WeeklyDigestData,
  userId: string
): Promise<void> {
  const prefs = await getNotificationPreferences(userId)
  if (!(prefs.email_enabled && prefs.email_weekly_digest)) return

  const template = WeeklyDigestEmail({
    userName: userName || fallbackName(to),
    digest,
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

export async function sendDeadlineReminderEmail(
  to: string,
  userName: string,
  job: {
    id?: string
    title?: string | null
    client_name?: string | null
    due_date?: string | null
  },
  hoursRemaining: number,
  userId: string
): Promise<void> {
  const prefs = await getNotificationPreferences(userId)
  if (!(prefs.email_enabled && prefs.email_deadline_reminder)) return

  const template = DeadlineReminderEmail({
    userName: userName || fallbackName(to),
    job,
    hoursRemaining,
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

export async function sendTaskAssignedEmail(
  to: string,
  userName: string,
  params: { taskTitle: string; jobTitle: string; jobId: string; taskId: string },
  userId: string
): Promise<void> {
  const prefs = await getNotificationPreferences(userId)
  if (!(prefs.email_enabled && prefs.job_assigned)) return

  const template = TaskAssignedEmail({
    userName: userName || fallbackName(to),
    taskTitle: params.taskTitle,
    jobTitle: params.jobTitle,
    jobId: params.jobId,
    taskId: params.taskId,
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

export async function sendTaskCompletedEmail(
  to: string,
  userName: string,
  params: { taskTitle: string; jobTitle: string; taskId: string },
  userId: string
): Promise<void> {
  const prefs = await getNotificationPreferences(userId)
  if (!prefs.email_enabled) return

  const template = TaskCompletedEmail({
    userName: userName || fallbackName(to),
    taskTitle: params.taskTitle,
    jobTitle: params.jobTitle,
    taskId: params.taskId,
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

export async function sendTaskReminderEmail(
  to: string,
  userName: string,
  params: {
    taskTitle: string
    jobTitle: string
    dueDate: string | null
    isOverdue: boolean
    hoursRemaining?: number
    jobId?: string
    taskId?: string
  },
  userId: string
): Promise<void> {
  const prefs = await getNotificationPreferences(userId)
  if (!(prefs.email_enabled && prefs.deadline_approaching)) return

  const template = TaskReminderEmail({
    userName: userName || fallbackName(to),
    taskTitle: params.taskTitle,
    jobTitle: params.jobTitle,
    dueDate: params.dueDate,
    isOverdue: params.isOverdue,
    hoursRemaining: params.hoursRemaining,
    jobId: params.jobId,
    taskId: params.taskId,
  })

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  })
}

// Generate hash of alert payload for deduplication
export function hashAlertPayload(payload: Record<string, unknown>): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort())
  return crypto.createHash('sha256').update(normalized).digest('hex')
}
