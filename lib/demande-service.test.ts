import { describe, it, expect, vi } from "vitest"
import { DemandeDeplacementService } from "./demande-service"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
} from "./demande-service"
import type { NotificationBus } from "./notification-bus"
import type { AuditBus } from "./audit-bus"
import type { PrismaClient, Role, StatutDemande } from "@prisma/client"
import type { NotificationEventType } from "./notification-bus"

// ─── Mocks ──────────────────────────────────────────────────────────────────

function mockNotifications(): NotificationBus & { dispatch: ReturnType<typeof vi.fn> } {
  return {
    dispatch: vi.fn().mockResolvedValue({ total: 0, succeeded: 0, failed: 0, failures: [] }),
  } as unknown as NotificationBus & { dispatch: ReturnType<typeof vi.fn> }
}

function mockAudit(): AuditBus & { log: ReturnType<typeof vi.fn> } {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditBus & { log: ReturnType<typeof vi.fn> }
}

interface MockedDb {
  utilisateur: { findUnique: ReturnType<typeof vi.fn> }
  demandeDeplacement: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
    aggregate: ReturnType<typeof vi.fn>
  }
}

function mockDb(): MockedDb {
  return {
    utilisateur: { findUnique: vi.fn() },
    demandeDeplacement: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(5),
      aggregate: vi.fn(),
    },
  }
}

const makeUser = (overrides?: Partial<{ id: string; role: Role; nom: string; prenom: string; poste: string; departementId: string; departement: { nom: string } }>) => ({
  id: "u-1",
  nom: "Dupont",
  prenom: "Jean",
  poste: "Dev",
  role: "EMPLOYEE" as Role,
  departementId: "d-1",
  departement: { nom: "IT" },
  ...overrides,
})

const makeDemande = (overrides?: Partial<{ id: string; statut: StatutDemande; employeId: string; numero: string; deletedAt: Date | null; assigneAId: string | null; employe: { id: string; prenom: string; nom: string } }>) => ({
  id: "dd-1",
  statut: "SOUMISE" as StatutDemande,
  employeId: "u-1",
  numero: "DD-2025-0001",
  deletedAt: null,
  assigneAId: null,
  employe: { id: "u-1", prenom: "Jean", nom: "Dupont" },
  ...overrides,
})

const createData = {
  motif: ["mission_client"],
  dateDepart: "2025-06-01",
  dateRetour: "2025-06-03",
  destination: "Casablanca",
  typeTransport: "AVION" as const,
}

