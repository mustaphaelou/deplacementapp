import { describe, it, expect, beforeAll, vi } from "vitest"
import * as schema from "../../db/schema"
import * as dbModule from "../../db"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { createDraft, createAndSubmit, executeTransition } from "./mutations"
import { findById } from "./queries"
import type { Etape, Decision } from "../workflow"

/**
 * #295 — the demande row's Etape and Decision arrive as the pipeline's own
 * vocabulary, proven BY CONSTRUCTION rather than by cast.
 *
 * Each case seeds a DemandeDeplacement at one lane with one Decision, reads it
 * back through the read model's own interface (`findById`), and assigns what
 * came back into the pipeline's unions. There is no `as Etape` and no
 * `as Decision` anywhere in this file: the fixture literals typecheck because
 * the row's fields ARE those unions, so a lane the database cannot store is not
 * spellable here in the first place.
 *
 * This file is its OWN suite with its own PGlite instance rather than a block
 * inside queries.test.ts, for a measured reason: the sibling suite asserts
 * hardcoded totals (aggregateBudget expects 9200, countDemandes expects an
 * exact count) over a database seeded once in `beforeAll`. Seeding five more
 * rows into that shared instance moved those totals and turned six of its
 * tests red. A fixture that changes another suite's numbers is not a fixture.
 */

const TIMEOUT = 30_000

describe(
  "the demande row's Etape and Decision (#295, PGLite)",
  { timeout: TIMEOUT },
  () => {
    let pgliteDb: PgliteDb
    let employeeId: string
    let managerId: string
    let financeAdminId: string
    let societeId: string
    let departementId: string

    const employee = () => ({ id: employeeId, role: "EMPLOYEE" as const })

    const sampleData = {
      motif: ["mission_client"],
      dateDepart: "2025-07-01",
      dateRetour: "2025-07-03",
      destination: "Casablanca",
      typeTransport: "AVION" as const,
      fraisTransport: "1500",
      fraisHebergement: "2000",
      fraisRepas: "800",
      fraisDivers: "300",
      avanceRequise: false,
      montantAvance: "0",
      description: "Mission client",
    }

    beforeAll(async () => {
      pgliteDb = await createPgliteDb()
      vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb as any)

      societeId = crypto.randomUUID()
      departementId = crypto.randomUUID()
      employeeId = crypto.randomUUID()
      managerId = crypto.randomUUID()
      financeAdminId = crypto.randomUUID()

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
          prenom: "Claire",
          poste: "Manager",
          role: "MANAGER",
          departementId,
          societeId,
          actif: true,
          modifieLe: new Date(),
        },
        {
          id: financeAdminId,
          email: "finance@test.com",
          nom: "Bernard",
          prenom: "Alice",
          poste: "Finance",
          role: "FINANCE_ADMIN",
          departementId,
          societeId,
          actif: true,
          modifieLe: new Date(),
        },
      ])
    })

    // One case per (lane, Decision) pair production can actually produce. The
    // `satisfies` clause is the fixture: the literals below are checked against
    // the pipeline's unions at compile time, with no cast.
    const CASES = [
      {
        name: "a draft is DRAFT / PENDING",
        etape: "DRAFT",
        decision: "PENDING",
        seed: async () => (await createDraft(sampleData, employee())).id,
      },
      {
        name: "a submitted demande is MANAGER_REVIEW / PENDING",
        etape: "MANAGER_REVIEW",
        decision: "PENDING",
        seed: async () => (await createAndSubmit(sampleData, employee())).id,
      },
      {
        name: "a manager-approved demande is FINANCE_REVIEW / PENDING",
        etape: "FINANCE_REVIEW",
        decision: "PENDING",
        seed: async () => {
          const d = await createAndSubmit(sampleData, employee())
          await executeTransition({
            demandeId: d.id,
            action: "approuver",
            actor: { id: managerId, role: "MANAGER" },
          })
          return d.id
        },
      },
      {
        name: "a rejected demande keeps its lane and records REJECTED",
        etape: "FINANCE_REVIEW",
        decision: "REJECTED",
        seed: async () => {
          const d = await createAndSubmit(sampleData, employee())
          await executeTransition({
            demandeId: d.id,
            action: "approuver",
            actor: { id: managerId, role: "MANAGER" },
          })
          await executeTransition({
            demandeId: d.id,
            action: "rejeter",
            actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
          })
          return d.id
        },
      },
      {
        name: "a withdrawn draft stays DRAFT and records WITHDRAWN",
        etape: "DRAFT",
        decision: "WITHDRAWN",
        seed: async () => {
          const d = await createDraft(sampleData, employee())
          await executeTransition({
            demandeId: d.id,
            action: "retirer",
            actor: employee(),
          })
          return d.id
        },
      },
    ] as const satisfies readonly {
      name: string
      etape: Etape
      decision: Decision
      seed: () => Promise<string>
    }[]

    it.each(CASES)("$name", async ({ seed, etape, decision }) => {
      const id = await seed()
      const demande = await findById(id, employee())

      // No cast on either side: the row's fields already are the unions. Were
      // they `string` again these two lines would still compile — which is why
      // the pin in the OTHER direction lives in
      // lib/demande-types.row-types.test.ts, where widening the field makes
      // `npm run typecheck` fail.
      const readEtape: Etape = demande.etape
      const readDecision: Decision = demande.decision

      expect(readEtape).toBe(etape)
      expect(readDecision).toBe(decision)
    })

    it("reads a terminal Decision without a cast on a decided row", async () => {
      // The decided case on its own, read through the same interface: a
      // REJECTED demande keeps its Etape and carries the Decision the pipeline
      // recorded (CONTEXT.md — Decision).
      const d = await createAndSubmit(sampleData, employee())
      await executeTransition({
        demandeId: d.id,
        action: "approuver",
        actor: { id: managerId, role: "MANAGER" },
      })
      await executeTransition({
        demandeId: d.id,
        action: "rejeter",
        actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
      })

      const demande = await findById(d.id, employee())

      const readEtape: Etape = demande.etape
      const readDecision: Decision = demande.decision

      expect(readEtape).toBe("FINANCE_REVIEW")
      expect(readDecision).toBe("REJECTED")
    })
  }
)
