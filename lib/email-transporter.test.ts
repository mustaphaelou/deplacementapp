import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import nodemailer from "nodemailer"
import { SmtpTransporter, NullTransporter } from "./email-transporter"

describe("SmtpTransporter", () => {
  const fakeTransporter = {
    sendMail: vi.fn().mockResolvedValue({ messageId: "123" }),
  }

  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp.test.com")
    vi.stubEnv("SMTP_PORT", "587")
    vi.stubEnv("SMTP_USER", "user")
    vi.stubEnv("SMTP_PASS", "pass")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("reads env vars in constructor, not in sendMail", () => {
    const createTransportSpy = vi.spyOn(nodemailer, "createTransport").mockReturnValue(fakeTransporter as any)
    vi.stubEnv("SMTP_HOST", "smtp.example.com")
    vi.stubEnv("SMTP_PORT", "465")

    new SmtpTransporter()

    expect(createTransportSpy).toHaveBeenCalledTimes(1)
    expect(createTransportSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 465,
        secure: true,
      })
    )
    createTransportSpy.mockRestore()
  })

  it("forwards sendMail args preserving the shape", async () => {
    vi.spyOn(nodemailer, "createTransport").mockReturnValue(fakeTransporter as any)

    const transporter = new SmtpTransporter()
    await transporter.sendMail({
      from: '"Sender" <sender@test.com>',
      to: "recipient@test.com",
      subject: "Test Subject",
      text: "Test body",
      html: "<p>Test body</p>",
    })

    expect(fakeTransporter.sendMail).toHaveBeenCalledTimes(1)
    expect(fakeTransporter.sendMail).toHaveBeenCalledWith({
      from: '"Sender" <sender@test.com>',
      to: "recipient@test.com",
      subject: "Test Subject",
      text: "Test body",
      html: "<p>Test body</p>",
    })
  })

  it("handles missing auth config", () => {
    vi.stubEnv("SMTP_USER", "")
    vi.stubEnv("SMTP_PASS", "")

    const createTransportSpy = vi.spyOn(nodemailer, "createTransport").mockReturnValue(fakeTransporter as any)

    new SmtpTransporter()

    expect(createTransportSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ auth: expect.anything() })
    )
    createTransportSpy.mockRestore()
  })
})

describe("NullTransporter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("warns on first sendMail call", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const transporter = new NullTransporter()
    await transporter.sendMail({
      from: '"Sender" <sender@test.com>',
      to: "recipient@test.com",
      subject: "Test",
      text: "Test",
    })

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith("[NullTransporter] SMTP not configured — email skipped")

    warnSpy.mockRestore()
  })

  it("does not warn on subsequent calls to same instance", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const transporter = new NullTransporter()
    await transporter.sendMail({ from: "a@b.com", to: "c@d.com", subject: "S1", text: "T1" })
    await transporter.sendMail({ from: "a@b.com", to: "c@d.com", subject: "S2", text: "T2" })
    await transporter.sendMail({ from: "a@b.com", to: "c@d.com", subject: "S3", text: "T3" })

    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })

  it("resolves without throwing", async () => {
    const transporter = new NullTransporter()
    const result = await transporter.sendMail({
      from: '"Sender" <sender@test.com>',
      to: "recipient@test.com",
      subject: "Test",
      text: "Test",
    })

    expect(result).toBeUndefined()
  })

  it("warns again on a fresh instance", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const t1 = new NullTransporter()
    await t1.sendMail({ from: "a@b.com", to: "c@d.com", subject: "S1", text: "T1" })

    const t2 = new NullTransporter()
    await t2.sendMail({ from: "a@b.com", to: "c@d.com", subject: "S2", text: "T2" })

    expect(warnSpy).toHaveBeenCalledTimes(2)

    warnSpy.mockRestore()
  })
})