const actor = (overrides?: Partial<{ id: string; role: Role }>) => ({ id: "u-1", role: "EMPLOYEE" as Role, ...overrides })

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("DemandeDeplacementService", () => {
  // ── aggregateBudget ──────────────────────────────────────────────────

  it("aggregateBudget sums totalEstime for given statuses", async () => {
    const db = mockDb()
    db.demandeDeplacement.aggregate.mockResolvedValue({
      _sum: { totalEstime: 45000 },
    })

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    const result = await svc.aggregateBudget(["APPROUVEE", "APPROUVEE_FINANCE"])

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

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    const result = await svc.aggregateBudget(["BROUILLON"])

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

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    const result = await svc.findById("dd-1")

    expect(result.id).toBe("dd-1")
    expect(result.employe.prenom).toBe("Jean")
    expect(db.demandeDeplacement.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dd-1" },
        include: expect.objectContaining({
          employe: expect.any(Object),
          assigneA: expect.any(Object),
          vehicule: expect.any(Object),
          documents: expect.any(Object),
        }),
      })
    )
  })

  it("findById throws DemandeNotFoundError when demande is null", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(null)

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(svc.findById("dd-missing")).rejects.toThrow(DemandeNotFoundError)
  })

  it("findById throws DemandeNotFoundError when demande is soft-deleted", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue({
      id: "dd-1",
      deletedAt: new Date(),
    })

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(svc.findById("dd-1")).rejects.toThrow(DemandeNotFoundError)
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

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    const result = await svc.findMany("MANAGER", "u-1", { page: 1, limit: 10 })

    expect(result.demandes).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it("findMany restricts results for EMPLOYEE role", async () => {
    const db = mockDb()
    db.demandeDeplacement.findMany.mockResolvedValue([])
    db.demandeDeplacement.count.mockResolvedValue(0)

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await svc.findMany("EMPLOYEE", "u-42", { page: 1, limit: 10 })

    const findManyCall = db.demandeDeplacement.findMany.mock.calls[0]?.[0] as any
    expect(findManyCall.where.employeId).toBe("u-42")
  })

  it("findMany applies statut and recherche filters when provided", async () => {
    const db = mockDb()
    db.demandeDeplacement.findMany.mockResolvedValue([])
    db.demandeDeplacement.count.mockResolvedValue(0)

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await svc.findMany("MANAGER", "u-1", { page: 1, limit: 10, statut: "SOUMISE", recherche: "Casablanca" })

    const findManyCall = db.demandeDeplacement.findMany.mock.calls[0]?.[0] as any
    expect(findManyCall.where.statut).toBe("SOUMISE")
    expect(findManyCall.where.OR).toBeDefined()
  })

  // ── Create (draft) ────────────────────────────────────────────────────

  it("creates a draft demande with BROUILLON status", async () => {
    const db = mockDb()
    const notifications = mockNotifications()
    const audit = mockAudit()

    db.utilisateur.findUnique.mockResolvedValue(makeUser())
    db.demandeDeplacement.create.mockResolvedValue(makeDemande({ statut: "BROUILLON" }))

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, notifications, audit)
    const result = await svc.executeAction({ action: "create", data: createData, actor: actor() })

    expect(result.demande.statut).toBe("BROUILLON")
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATION" }))
    expect(notifications.dispatch).not.toHaveBeenCalled()
  })

  it("creates and submits a demande in one call", async () => {
    const db = mockDb()
    const notifications = mockNotifications()
    const audit = mockAudit()

    db.utilisateur.findUnique.mockResolvedValue(makeUser())
    db.demandeDeplacement.create.mockResolvedValue(makeDemande({ statut: "SOUMISE" }))

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, notifications, audit)
    const result = await svc.executeAction({ action: "submit", data: createData, actor: actor() })

    expect(result.demande.statut).toBe("SOUMISE")
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "SOUMISSION" }))
    expect(notifications.dispatch).toHaveBeenCalledWith("DEMANDE_SOUMISE", expect.any(Object))
  })

  it("computes totalEstime from cost fields", async () => {
    const db = mockDb()
    const notifications = mockNotifications()
    const audit = mockAudit()

    db.utilisateur.findUnique.mockResolvedValue(makeUser())
    db.demandeDeplacement.create.mockImplementation((args: any) =>
      Promise.resolve(makeDemande({ statut: "BROUILLON", ...args.data }))
    )

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, notifications, audit)
    const result = await svc.executeAction({
      action: "create",
      data: {
        ...createData,
        fraisTransport: "100",
        fraisHebergement: "200",
        fraisRepas: "50",
        fraisDivers: "25",
      },
      actor: actor(),
    })

    const total = (result.demande as any).totalEstime
    expect(total).toBe(375)
  })

  it("throws UnauthorizedActionError when user not found on create", async () => {
    const db = mockDb()
    db.utilisateur.findUnique.mockResolvedValue(null)

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      svc.executeAction({ action: "create", data: createData, actor: actor() })
    ).rejects.toThrow(UnauthorizedActionError)
  })

  // ── Approve ───────────────────────────────────────────────────────────

  it("allows MANAGER to approve a SOUMISE demande", async () => {
    const db = mockDb()
    const notifications = mockNotifications()
    const audit = mockAudit()

    db.demandeDeplacement.findUnique.mockResolvedValue(makeDemande())
    db.demandeDeplacement.update.mockResolvedValue(makeDemande({ statut: "APPROUVEE_MANAGER" }))

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, notifications, audit)
    const result = await svc.executeAction({
      action: "approuver",
      demandeId: "dd-1",
      actor: actor({ id: "mgr-1", role: "MANAGER" }),
    })

    expect(result.demande.statut).toBe("APPROUVEE_MANAGER")
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "APPROBATION_MANAGER" }))
    expect(notifications.dispatch).toHaveBeenCalledWith(
      "DEMANDE_APPROBATION_MANAGER",
      expect.any(Object)
    )
  })

  it("allows FINANCE_ADMIN to approve an APPROUVEE_MANAGER demande", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(makeDemande({ statut: "APPROUVEE_MANAGER" }))
    db.demandeDeplacement.update.mockResolvedValue(makeDemande({ statut: "APPROUVEE_FINANCE" }))

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    const result = await svc.executeAction({
      action: "approuver",
      demandeId: "dd-1",
      actor: actor({ id: "fin-1", role: "FINANCE_ADMIN" }),
    })

    expect(result.demande.statut).toBe("APPROUVEE_FINANCE")
  })

  it("allows GENERAL_DIRECTION to approve to FINAL", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(makeDemande({ statut: "APPROUVEE_FINANCE" }))
    db.demandeDeplacement.update.mockResolvedValue(makeDemande({ statut: "APPROUVEE" }))

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    const result = await svc.executeAction({
      action: "approuver",
      demandeId: "dd-1",
      actor: actor({ id: "dir-1", role: "GENERAL_DIRECTION" }),
    })

    expect(result.demande.statut).toBe("APPROUVEE")
  })

  it("throws UnauthorizedActionError when EMPLOYEE tries to approve", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(makeDemande())

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      svc.executeAction({
        action: "approuver",
        demandeId: "dd-1",
        actor: actor({ role: "EMPLOYEE" }),
      })
    ).rejects.toThrow(UnauthorizedActionError)
  })

  it("throws DemandeNotFoundError for missing demande", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(null)

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      svc.executeAction({
        action: "approuver",
        demandeId: "dd-missing",
        actor: actor({ id: "mgr-1", role: "MANAGER" }),
      })
    ).rejects.toThrow(DemandeNotFoundError)
  })

  // ── Reject ────────────────────────────────────────────────────────────

  it("allows MANAGER to reject a SOUMISE demande with comment", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(makeDemande())
    db.demandeDeplacement.update.mockResolvedValue(makeDemande({ statut: "REJETEE_MANAGER" }))

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    const result = await svc.executeAction({
      action: "rejeter",
      demandeId: "dd-1",
      actor: actor({ id: "mgr-1", role: "MANAGER" }),
      comment: "Budget insuffisant",
    })

    expect(result.demande.statut).toBe("REJETEE_MANAGER")
  })

  it("throws UnauthorizedActionError on terminal demande", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(makeDemande({ statut: "APPROUVEE" }))

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      svc.executeAction({
        action: "approuver",
        demandeId: "dd-1",
        actor: actor({ id: "dir-1", role: "GENERAL_DIRECTION" }),
      })
    ).rejects.toThrow(UnauthorizedActionError)
  })

  // ── Withdraw ──────────────────────────────────────────────────────────

  it("allows EMPLOYEE to withdraw own BROUILLON demande", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(
      makeDemande({ statut: "BROUILLON", employeId: "u-1", assigneAId: "mgr-1" })
    )
    db.demandeDeplacement.update.mockResolvedValue(makeDemande({ statut: "RETIREE" }))

    const notifications = mockNotifications()
    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, notifications, mockAudit())
    const result = await svc.executeAction({
      action: "retirer",
      demandeId: "dd-1",
      actor: actor({ id: "u-1", role: "EMPLOYEE" }),
    })

    expect(result.demande.statut).toBe("RETIREE")
    expect(notifications.dispatch).toHaveBeenCalledWith(
      "DEMANDE_RETIREE",
      expect.objectContaining({ assigneAId: "mgr-1" })
    )
  })

  it("throws UnauthorizedActionError when non-owner tries to withdraw", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(
      makeDemande({ statut: "BROUILLON", employeId: "u-2" })
    )

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      svc.executeAction({
        action: "retirer",
        demandeId: "dd-1",
        actor: actor({ id: "u-1", role: "EMPLOYEE" }),
      })
    ).rejects.toThrow(UnauthorizedActionError)
  })

  it("throws UnauthorizedActionError when withdrawing after submission", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(
      makeDemande({ statut: "SOUMISE", employeId: "u-1" })
    )

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      svc.executeAction({
        action: "retirer",
        demandeId: "dd-1",
        actor: actor({ id: "u-1", role: "EMPLOYEE" }),
      })
    ).rejects.toThrow(UnauthorizedActionError)
  })

  // ── Motif processing ──────────────────────────────────────────────────

  it("replaces 'autre' with 'Autre: ...' when motifAutre provided", async () => {
    const db = mockDb()
    db.utilisateur.findUnique.mockResolvedValue(makeUser())
    db.demandeDeplacement.create.mockImplementation((args: any) =>
      Promise.resolve(makeDemande({ statut: "BROUILLON" }))
    )

    const svc = new DemandeDeplacementService(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await svc.executeAction({
      action: "create",
      data: { ...createData, motif: ["mission_client", "autre"], motifAutre: "Conference" },
      actor: actor(),
    })

    const createCall = db.demandeDeplacement.create.mock.calls[0]?.[0] as any
    const motif = JSON.parse(createCall.data.motif)
    expect(motif).toContain("Autre: Conference")
  })
})
