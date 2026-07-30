import { loadSocieteIdentity } from "@/lib/societe"
import { SmtpTransporter, NullTransporter } from "./email-transporter"

export interface EmailOptions {
  to: string
  subject: string
  text: string
  html?: string
}

export interface EmailResult {
  success: boolean
  error?: Error
}

export interface EmailTransporter {
  sendMail(opts: {
    from: string
    to: string
    subject: string
    text: string
    html?: string
  }): Promise<unknown>
}

export class EmailSender {
  constructor(private transporter: EmailTransporter) {}

  async send(opts: {
    to: string
    subject: string
    text: string
    html?: string
  }): Promise<EmailResult> {
    try {
      let fromName = process.env.SMTP_FROM_NAME ?? "Notification"
      let fromEmail = process.env.SMTP_FROM ?? "noreply@exemple.ma"

      const identity = await loadSocieteIdentity()
      if (identity.nomExpediteurEmail) fromName = identity.nomExpediteurEmail
      if (identity.domaineEmail) fromEmail = identity.domaineEmail

      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
      })

      return { success: true }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }
}

const transporter = process.env.SMTP_HOST
  ? new SmtpTransporter()
  : new NullTransporter()
export const emailSender = new EmailSender(transporter)
