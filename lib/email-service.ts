import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

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

/**
 * Thin wrapper around nodemailer that reads SMTP config from env vars.
 *
 * When SMTP_HOST is empty or undefined the service logs a warning and
 * returns `{ success: true }` — this lets the app run locally without an
 * SMTP server while keeping the call-sites unaware of the difference.
 */
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
      // Only add auth when credentials are provided (Mailpit needs none)
      ...(process.env.SMTP_USER && process.env.SMTP_PASS
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {}),
    })
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.transporter) {
      return { success: true } // gracefully skip when SMTP is not configured
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? "noreply@hay2010.ma",
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
