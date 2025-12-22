import crypto from 'crypto'

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

interface EmailProvider {
  send(options: EmailOptions): Promise<void>
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
      await client.emails.send({
        from: options.from || this.from,
        to,
        subject: options.subject,
        html: options.html,
      })
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

  await emailProvider.send(options)
}

// Generate hash of alert payload for deduplication
export function hashAlertPayload(payload: Record<string, unknown>): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort())
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

