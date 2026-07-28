import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from "vitest"
import { sql } from "drizzle-orm"
import * as schema from "../db/schema"
import * as dbModule from "../db"
import { createPgliteDb } from "./test/create-pglite-db"
import type { PgliteDb } from "./test/create-pglite-db"
import { EmailSender } from "./email-sender"
import type { EmailTransporter } from "./email-sender"

const TIMEOUT = 30_000

function fakeTransporter(): EmailTransporter & { sendMail: ReturnType<typeof vi.fn> } {
  return { sendMail: vi.fn().mockResolvedValue(undefined) }
}

describe("EmailSender", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb
  let transporter: ReturnType<typeof fakeTransporter>

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
    vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb as any)
  })

  beforeEach(async () => {
    await pgliteDb.execute(sql`DELETE FROM societes`)
    transporter = fakeTransporter()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses nomExpediteurEmail from Societe when set", async () => {
    vi.stubEnv("SMTP_FROM_NAME", "Fallback Name")
    vi.stubEnv("SMTP_FROM", "fallback@exemple.ma")

    await pgliteDb.insert(schema.societes).values({
      id: "s1",
      nom: "Acme SARL",
      nomExpediteurEmail: "Acme RH",
      domaineEmail: "acme.ma",
      modifieLe: new Date(),
    })

    const sender = new EmailSender(transporter)
    const result = await sender.send({
      to: "user@test.com",
      subject: "Test",
      text: "Hello",
    })

    expect(result.success).toBe(true)
    expect(transporter.sendMail).toHaveBeenCalledTimes(1)
    const call = transporter.sendMail.mock.calls[0][0]
    expect(call.from).toBe('"Acme RH" <noreply@acme.ma>')
  })

  it("falls back to env vars when Societe has no nomExpediteurEmail and no domaineEmail", async () => {
    vi.stubEnv("SMTP_FROM_NAME", "Fallback Name")
    vi.stubEnv("SMTP_FROM", "fallback@exemple.ma")

    await pgliteDb.insert(schema.societes).values({
      id: "s2",
      nom: "Acme SARL",
      nomExpediteurEmail: null,
      domaineEmail: null,
      modifieLe: new Date(),
    })

    const sender = new EmailSender(transporter)
    const result = await sender.send({
      to: "user@test.com",
      subject: "Test",
      text: "Hello",
    })

    expect(result.success).toBe(true)
    expect(transporter.sendMail).toHaveBeenCalledTimes(1)
    const call = transporter.sendMail.mock.calls[0][0]
    expect(call.from).toBe('"Fallback Name" <fallback@exemple.ma>')
  })

  it("passes through html content when provided", async () => {
    const sender = new EmailSender(transporter)
    await sender.send({
      to: "user@test.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>",
    })

    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@test.com",
        subject: "Test",
        text: "Hello",
        html: "<p>Hello</p>",
      })
    )
  })

  it("returns error result when transporter throws", async () => {
    transporter.sendMail.mockRejectedValue(new Error("SMTP connection failed"))
    const sender = new EmailSender(transporter)
    const result = await sender.send({
      to: "user@test.com",
      subject: "Test",
      text: "Hello",
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error!.message).toBe("SMTP connection failed")
  })
})
