import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"
import { prisma } from "./prisma"

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Email Service ─────────────────────────────────────────────────────────

export class EmailService {
  private transporter: Transporter | null = null

  constructor() {
    const host = process.env.SMTP_HOST
    const port = process.env.SMTP_PORT

    if (!host || !port) {
      console.warn(
        "[EmailService] SMTP_HOST or SMTP_PORT not configured — emails will be skipped."
      )
      return
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      ...(process.env.SMTP_USER && process.env.SMTP_PASS
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {}),
    })
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.transporter) {
      return { success: true }
    }

    try {
      let fromName = process.env.SMTP_FROM_NAME ?? "Notification"
      let fromEmail = process.env.SMTP_FROM ?? "noreply@exemple.ma"

      try {
        const societe = await prisma.societe.findFirst()
        if (societe) {
          if (societe.nomExpediteurEmail) fromName = societe.nomExpediteurEmail
          if (societe.domaineEmail) fromEmail = `noreply@${societe.domaineEmail}`
        }
      } catch {}

      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        ...(options.html ? { html: options.html } : {}),
      })
      return { success: true }
    } catch (error) {
      console.error("[EmailService] Failed to send email:", error)
      return { success: false, error: error as Error }
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const emailService = new EmailService()