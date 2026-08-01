import { describe, it, expect, beforeAll } from "vitest"
import { eq } from "drizzle-orm"
import * as schema from "../db/schema"
import { createPgliteDb } from "./test/create-pglite-db"
import type { PgliteDb } from "./test/create-pglite-db"
import { logAudit, type AuditEvent } from "./audit"

const TIMEOUT = 30_000

describe("logAudit", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb
  let userId: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()

    const societeId = crypto.randomUUID()
    const departementId = crypto.randomUUID()
    userId = crypto.randomUUID()

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
  })

  it("persists an audit event with all fields", async () => {
    const event: AuditEvent = {
      utilisateurId: userId,
      action: "CREATION_UTILISATEUR",
      entite: "Utilisateur",
      entiteId: "entity-1",
      details: { email: "test@example.com" },
    }

    await logAudit(event, pgliteDb)

    const rows = await pgliteDb
      .select()
      .from(schema.journalAudit)
      .where(eq(schema.journalAudit.utilisateurId, userId))

    expect(rows).toHaveLength(1)
    expect(rows[0].utilisateurId).toBe(userId)
    expect(rows[0].action).toBe("CREATION_UTILISATEUR")
    expect(rows[0].entite).toBe("Utilisateur")
    expect(rows[0].entiteId).toBe("entity-1")
    expect(rows[0].details).toBe('{"email":"test@example.com"}')
    expect(rows[0].creeLe).toBeInstanceOf(Date)
  })

  it("persists an audit event without optional fields", async () => {
    const event: AuditEvent = {
      utilisateurId: userId,
      action: "SUPPRESSION",
      entite: "VehiculeEntreprise",
    }

    await logAudit(event, pgliteDb)

    const rows = await pgliteDb
      .select()
      .from(schema.journalAudit)
      .where(eq(schema.journalAudit.action, "SUPPRESSION"))

    expect(rows).toHaveLength(1)
    expect(rows[0].entiteId).toBeNull()
    expect(rows[0].details).toBeNull()
  })

  it("handles details with nested objects", async () => {
    const event: AuditEvent = {
      utilisateurId: userId,
      action: "MODIFICATION_COMPLEXE",
      entite: "DemandeDeplacement",
      entiteId: "demande-1",
      details: {
        champs: ["nom", "dateDepart"],
        ancienneValeur: { nom: "Ancien" },
      },
    }

    await logAudit(event, pgliteDb)

    const rows = await pgliteDb
      .select()
      .from(schema.journalAudit)
      .where(eq(schema.journalAudit.action, "MODIFICATION_COMPLEXE"))

    expect(rows).toHaveLength(1)
    expect(JSON.parse(rows[0].details!)).toEqual({
      champs: ["nom", "dateDepart"],
      ancienneValeur: { nom: "Ancien" },
    })
  })

  it("works within a Drizzle transaction", async () => {
    await pgliteDb.transaction(async (tx) => {
      const event: AuditEvent = {
        utilisateurId: userId,
        action: "TRANSACTION_TEST",
        entite: "DemandeDeplacement",
        entiteId: "tx-demande",
      }

      await logAudit(event, tx)
    })

    const rows = await pgliteDb
      .select()
      .from(schema.journalAudit)
      .where(eq(schema.journalAudit.action, "TRANSACTION_TEST"))

    expect(rows).toHaveLength(1)
    expect(rows[0].entiteId).toBe("tx-demande")
  })

  it("rolls back the audit row when the transaction is aborted", async () => {
    try {
      await pgliteDb.transaction(async (tx) => {
        const event: AuditEvent = {
          utilisateurId: userId,
          action: "ROLLBACK_TEST",
          entite: "DemandeDeplacement",
        }

        await logAudit(event, tx)
        throw new Error("force rollback")
      })
    } catch {
      // expected
    }

    const rows = await pgliteDb
      .select()
      .from(schema.journalAudit)
      .where(eq(schema.journalAudit.action, "ROLLBACK_TEST"))

    expect(rows).toHaveLength(0)
  })

  it("generates a creeLe timestamp on insert", async () => {
    const event: AuditEvent = {
      utilisateurId: userId,
      action: "TIMESTAMP_TEST",
      entite: "Utilisateur",
    }

    await logAudit(event, pgliteDb)

    const rows = await pgliteDb
      .select()
      .from(schema.journalAudit)
      .where(eq(schema.journalAudit.action, "TIMESTAMP_TEST"))

    expect(rows[0].creeLe).toBeInstanceOf(Date)
    expect(rows[0].creeLe.getTime()).toBeGreaterThan(0)
  })
})
