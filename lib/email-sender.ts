import { db } from "../db"
import { societes } from "../db/schema/societes"

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
  sendMail(opts: { from: string; to: string; subject: string; text: string; html?: string }): Promise<unknown>
}

// Placeholder for Ticket C (SocieteIdentity module).
// Will be replaced with import { loadSocieteIdentity } from "../societe-identity"
async function loadSocieteIdentity(): Promise<{ nomExpediteurEmail: string | null; domaineEmail: string | null } | null> {
  try {
    const [societe] = await db.select().from(societes).limit(1)
    if (!societe) return null
    return {
      nomExpediteurEmail: societe.nomExpediteurEmail,
      domaineEmail: societe.domaineEmail,
    }
  } catch {
    return null
  }
}

export class EmailSender {
  constructor(private transporter: EmailTransporter) {}

  async send(opts: { to: string; subject: string; text: string; html?: string }): Promise<EmailResult> {
    try {
      let fromName = process.env.SMTP_FROM_NAME ?? "Notification"
      let fromEmail = process.env.SMTP_FROM ?? "noreply@exemple.ma"

      const identity = await loadSocieteIdentity()
      if (identity) {
        if (identity.nomExpediteurEmail) fromName = identity.nomExpediteurEmail
        if (identity.domaineEmail) fromEmail = `noreply@${identity.domaineEmail}`
      }

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
