import { describe, it, expect, beforeAll, vi, beforeEach } from "vitest"
import { eq } from "drizzle-orm"
import * as schema from "../../db/schema"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { DrizzleNotificationAdapter, sendEmail } from "./adapter"
import type { NotificationMessage } from "../notification-events"
import { emailSender } from "../email-sender"

vi.mock("../email-sender", () => ({
  emailSender: { send: vi.fn() },
}))

const TIMEOUT = 30_000

describe("DrizzleNotificationAdapter", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb
  let userId: string
  let demandeId: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()

    const societeId = crypto.randomUUID()
    const departementId = crypto.randomUUID()
    userId = crypto.randomUUID()
    demandeId = crypto.randomUUID()

    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Test Societe",
      modifieLe: new Date(),
    })

    await pgliteDb.insert(schema.departements).values({
      id: departementId,
      nom: "Test Departement",
      societeId,
    })

    await pgliteDb.insert(schema.utilisateurs).values({
      id: userId,
      email: "user@test.com",
      nom: "User",
      prenom: "Test",
      poste: "Employee",
      role: "EMPLOYEE",
      departementId,
      societeId,
      actif: true,
      modifieLe: new Date(),
    })

    await pgliteDb.insert(schema.demandesDeplacement).values({
      id: demandeId,
      numero: "DD-2026-TEST",
      employeId: userId,
      employeNom: "User",
      employePrenom: "Test",
      employePoste: "Employee",
      employeDepartement: "Test Departement",
      etape: "MANAGER_REVIEW",
      decision: "PENDING",
      motif: JSON.stringify(["mission"]),
      dateDepart: new Date("2026-08-01"),
      dateRetour: new Date("2026-08-03"),
      destination: "Casablanca",
      typeTransport: "VOITURE_PERSONNELLE",
      modifieLe: new Date(),
    } as any)
  })

  it("inserts a notification row into the notifications table", async () => {
    const adapter = new DrizzleNotificationAdapter(pgliteDb as any)
    const message: NotificationMessage = {
      titre: "Nouvelle demande",
      message: "Test message content",
      utilisateurId: userId,
      demandeId,
    }

    const result = await adapter.send(message)

    expect(result.success).toBe(true)

    const rows = await pgliteDb
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.utilisateurId, userId))

    expect(rows).toHaveLength(1)
    expect(rows[0].titre).toBe("Nouvelle demande")
    expect(rows[0].message).toBe("Test message content")
    expect(rows[0].utilisateurId).toBe(userId)
    expect(rows[0].demandeId).toBe(demandeId)
    expect(rows[0].lu).toBe(false)
  })

  it("inserts notification with null demandeId", async () => {
    const adapter = new DrizzleNotificationAdapter(pgliteDb as any)
    const message: NotificationMessage = {
      titre: "Notification sans demande",
      message: "Test message",
      utilisateurId: userId,
      demandeId: null as any,
    }

    const result = await adapter.send(message)
    expect(result.success).toBe(true)
  })

  it("returns failure when insert fails", async () => {
    // Pass an invalid db to force a failure
    const adapter = new DrizzleNotificationAdapter(null as any)
    const message: NotificationMessage = {
      titre: "Fail",
      message: "Should fail",
      utilisateurId: "nonexistent",
      demandeId: null as any,
    }

    const result = await adapter.send(message)
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe("sendEmail", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb
  let userId: string
  let noEmailUserId: string
  let demandeId: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()

    const societeId = crypto.randomUUID()
    const departementId = crypto.randomUUID()
    userId = crypto.randomUUID()
    noEmailUserId = crypto.randomUUID()
    demandeId = crypto.randomUUID()

    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Test Societe",
      modifieLe: new Date(),
    })

    await pgliteDb.insert(schema.departements).values({
      id: departementId,
      nom: "Test Departement",
      societeId,
    })

    await pgliteDb.insert(schema.utilisateurs).values([
      {
        id: userId,
        email: "user@test.com",
        nom: "Dupont",
        prenom: "Jean",
        poste: "Employee",
        role: "EMPLOYEE",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
      {
        id: noEmailUserId,
        email: "",
        nom: "NoEmail",
        prenom: "User",
        poste: "Employee",
        role: "EMPLOYEE",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
    ])

    await pgliteDb.insert(schema.demandesDeplacement).values({
      id: demandeId,
      numero: "DD-2026-TEST",
      employeId: userId,
      employeNom: "User",
      employePrenom: "Test",
      employePoste: "Employee",
      employeDepartement: "Test Departement",
      etape: "MANAGER_REVIEW",
      decision: "PENDING",
      motif: JSON.stringify(["mission"]),
      dateDepart: new Date("2026-08-01"),
      dateRetour: new Date("2026-08-03"),
      destination: "Casablanca",
      typeTransport: "VOITURE_PERSONNELLE",
      modifieLe: new Date(),
    } as any)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sends email to recipient with correct subject and message", async () => {
    const notification: NotificationMessage = {
      titre: "Nouvelle demande de déplacement",
      message: "Jean Dupont a soumis une demande.",
      utilisateurId: userId,
      demandeId,
    }

    await sendEmail(notification, pgliteDb as any)

    expect(emailSender.send).toHaveBeenCalledTimes(1)
    const call = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.to).toBe("user@test.com")
    expect(call.subject).toBe("Nouvelle demande de déplacement")
    expect(call.text).toBe("Jean Dupont a soumis une demande.")
    expect(call.html).toContain("Nouvelle demande de déplacement")
    expect(call.html).toContain("Jean Dupont a soumis une demande")
  })

  it("is a no-op when recipient has no email address", async () => {
    const notification: NotificationMessage = {
      titre: "Test notification",
      message: "Test message",
      utilisateurId: noEmailUserId,
      demandeId,
    }

    await sendEmail(notification, pgliteDb as any)

    expect(emailSender.send).not.toHaveBeenCalled()
  })

  it("is a no-op when recipient does not exist", async () => {
    const notification: NotificationMessage = {
      titre: "Test notification",
      message: "Test message",
      utilisateurId: "nonexistent-user",
      demandeId,
    }

    await sendEmail(notification, pgliteDb as any)

    expect(emailSender.send).not.toHaveBeenCalled()
  })
})
