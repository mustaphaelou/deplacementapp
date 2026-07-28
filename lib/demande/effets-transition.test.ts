import { describe, it, expect, beforeAll, vi } from "vitest"
import { eq } from "drizzle-orm"
import * as schema from "../../db/schema"
import * as dbModule from "../../db"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { appliquerEffets } from "./effets-transition"

const TIMEOUT = 30_000

describe("appliquerEffets", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb
  let employeeId: string
  let managerId: string
  let departementId: string
  let demandeId: string
  let numero: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
    vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb as any)

    const societeId = crypto.randomUUID()
    departementId = crypto.randomUUID()
    employeeId = crypto.randomUUID()
    managerId = crypto.randomUUID()
    demandeId = crypto.randomUUID()
    numero = "DD-2026-0001"

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
        id: employeeId,
        email: "employee@test.com",
        nom: "Dupont",
        prenom: "Jean",
        poste: "Developpeur",
        role: "EMPLOYEE",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
      {
        id: managerId,
        email: "manager@test.com",
        nom: "Martin",
        prenom: "Sophie",
        poste: "Chef d'equipe",
        role: "MANAGER",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
    ])
  })

  it("inserts JournalAudit and Notification rows inside a transaction", async () => {
    await pgliteDb.transaction(async (tx) => {
      await tx.insert(schema.demandesDeplacement).values({
        id: demandeId,
        numero,
        employeId: employeeId,
        employeNom: "Dupont",
        employePrenom: "Jean",
        employePoste: "Developpeur",
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

      await appliquerEffets(tx as any, {
        audit: {
          utilisateurId: employeeId,
          action: "SOUMISSION",
          entiteId: demandeId,
          numero,
        },
        notification: {
          event: "DEMANDE_SOUMISE",
          demandeId,
          numero,
          employe: {
            id: employeeId,
            prenom: "Jean",
            nom: "Dupont",
            departementId,
          },
          assigneAId: null,
        },
      })
    })

    const auditRows = await pgliteDb
      .select()
      .from(schema.journalAudit)
      .where(eq(schema.journalAudit.entiteId, demandeId))
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0].action).toBe("SOUMISSION")
    expect(auditRows[0].utilisateurId).toBe(employeeId)

    const notifRows = await pgliteDb
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.demandeId, demandeId))
    expect(notifRows.length).toBeGreaterThan(0)
    expect(notifRows[0].titre).toBe("Nouvelle demande de déplacement")
  })

  it("skips notification rows when notification param is null", async () => {
    const otherDemandeId = crypto.randomUUID()

    await pgliteDb.transaction(async (tx) => {
      await appliquerEffets(tx as any, {
        audit: {
          utilisateurId: employeeId,
          action: "CREATION",
          entiteId: otherDemandeId,
          numero: "DD-2026-0002",
        },
        notification: null,
      })
    })

    const auditRows = await pgliteDb
      .select()
      .from(schema.journalAudit)
      .where(eq(schema.journalAudit.entiteId, otherDemandeId))
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0].action).toBe("CREATION")

    const notifRows = await pgliteDb
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.demandeId, otherDemandeId))
    expect(notifRows).toHaveLength(0)
  })

  it("rolls back all side effects when the transaction aborts", async () => {
    const rollbackDemandeId = crypto.randomUUID()

    await expect(
      pgliteDb.transaction(async (tx) => {
        await tx.insert(schema.demandesDeplacement).values({
          id: rollbackDemandeId,
          numero: "DD-2026-0999",
          employeId: employeeId,
          employeNom: "Dupont",
          employePrenom: "Jean",
          employePoste: "Developpeur",
          employeDepartement: "Test Departement",
          etape: "MANAGER_REVIEW",
          decision: "PENDING",
          motif: JSON.stringify(["mission"]),
          dateDepart: new Date("2026-08-01"),
          dateRetour: new Date("2026-08-03"),
          destination: "Rabat",
          typeTransport: "VOITURE_PERSONNELLE",
          modifieLe: new Date(),
        } as any)

        await appliquerEffets(tx as any, {
          audit: {
            utilisateurId: employeeId,
            action: "SOUMISSION",
            entiteId: rollbackDemandeId,
            numero,
          },
          notification: {
            event: "DEMANDE_SOUMISE",
            demandeId: rollbackDemandeId,
            numero,
            employe: {
              id: employeeId,
              prenom: "Jean",
              nom: "Dupont",
              departementId,
            },
            assigneAId: null,
          },
        })

        throw new Error("force rollback")
      }),
    ).rejects.toThrow("force rollback")

    const auditRows = await pgliteDb
      .select()
      .from(schema.journalAudit)
      .where(eq(schema.journalAudit.entiteId, rollbackDemandeId))
    expect(auditRows).toHaveLength(0)

    const notifRows = await pgliteDb
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.demandeId, rollbackDemandeId))
    expect(notifRows).toHaveLength(0)
  })
})
