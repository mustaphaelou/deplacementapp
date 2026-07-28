import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"
import type { EmailTransporter } from "./email-sender"

export class SmtpTransporter implements EmailTransporter {
  private transporter: Transporter

  constructor() {
    const host = process.env.SMTP_HOST!
    const port = process.env.SMTP_PORT!

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      ...(process.env.SMTP_USER && process.env.SMTP_PASS
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {}),
    })
  }

  async sendMail(opts: { from: string; to: string; subject: string; text: string; html?: string }): Promise<unknown> {
    return this.transporter.sendMail(opts)
  }
}

export class NullTransporter implements EmailTransporter {
  private warned = false

  async sendMail(_opts: { from: string; to: string; subject: string; text: string; html?: string }): Promise<unknown> {
    if (!this.warned) {
      console.warn("[NullTransporter] SMTP not configured — email skipped")
      this.warned = true
    }
    return undefined
  }
}
