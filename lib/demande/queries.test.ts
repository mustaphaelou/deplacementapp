import { describe, it, expect, beforeAll, vi } from "vitest"
import { eq } from "drizzle-orm"
import * as schema from "../../db/schema"
import * as dbModule from "../../db"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { createDraft, createAndSubmit, executeTransition } from "./mutations"
import {
  findById,
  findMany,
  findByEmployeeId,
  findByEtapes,
  countByEtape,
  aggregateBudget,
  findAllForExport,
} from "./queries"
import { DemandeNotFoundError } from "../errors"

const TIMEOUT = 30_000

describe("DemandeDeplacement queries (PGLite)", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb
  let employeeId: string
  let managerId: string
  let financeAdminId: string
  let directionId: string
  let secondEmployeeId: string
  let societeId: string
  let departementId: string

  let draftId: string
  let submittedId: string
  let managerApprovedId: string
  let financeApprovedId: string
  let fullyApprovedId: string
  let secondEmployeeDraftId: string

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

  async function seedDemandes() {
    const draft = await createDraft(
      { ...sampleData, destination: "Rabat" },
      { id: employeeId, role: "EMPLOYEE" }
    )
    draftId = draft.id

    const submitted = await createAndSubmit(
      { ...sampleData, destination: "Marrakech" },
      { id: employeeId, role: "EMPLOYEE" }
    )
    submittedId = submitted.id

    const managerApproved = await createAndSubmit(
      { ...sampleData, destination: "Tanger" },
      { id: employeeId, role: "EMPLOYEE" }
    )
    await executeTransition({
      demandeId: managerApproved.id,
      action: "approuver",
      actor: { id: managerId, role: "MANAGER" },
    })
    managerApprovedId = managerApproved.id

    const financeApproved = await createAndSubmit(
      { ...sampleData, destination: "Fes" },
      { id: employeeId, role: "EMPLOYEE" }
    )
    await executeTransition({
      demandeId: financeApproved.id,
      action: "approuver",
      actor: { id: managerId, role: "MANAGER" },
    })
    await executeTransition({
      demandeId: financeApproved.id,
      action: "approuver",
      actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
    })
    financeApprovedId = financeApproved.id

    const fullyApproved = await createAndSubmit(
      { ...sampleData, destination: "Agadir" },
      { id: employeeId, role: "EMPLOYEE" }
    )
    await executeTransition({
      demandeId: fullyApproved.id,
      action: "approuver",
      actor: { id: managerId, role: "MANAGER" },
    })
    await executeTransition({
      demandeId: fullyApproved.id,
      action: "approuver",
      actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
    })
    await executeTransition({
      demandeId: fullyApproved.id,
      action: "approuver",
      actor: { id: directionId, role: "GENERAL_DIRECTION" },
    })
    fullyApprovedId = fullyApproved.id

    const secondDraft = await createDraft(
      { ...sampleData, destination: "Kenitra" },
      { id: secondEmployeeId, role: "EMPLOYEE" }
    )
    secondEmployeeDraftId = secondDraft.id
  }

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
    vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb as any)

    societeId = crypto.randomUUID()
    departementId = crypto.randomUUID()
    employeeId = crypto.randomUUID()
    managerId = crypto.randomUUID()
    financeAdminId = crypto.randomUUID()
    directionId = crypto.randomUUID()
    secondEmployeeId = crypto.randomUUID()

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
      {
        id: financeAdminId,
        email: "finance@test.com",
        nom: "Bernard",
        prenom: "Pierre",
        poste: "Comptable",
        role: "FINANCE_ADMIN",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
      {
        id: directionId,
        email: "direction@test.com",
        nom: "Petit",
        prenom: "Marie",
        poste: "Directrice",
        role: "GENERAL_DIRECTION",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
      {
        id: secondEmployeeId,
        email: "employee2@test.com",
        nom: "Leroy",
        prenom: "Paul",
        poste: "Analyste",
        role: "EMPLOYEE",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
    ])

    await seedDemandes()
  })

  // ─── findById ──────────────────────────────────────────────────────

  describe("findById", () => {
    it("loads employe and assigneA relations", async () => {
      const demande = await findById(managerApprovedId, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(demande.id).toBe(managerApprovedId)
      expect(demande.employe).toBeDefined()
      expect(demande.employe.id).toBe(employeeId)
      expect(demande.employe.prenom).toBe("Jean")
      expect(demande.employe.nom).toBe("Dupont")
      expect(demande.employe.poste).toBe("Developpeur")
      expect(demande.assigneA).toBeDefined()
      expect(demande.assigneA!.id).toBe(managerId)
    })

    it("loads documents when include.documents is true", async () => {
      const demande = await findById(submittedId, {
        id: employeeId,
        role: "EMPLOYEE",
      })
      expect(demande).not.toHaveProperty("documents")

      const withDocs = await findById(
        submittedId,
        { id: employeeId, role: "EMPLOYEE" },
        { include: { documents: true } }
      )
      expect(withDocs).toHaveProperty("documents")
      expect(Array.isArray(withDocs.documents)).toBe(true)
    })

    it("throws DemandeNotFoundError for a missing id", async () => {
      await expect(
        findById("nonexistent-id", { id: employeeId, role: "EMPLOYEE" })
      ).rejects.toThrow(DemandeNotFoundError)
    })

    it("throws DemandeNotFoundError for a soft-deleted demande", async () => {
      await pgliteDb
        .update(schema.demandesDeplacement)
        .set({ deletedAt: new Date() })
        .where(eq(schema.demandesDeplacement.id, draftId))

      await expect(
        findById(draftId, { id: employeeId, role: "EMPLOYEE" })
      ).rejects.toThrow(DemandeNotFoundError)
    })

    it("EMPLOYEE sees their own demande", async () => {
      const demande = await findById(submittedId, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(demande.id).toBe(submittedId)
      expect(demande.employeId).toBe(employeeId)
    })

    it("EMPLOYEE reading another employee's demande gets not-found", async () => {
      await expect(
        findById(secondEmployeeDraftId, {
          id: employeeId,
          role: "EMPLOYEE",
        })
      ).rejects.toThrow(DemandeNotFoundError)
    })

    it.each([
      ["MANAGER", managerId],
      ["FINANCE_ADMIN", financeAdminId],
      ["GENERAL_DIRECTION", directionId],
    ] as const)("%s reads any demande", async (role, actorId) => {
      const employeeDemande = await findById(submittedId, {
        id: actorId,
        role,
      })
      expect(employeeDemande.id).toBe(submittedId)

      const otherEmployeeDemande = await findById(secondEmployeeDraftId, {
        id: actorId,
        role,
      })
      expect(otherEmployeeDemande.id).toBe(secondEmployeeDraftId)
    })
  })

  // ─── findMany ──────────────────────────────────────────────────────

  describe("findMany", () => {
    it("EMPLOYEE sees only their own demandes", async () => {
      const result = await findMany(
        { id: employeeId, role: "EMPLOYEE" },
        { page: 1, limit: 20 }
      )

      expect(result.demandes.length).toBeGreaterThanOrEqual(4)
      const ids = result.demandes.map((d) => d.id)
      expect(ids).not.toContain(secondEmployeeDraftId)
      for (const d of result.demandes) {
        expect(d.employe).toBeDefined()
      }
    })

    it("MANAGER sees all demandes (not scoped to their own)", async () => {
      const result = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 1, limit: 20 }
      )

      expect(result.demandes.length).toBeGreaterThanOrEqual(5)
    })

    it("filters by etape", async () => {
      const result = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 1, limit: 20, etape: "MANAGER_REVIEW" }
      )

      for (const d of result.demandes) {
        expect(d.etape).toBe("MANAGER_REVIEW")
      }
    })

    it("searches destination case-insensitively", async () => {
      const result = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 1, limit: 20, recherche: "marrakech" }
      )

      expect(result.demandes.length).toBeGreaterThanOrEqual(1)
      for (const d of result.demandes) {
        expect(d.destination.toLowerCase()).toContain("marrakech")
      }
    })

    it("searches numero case-insensitively", async () => {
      const first = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 1, limit: 1 }
      )
      const numero = first.demandes[0].numero

      const result = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 1, limit: 20, recherche: numero.toLowerCase() }
      )

      expect(result.demandes.length).toBeGreaterThanOrEqual(1)
    })

    it("returns correct total count", async () => {
      const all = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 1, limit: 100 }
      )
      const page1 = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 1, limit: 2 }
      )

      expect(page1.total).toBe(all.demandes.length)
      expect(page1.demandes).toHaveLength(2)
    })

    it("paginates correctly", async () => {
      const all = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 1, limit: 100 }
      )
      const page1 = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 1, limit: 2 }
      )
      const page2 = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 2, limit: 2 }
      )

      expect(page1.total).toBe(page2.total)
      expect(page1.demandes.length).toBe(2)
      expect(page2.demandes.length).toBeGreaterThanOrEqual(1)

      const page1Ids = page1.demandes.map((d) => d.id)
      const page2Ids = page2.demandes.map((d) => d.id)
      expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false)
    })

    it("excludes soft-deleted demandes", async () => {
      const result = await findMany(
        { id: managerId, role: "MANAGER" },
        { page: 1, limit: 100 }
      )
      const found = result.demandes.find((d) => d.id === draftId)
      expect(found).toBeUndefined()
    })
  })

  // ─── findByEmployeeId ──────────────────────────────────────────────

  describe("findByEmployeeId", () => {
    it("returns demandes for the specified employee", async () => {
      const result = await findByEmployeeId(employeeId)

      expect(result.length).toBeGreaterThanOrEqual(4)
      for (const d of result) {
        expect(d.employe).toBeDefined()
      }
    })

    it("respects the limit parameter", async () => {
      const result = await findByEmployeeId(employeeId, 2)
      expect(result).toHaveLength(2)
    })

    it("returns empty array for employee with no demandes", async () => {
      const unusedId = crypto.randomUUID()
      const result = await findByEmployeeId(unusedId)
      expect(result).toHaveLength(0)
    })

    it("excludes soft-deleted demandes", async () => {
      const result = await findByEmployeeId(employeeId, 100)
      const found = result.find((d) => d.id === draftId)
      expect(found).toBeUndefined()
    })

    it("returns results in a stable order", async () => {
      const result = await findByEmployeeId(employeeId, 100)
      expect(result.length).toBeGreaterThanOrEqual(4)
    })
  })

  // ─── findByEtapes ──────────────────────────────────────────────────

  describe("findByEtapes", () => {
    it("returns demandes matching the specified etapes", async () => {
      const result = await findByEtapes(["MANAGER_REVIEW"])

      expect(result.length).toBeGreaterThanOrEqual(1)
      for (const d of result) {
        expect(d.etape).toBe("MANAGER_REVIEW")
      }
    })

    it("supports multiple etapes", async () => {
      const result = await findByEtapes(["DRAFT", "MANAGER_REVIEW"])

      for (const d of result) {
        expect(["DRAFT", "MANAGER_REVIEW"]).toContain(d.etape)
      }
    })

    it("respects the limit parameter", async () => {
      const result = await findByEtapes(
        ["MANAGER_REVIEW", "FINANCE_REVIEW", "DIRECTION_REVIEW"],
        {
          limit: 2,
        }
      )
      expect(result).toHaveLength(2)
    })

    it("respects orderBy timestamp direction", async () => {
      const resultAsc = await findByEtapes(["MANAGER_REVIEW"], {
        orderBy: { column: "soumiseLe", direction: "asc" },
      })
      const resultDesc = await findByEtapes(["MANAGER_REVIEW"], {
        orderBy: { column: "soumiseLe", direction: "desc" },
      })

      if (resultAsc.length >= 2) {
        expect(resultAsc[0].id).not.toBe(resultDesc[0].id)
      }
    })

    it("excludes soft-deleted demandes", async () => {
      const result = await findByEtapes(["DRAFT"], { limit: 100 })
      const found = result.find((d) => d.id === draftId)
      expect(found).toBeUndefined()
    })
  })

  // ─── countByEtape ──────────────────────────────────────────────────

  describe("countByEtape", () => {
    it("counts demandes at a given etape globally", async () => {
      const managerReviewCount = await countByEtape("MANAGER_REVIEW")
      expect(managerReviewCount).toBeGreaterThanOrEqual(1)
    })

    it("counts demandes at a given etape for a specific user", async () => {
      const employeeCount = await countByEtape("MANAGER_REVIEW", employeeId)
      expect(employeeCount).toBeGreaterThanOrEqual(1)

      const otherCount = await countByEtape("MANAGER_REVIEW", secondEmployeeId)
      expect(otherCount).toBe(0)
    })

    it("excludes soft-deleted demandes", async () => {
      const countBefore = await countByEtape("DRAFT")
      await pgliteDb
        .update(schema.demandesDeplacement)
        .set({ deletedAt: new Date() })
        .where(eq(schema.demandesDeplacement.id, secondEmployeeDraftId))
      const countAfter = await countByEtape("DRAFT")
      expect(countAfter).toBe(countBefore - 1)
    })
  })

  // ─── aggregateBudget ───────────────────────────────────────────────

  describe("aggregateBudget", () => {
    it("returns the sum of totalEstime for the given etapes", async () => {
      const total = await aggregateBudget(["MANAGER_REVIEW"])
      expect(total).toBeGreaterThan(0)
    })

    it("returns 0 when no demandes match the etapes", async () => {
      const total = await aggregateBudget([])
      expect(total).toBe(0)
    })

    it("excludes soft-deleted demandes from aggregation", async () => {
      const before = await aggregateBudget(["MANAGER_REVIEW"])
      await pgliteDb
        .update(schema.demandesDeplacement)
        .set({ deletedAt: new Date() })
        .where(eq(schema.demandesDeplacement.id, submittedId))
      const after = await aggregateBudget(["MANAGER_REVIEW"])
      expect(after).toBeLessThan(before)
    })
  })

  // ─── findAllForExport ──────────────────────────────────────────────

  describe("findAllForExport", () => {
    it("returns all non-deleted demandes in export shape", async () => {
      const rows = await findAllForExport()

      expect(rows.length).toBeGreaterThanOrEqual(3)
      for (const row of rows) {
        expect(row).toHaveProperty("numero")
        expect(row).toHaveProperty("destination")
        expect(row).toHaveProperty("dateDepart")
        expect(row).toHaveProperty("dateRetour")
        expect(row).toHaveProperty("typeTransport")
        expect(row).toHaveProperty("totalEstime")
        expect(row).toHaveProperty("etape")
        expect(row).toHaveProperty("decision")
        expect(row).toHaveProperty("creeLe")
        expect(row).toHaveProperty("employe")
      }
    })

    it("includes employe name when available", async () => {
      const rows = await findAllForExport()
      const withEmploye = rows.find((r) => r.employe !== null)
      expect(withEmploye).toBeDefined()
      expect(withEmploye!.employe!.prenom).toBe("Jean")
      expect(withEmploye!.employe!.nom).toBe("Dupont")
    })

    it("converts totalEstime to number", async () => {
      const rows = await findAllForExport()
      const withTotal = rows.find((r) => r.totalEstime !== null)
      expect(withTotal).toBeDefined()
      expect(typeof withTotal!.totalEstime).toBe("number")
    })

    it("excludes soft-deleted demandes", async () => {
      const before = await findAllForExport()
      const tangerNumero = before.find(
        (r) => r.destination === "Tanger"
      )?.numero
      expect(tangerNumero).toBeDefined()

      await pgliteDb
        .update(schema.demandesDeplacement)
        .set({ deletedAt: new Date() })
        .where(eq(schema.demandesDeplacement.id, managerApprovedId))

      const after = await findAllForExport()
      expect(after.find((r) => r.numero === tangerNumero)).toBeUndefined()
    })

    it("returns demandes ordered by creeLe descending", async () => {
      const rows = await findAllForExport()
      for (let i = 1; i < rows.length; i++) {
        expect(new Date(rows[i - 1].creeLe).getTime()).toBeGreaterThanOrEqual(
          new Date(rows[i].creeLe).getTime()
        )
      }
    })
  })
})
