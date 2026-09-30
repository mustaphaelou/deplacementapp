/**
 * #315 — the recipient resolver asks the Utilisateur module for the activity
 * rule instead of spelling it.
 *
 * This is the Notification half of the ticket, and it is asserted as a SET,
 * not as a string: « only active Utilisateurs are notified » is a claim about
 * which rows come back, so a grep for the column would prove nothing about it.
 * The seed below is deliberately mixed — active and inactive Utilisateurs in
 * the same role and the same Departement — because a suite seeded only with
 * active Utilisateurs passes whether or not the rule is applied at all.
 *
 * `tx` is positional with no default, so a real handle is passed: the
 * conditions are only meaningful as SQL, and a mock query builder would let a
 * wrong condition through.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { sql } from "drizzle-orm"
import * as schema from "../../db/schema"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { resolveRecipients } from "./helpers"
import type { NotificationPayload } from "../notification-events"
import type { Role } from "../auth/roles"

const TIMEOUT = 30_000

interface Seeded {
  role: Role
  departementId: string
  actif: boolean
}

describe("resolveRecipients — the activity rule comes from the Utilisateur reader", {
  timeout: TIMEOUT,
}, () => {
  let pgliteDb: PgliteDb
  let societeId: string
  let rhId: string
  let marketingId: string
  // The mixed set: two MANAGERs in the employee's own Departement, one active
  // and one not, plus an active one elsewhere so « department scoped » and
  // « active » stay two independent axes.
  let managerActif: string
  let managerInactif: string
  let managerActifAutreDept: string
  let financeActif: string
  let financeInactif: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
  })

  beforeEach(async () => {
    await pgliteDb.execute(sql`DELETE FROM utilisateurs`)
    await pgliteDb.execute(sql`DELETE FROM departements`)
    await pgliteDb.execute(sql`DELETE FROM societes`)

    societeId = crypto.randomUUID()
    rhId = crypto.randomUUID()
    marketingId = crypto.randomUUID()
    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Acme",
      modifieLe: new Date(),
    })
    await pgliteDb.insert(schema.departements).values([
      { id: rhId, nom: "RH", societeId },
      { id: marketingId, nom: "Marketing", societeId },
    ])

    const seeded: Seeded[] = [
      { role: "MANAGER", departementId: rhId, actif: true },
      { role: "MANAGER", departementId: rhId, actif: false },
      { role: "MANAGER", departementId: marketingId, actif: true },
      { role: "FINANCE_ADMIN", departementId: rhId, actif: true },
      { role: "FINANCE_ADMIN", departementId: marketingId, actif: false },
      { role: "EMPLOYEE", departementId: rhId, actif: true },
    ]

    const ids = new Map<Seeded, string>()
    await pgliteDb.insert(schema.utilisateurs).values(
      seeded.map((row) => {
        const id = crypto.randomUUID()
        ids.set(row, id)
        return {
          id,
          email: `${id}@acme.ma`,
          nom: "Dupont",
          prenom: "Jean",
          poste: "Dev",
          role: row.role,
          departementId: row.departementId,
          societeId,
          actif: row.actif,
          creeLe: new Date("2026-01-01"),
          modifieLe: new Date("2026-01-01"),
        }
      })
    )

    const idOf = (index: number): string =>
      ids.get(seeded[index] as Seeded) as string
    managerActif = idOf(0)
    managerInactif = idOf(1)
    managerActifAutreDept = idOf(2)
    financeActif = idOf(3)
    financeInactif = idOf(4)
  })

  const payload = (overrides?: Partial<NotificationPayload>) =>
    ({
      demandeId: "d-1",
      numero: "DD-2026-0001",
      employe: {
        id: "emp-1",
        prenom: "Jean",
        nom: "Dupont",
        departementId: rhId,
      },
      ...overrides,
    }) as NotificationPayload

  // The set assertion the ticket asks for. Before #315 the resolver spelled
  // `eq(utilisateurs.actif, true)`; the seeded inactive MANAGER is what makes
  // that spelling observable, so this is the test that goes RED if the rule is
  // dropped, widened, or written a third time with different semantics.
  it("resolves a mixed active-and-inactive set to the active Utilisateurs only", async () => {
    const recipients = await resolveRecipients(
      "DEMANDE_SOUMISE",
      payload(),
      pgliteDb as any
    )

    expect([...recipients].sort()).toEqual([managerActif])
    expect(recipients).not.toContain(managerInactif)
    // Department scoping is unchanged and independent of activity.
    expect(recipients).not.toContain(managerActifAutreDept)
  })

  it("applies the activity rule to an unscoped role too", async () => {
    const recipients = await resolveRecipients(
      "DEMANDE_APPROBATION_MANAGER",
      payload(),
      pgliteDb as any
    )

    expect([...recipients].sort()).toEqual([financeActif])
    expect(recipients).not.toContain(financeInactif)
  })

  // The event's own additions are untouched by the activity rule: the employee
  // and the assignee are added by the resolver's recipient rules, not filtered
  // by them, exactly as before #315.
  it("still adds the employee and the assignee regardless of activity", async () => {
    const approbation = await resolveRecipients(
      "DEMANDE_APPROBATION_FINALE",
      payload(),
      pgliteDb as any
    )
    expect(approbation).toEqual(["emp-1"])

    const retiree = await resolveRecipients(
      "DEMANDE_RETIREE",
      payload({ assigneAId: "assigne-1" }),
      pgliteDb as any
    )
    expect(retiree).toEqual(["assigne-1"])
  })
})

/**
 * The pin that the resolver takes its activity condition FROM THE READER
 * rather than writing its own.
 *
 * It is a substitution, not a grep: the reader module's `conditionActif` is
 * replaced by one that admits EVERY Utilisateur, and the resolver's answer is
 * asserted to follow. If the resolver spelled its own
 * `eq(utilisateurs.actif, true)`, the substitution would have no effect on it,
 * the inactive MANAGER would stay out of the set, and this test would fail.
 *
 * The substitution is deliberately the OPPOSITE of the real rule (wider, not
 * narrower): a narrower stand-in would only prove the resolver applies
 * something, not that what it applies is the reader's.
 *
 * The describe carries an explicit timeout: it boots its own PGlite inside the
 * test, and a PGlite `create()` under full-suite load does not fit in the 5s
 * default. (The same reason `describe(..., { timeout: TIMEOUT })` appears in
 * the block above.)
 */
