import { describe, it, expect, beforeAll } from "vitest"
import * as schema from "../../db/schema"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { listForUser, countUnread } from "./queries"

const TIMEOUT = 30_000

describe("notification queries", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb
  let userId: string
  let otherUserId: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()

    const societeId = crypto.randomUUID()
    const departementId = crypto.randomUUID()
    userId = crypto.randomUUID()
    otherUserId = crypto.randomUUID()

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
        nom: "User",
        prenom: "Test",
        poste: "Employee",
        role: "EMPLOYEE",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
      {
        id: otherUserId,
        email: "other@test.com",
        nom: "Other",
        prenom: "User",
        poste: "Employee",
        role: "EMPLOYEE",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
    ])

    const demandeId = crypto.randomUUID()
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

    // unread notifications for userId
    await pgliteDb.insert(schema.notifications).values([
      {
        id: crypto.randomUUID(),
        utilisateurId: userId,
        demandeId,
        titre: "Nouvelle demande",
        message: "Test message",
        lu: false,
        creeLe: new Date("2026-07-01T10:00:00Z"),
      },
      {
        id: crypto.randomUUID(),
        utilisateurId: userId,
        demandeId,
        titre: "Demande approuvée",
        message: "Test message",
        lu: false,
        creeLe: new Date("2026-07-02T10:00:00Z"),
      },
      // read notification for userId
      {
        id: crypto.randomUUID(),
        utilisateurId: userId,
        demandeId: null,
        titre: "Ancienne notification",
        message: "Deja lue",
        lu: true,
        creeLe: new Date("2026-06-01T10:00:00Z"),
      },
      // notification for other user
      {
        id: crypto.randomUUID(),
        utilisateurId: otherUserId,
        demandeId,
        titre: "Autre notification",
        message: "Pour autre utilisateur",
        lu: false,
        creeLe: new Date("2026-07-03T10:00:00Z"),
      },
    ])
  })

  it("countUnread returns only unread notifications for the given user", async () => {
    const count = await countUnread(userId, pgliteDb as any)
    expect(count).toBe(2)
  })

  it("countUnread returns 0 when user has no unread notifications", async () => {
    // Create a user with no unread notifications
    const societeId = crypto.randomUUID()
    const departementId = crypto.randomUUID()
    const noUnreadUserId = crypto.randomUUID()

    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Another Societe",
      modifieLe: new Date(),
    })

    await pgliteDb.insert(schema.departements).values({
      id: departementId,
      nom: "Another Departement",
      societeId,
    })

    await pgliteDb.insert(schema.utilisateurs).values({
      id: noUnreadUserId,
      email: "nunread@test.com",
      nom: "NoUnread",
      prenom: "User",
      poste: "Employee",
      role: "EMPLOYEE",
      departementId,
      societeId,
      actif: true,
      modifieLe: new Date(),
    })

    // Insert only read notifications for this user
    await pgliteDb.insert(schema.notifications).values({
      id: crypto.randomUUID(),
      utilisateurId: noUnreadUserId,
      demandeId: null,
      titre: "Deja lue",
      message: "This was already read",
      lu: true,
      creeLe: new Date("2026-07-01T10:00:00Z"),
    })

    const count = await countUnread(noUnreadUserId, pgliteDb as any)
    expect(count).toBe(0)
  })

  it("countUnread returns 0 when user has no notifications at all", async () => {
    const count = await countUnread("nonexistent-user", pgliteDb as any)
    expect(count).toBe(0)
  })

  it("countUnread is scoped to the given userId", async () => {
    const count = await countUnread(otherUserId, pgliteDb as any)
    expect(count).toBe(1)
  })

  it("listForUser returns notifications ordered by creeLe desc", async () => {
    const result = await listForUser(userId, pgliteDb as any)
    expect(result).toHaveLength(3)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].creeLe.getTime()).toBeLessThanOrEqual(
        result[i - 1].creeLe.getTime()
      )
    }
  })

  it("listForUser is scoped to the given userId", async () => {
    const result = await listForUser(otherUserId, pgliteDb as any)
    expect(result).toHaveLength(1)
    expect(result[0].utilisateurId).toBe(otherUserId)
  })

  it("listForUser returns empty array when user has no notifications", async () => {
    const result = await listForUser("nonexistent-user", pgliteDb as any)
    expect(result).toEqual([])
  })
})
