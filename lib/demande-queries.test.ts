import { describe, it, expect, vi } from "vitest"
import { DemandeQueries } from "./demande-queries"
import { DemandeNotFoundError } from "./errors"
import type { PrismaClient } from "@prisma/client"

interface MockedDb {
  demandeDeplacement: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
    aggregate: ReturnType<typeof vi.fn>
  }
}

function mockDb(): MockedDb {
  return {
    demandeDeplacement: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(5),
      aggregate: vi.fn(),
    },
  }
}

describe("DemandeQueries", () => {
  // ── aggregateBudget ──────────────────────────────────────────────────

  it("aggregateBudget sums totalEstime for given statuses", async () => {
    const db = mockDb()
    db.demandeDeplacement.aggregate.mockResolvedValue({
      _sum: { totalEstime: 45000 },
    })

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.aggregateBudget(["APPROUVEE", "APPROUVEE_FINANCE"])

    expect(db.demandeDeplacement.aggregate).toHaveBeenCalledWith({
      _sum: { totalEstime: true },
      where: {
        statut: { in: ["APPROUVEE", "APPROUVEE_FINANCE"] },
        deletedAt: null,
      },
    })
    expect(result).toBe(45000)
  })

  it("aggregateBudget returns 0 when no matching demandes", async () => {
    const db = mockDb()
    db.demandeDeplacement.aggregate.mockResolvedValue({
      _sum: { totalEstime: null },
    })

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.aggregateBudget(["BROUILLON"])

    expect(result).toBe(0)
  })

  // ── findById ───────────────────────────────────────────────────────────

  it("findById returns demande with all relations included", async () => {
    const db = mockDb()
    const mockDemande = {
      id: "dd-1",
      statut: "SOUMISE",
      employeId: "u-1",
      employe: { id: "u-1", prenom: "Jean", nom: "Dupont", email: "jean@test.com", poste: "Dev" },
      assigneA: null,
      vehicule: null,
      documents: [],
      deletedAt: null,
      creeLe: new Date(),
    }
    db.demandeDeplacement.findUnique.mockResolvedValue(mockDemande)

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.findById("dd-1")

    expect(result.id).toBe("dd-1")
    expect(result.employe.prenom).toBe("Jean")
    expect(db.demandeDeplacement.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dd-1", deletedAt: null },
        include: expect.objectContaining({
          employe: expect.any(Object),
          assigneA: expect.any(Object),
          vehicule: expect.any(Object),
        }),
      })
    )
  })

  it("findById throws DemandeNotFoundError when demande is null", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(null)

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    await expect(queries.findById("dd-missing")).rejects.toThrow(DemandeNotFoundError)
  })

  it("findById throws DemandeNotFoundError when demande is soft-deleted", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue({
      id: "dd-1",
      deletedAt: new Date(),
    })

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    await expect(queries.findById("dd-1")).rejects.toThrow(DemandeNotFoundError)
  })

  it("findById omits documents from the fetched data when no include is provided", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue({
      id: "dd-1",
      statut: "SOUMISE",
      employeId: "u-1",
      employe: { id: "u-1", prenom: "Jean", nom: "Dupont", email: "jean@test.com", poste: "Dev" },
      assigneA: null,
      vehicule: null,
      deletedAt: null,
      creeLe: new Date(),
    })

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    await queries.findById("dd-1")

    const call = db.demandeDeplacement.findUnique.mock.calls[0]?.[0] as any
    expect(call.include.documents).toBeUndefined()
  })

  it("findById returns documents when include.documents is true", async () => {
    const db = mockDb()
    const docs = [
      { id: "doc-1", demandeId: "dd-1", type: "PDF", chemin: "doc-1.pdf", creeLe: new Date("2025-05-01") },
      { id: "doc-2", demandeId: "dd-1", type: "INVOICE", chemin: "doc-2.pdf", creeLe: new Date("2025-05-02") },
    ]
    db.demandeDeplacement.findUnique.mockResolvedValue({
      id: "dd-1",
      statut: "SOUMISE",
      employeId: "u-1",
      employe: { id: "u-1", prenom: "Jean", nom: "Dupont", email: "jean@test.com", poste: "Dev" },
      assigneA: null,
      vehicule: null,
      documents: docs,
      deletedAt: null,
      creeLe: new Date(),
    })

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.findById("dd-1", { include: { documents: true } })

    expect(result.documents).toEqual(docs)
    expect(db.demandeDeplacement.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dd-1", deletedAt: null },
        include: expect.objectContaining({
          employe: expect.any(Object),
          assigneA: expect.any(Object),
          vehicule: expect.any(Object),
          documents: true,
        }),
      })
    )
  })

  it("findById omits documents when include.documents is false", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue({
      id: "dd-1",
      statut: "SOUMISE",
      employeId: "u-1",
      employe: { id: "u-1", prenom: "Jean", nom: "Dupont", email: "jean@test.com", poste: "Dev" },
      assigneA: null,
      vehicule: null,
      deletedAt: null,
      creeLe: new Date(),
    })

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    await queries.findById("dd-1", { include: { documents: false } })

    const call = db.demandeDeplacement.findUnique.mock.calls[0]?.[0] as any
    expect(call.include.documents).toBeUndefined()
  })

  // ── findMany ───────────────────────────────────────────────────────────

  it("findMany returns paginated demandes with total count", async () => {
    const db = mockDb()
    const mockDemandes = [
      { id: "dd-1", statut: "SOUMISE", employeId: "u-1", employe: { prenom: "Jean", nom: "Dupont" } },
      { id: "dd-2", statut: "SOUMISE", employeId: "u-1", employe: { prenom: "Jean", nom: "Dupont" } },
    ]
    db.demandeDeplacement.findMany.mockResolvedValue(mockDemandes)
    db.demandeDeplacement.count.mockResolvedValue(2)

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.findMany("MANAGER", "u-1", { page: 1, limit: 10 })

    expect(result.demandes).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it("findMany restricts results for EMPLOYEE role", async () => {
    const db = mockDb()
    db.demandeDeplacement.findMany.mockResolvedValue([])
    db.demandeDeplacement.count.mockResolvedValue(0)

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    await queries.findMany("EMPLOYEE", "u-42", { page: 1, limit: 10 })

    const call = db.demandeDeplacement.findMany.mock.calls[0]?.[0] as any
    expect(call.where.employeId).toBe("u-42")
  })

  it("findMany applies statut and recherche filters when provided", async () => {
    const db = mockDb()
    db.demandeDeplacement.findMany.mockResolvedValue([])
    db.demandeDeplacement.count.mockResolvedValue(0)

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    await queries.findMany("MANAGER", "u-1", { page: 1, limit: 10, statut: "SOUMISE", recherche: "Casablanca" })

    const call = db.demandeDeplacement.findMany.mock.calls[0]?.[0] as any
    expect(call.where.statut).toBe("SOUMISE")
    expect(call.where.OR).toBeDefined()
  })

  // ── findByEmployeeId ──────────────────────────────────────────────────

  it("findByEmployeeId returns recent demandes for a user", async () => {
    const db = mockDb()
    const mockDemandes = [
      { id: "dd-1", statut: "SOUMISE", employeId: "u-1" },
      { id: "dd-2", statut: "BROUILLON", employeId: "u-1" },
    ]
    db.demandeDeplacement.findMany.mockResolvedValue(mockDemandes)

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.findByEmployeeId("u-1", 5)

    expect(result).toHaveLength(2)
    expect(db.demandeDeplacement.findMany).toHaveBeenCalledWith({
      where: { employeId: "u-1", deletedAt: null },
      orderBy: { creeLe: "desc" },
      take: 5,
    })
  })

  it("findByEmployeeId uses default limit of 5", async () => {
    const db = mockDb()
    db.demandeDeplacement.findMany.mockResolvedValue([])

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    await queries.findByEmployeeId("u-1")

    const call = db.demandeDeplacement.findMany.mock.calls[0]?.[0] as any
    expect(call.take).toBe(5)
  })

  // ── findByStatuts ─────────────────────────────────────────────────────

  it("findByStatuts returns demandes matching status list", async () => {
    const db = mockDb()
    const mockDemandes = [
      { id: "dd-1", statut: "SOUMISE", employeId: "u-1" },
    ]
    db.demandeDeplacement.findMany.mockResolvedValue(mockDemandes)

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.findByStatuts(["SOUMISE", "APPROUVEE"])

    expect(result).toHaveLength(1)
    expect(db.demandeDeplacement.findMany).toHaveBeenCalledWith({
      where: { statut: { in: ["SOUMISE", "APPROUVEE"] }, deletedAt: null },
      orderBy: { creeLe: "desc" },
      take: 10,
    })
  })

  it("findByStatuts includes employee when requested", async () => {
    const db = mockDb()
    db.demandeDeplacement.findMany.mockResolvedValue([])

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    await queries.findByStatuts(["SOUMISE"], { includeEmployee: true })

    const call = db.demandeDeplacement.findMany.mock.calls[0]?.[0] as any
    expect(call.include).toEqual({ employe: { select: { prenom: true, nom: true } } })
  })

  // ── findAllForExport ─────────────────────────────────────────────────

  it("findAllForExport returns all non-deleted demandes with CSV fields", async () => {
    const db = mockDb()
    const mockDemandes = [
      {
        numero: "DD-2025-0001",
        destination: "Casablanca",
        dateDepart: new Date("2025-06-01"),
        dateRetour: new Date("2025-06-05"),
        typeTransport: "AVION",
        totalEstime: 380,
        statut: "APPROUVEE",
        creeLe: new Date("2025-05-24"),
        employe: { prenom: "Jean", nom: "Dupont" },
      },
    ]
    db.demandeDeplacement.findMany.mockResolvedValue(mockDemandes)

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.findAllForExport()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      numero: "DD-2025-0001",
      destination: "Casablanca",
      dateDepart: new Date("2025-06-01"),
      dateRetour: new Date("2025-06-05"),
      typeTransport: "AVION",
      totalEstime: 380,
      statut: "APPROUVEE",
      creeLe: new Date("2025-05-24"),
      employe: { prenom: "Jean", nom: "Dupont" },
    })

    const call = db.demandeDeplacement.findMany.mock.calls[0]?.[0] as any
    expect(call.where).toEqual({ deletedAt: null })
    expect(call.orderBy).toEqual({ creeLe: "desc" })
    expect(call.include).toEqual({ employe: { select: { prenom: true, nom: true } } })
  })

  it("findAllForExport converts totalEstime to number and nulls when absent", async () => {
    const db = mockDb()
    db.demandeDeplacement.findMany.mockResolvedValue([
      { numero: "DD-1", totalEstime: 450, typeTransport: "BUS", statut: "SOUMISE", creeLe: new Date(), employe: { prenom: "A", nom: "B" } },
      { numero: "DD-2", totalEstime: null, typeTransport: "TRAIN", statut: "BROUILLON", creeLe: new Date(), employe: null },
    ])

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.findAllForExport()

    expect(result[0].totalEstime).toBe(450)
    expect(result[1].totalEstime).toBeNull()
    expect(result[1].employe).toBeNull()
  })

  // ── countByStatut ────────────────────────────────────────────────────

  it("countByStatut counts demandes by status", async () => {
    const db = mockDb()
    db.demandeDeplacement.count.mockResolvedValue(3)

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.countByStatut("SOUMISE")

    expect(result).toBe(3)
    expect(db.demandeDeplacement.count).toHaveBeenCalledWith({
      where: { statut: "SOUMISE", deletedAt: null },
    })
  })

  it("countByStatut filters by userId when provided", async () => {
    const db = mockDb()
    db.demandeDeplacement.count.mockResolvedValue(1)

    const queries = new DemandeQueries(db as unknown as PrismaClient)
    const result = await queries.countByStatut("BROUILLON", "u-1")

    expect(result).toBe(1)
    expect(db.demandeDeplacement.count).toHaveBeenCalledWith({
      where: { statut: "BROUILLON", deletedAt: null, employeId: "u-1" },
    })
  })
})