describe("resolveRecipients — asks the reader for the activity condition", {
  timeout: TIMEOUT,
}, () => {
  it("follows the condition the reader's module exports", async () => {
    const pgliteDb = await createPgliteDb()
    const societeId = crypto.randomUUID()
    const rhId = crypto.randomUUID()
    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Acme",
      modifieLe: new Date(),
    })
    await pgliteDb.insert(schema.departements).values({
      id: rhId,
      nom: "RH",
      societeId,
    })

    const rows: Array<{ id: string; actif: boolean }> = [true, false].map(
      (actif) => {
        const id = crypto.randomUUID()
        return { id, actif }
      }
    )
    await pgliteDb.insert(schema.utilisateurs).values(
      rows.map((row) => ({
        id: row.id,
        email: `${row.id}@acme.ma`,
        nom: "Dupont",
        prenom: "Jean",
        poste: "Dev",
        role: "MANAGER" as const,
        departementId: rhId,
        societeId,
        actif: row.actif,
        creeLe: new Date("2026-01-01"),
        modifieLe: new Date("2026-01-01"),
      }))
    )
    const inactifId = rows.find((row) => !row.actif)?.id as string

    vi.resetModules()
    vi.doMock("../utilisateur-service", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../utilisateur-service")>()
      return { ...actual, conditionActif: sql`true` }
    })
    try {
      const { resolveRecipients: substituted } = await import("./helpers")
      const recipients = await substituted(
        "DEMANDE_SOUMISE",
        {
          demandeId: "d-1",
          numero: "DD-2026-0001",
          employe: {
            id: "emp-1",
            prenom: "Jean",
            nom: "Dupont",
            departementId: rhId,
          },
        } as NotificationPayload,
        pgliteDb as any
      )

      // With the reader's condition admitting everyone, the inactive MANAGER is
      // a recipient. The resolver's own spelling, if it had one, would keep it
      // out and fail this line.
      expect(recipients).toContain(inactifId)
      expect(recipients).toHaveLength(2)
    } finally {
      vi.doUnmock("../utilisateur-service")
      vi.resetModules()
    }
  })
})
