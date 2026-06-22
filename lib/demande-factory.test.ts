import { describe, it, expect, vi } from "vitest"
import { DemandeFactory } from "./demande-factory"
import { UnauthorizedActionError } from "./errors"
import type { NotificationBus } from "./notification-bus"
import type { AuditBus } from "./audit-bus"
import type { PrismaClient, Role } from "@prisma/client"

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
    create: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
}

function mockDb(): MockedDb {
  return {
    utilisateur: { findUnique: vi.fn() },
    demandeDeplacement: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(5),
    },
  }
}

const makeUser = (overrides?: Record<string, unknown>) => ({
  id: "u-1",
  nom: "Dupont",
  prenom: "Jean",
  poste: "Dev",
  role: "EMPLOYEE" as Role,
  departementId: "d-1",
  departement: { nom: "IT" },
  ...overrides,
})

const makeDemande = (overrides?: Record<string, unknown>) => ({
  id: "dd-1",
  statut: "BROUILLON",
  employeId: "u-1",
  numero: "DD-2025-0001",
  deletedAt: null,
  assigneAId: null,
  ...overrides,
})

const createData = {
  motif: ["mission_client"],
  dateDepart: "2025-06-01",
  dateRetour: "2025-06-03",
  destination: "Casablanca",
  typeTransport: "AVION" as const,
}

const actor = (overrides?: Partial<{ id: string; role: Role }>) => ({
  id: "u-1",
  role: "EMPLOYEE" as Role,
  ...overrides,
})

describe("DemandeFactory", () => {
  it("createAndSubmit creates a demande with SOUMISE status and dispatches notification", async () => {
    const db = mockDb()
    const notifications = mockNotifications()
    const audit = mockAudit()

    db.utilisateur.findUnique.mockResolvedValue(makeUser())
    db.demandeDeplacement.create.mockResolvedValue(makeDemande({ statut: "SOUMISE" }))

    const factory = new DemandeFactory(db as unknown as PrismaClient, notifications, audit)
    const result = await factory.createAndSubmit(createData, actor())

    expect(result.demande.statut).toBe("SOUMISE")
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "SOUMISSION" }))
    expect(notifications.dispatch).toHaveBeenCalledWith("DEMANDE_SOUMISE", expect.any(Object))
  })

  it("throws UnauthorizedActionError when user not found", async () => {
    const db = mockDb()
    db.utilisateur.findUnique.mockResolvedValue(null)

    const factory = new DemandeFactory(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(factory.createDraft(createData, actor())).rejects.toThrow(UnauthorizedActionError)
  })

  it("computes totalEstime from cost fields", async () => {
    const db = mockDb()
    const notifications = mockNotifications()
    const audit = mockAudit()

    db.utilisateur.findUnique.mockResolvedValue(makeUser())
    db.demandeDeplacement.create.mockImplementation((args: any) =>
      Promise.resolve(makeDemande({ statut: "BROUILLON", ...args.data }))
    )

    const factory = new DemandeFactory(db as unknown as PrismaClient, notifications, audit)
    const result = await factory.createDraft({
      ...createData,
      fraisTransport: "100",
      fraisHebergement: "200",
      fraisRepas: "50",
      fraisDivers: "25",
    }, actor())

    const total = (result.demande as any).totalEstime
    expect(total).toBe(375)
  })

  it("replaces 'autre' with 'Autre: ...' when motifAutre provided", async () => {
    const db = mockDb()
    db.utilisateur.findUnique.mockResolvedValue(makeUser())
    db.demandeDeplacement.create.mockImplementation((args: any) =>
      Promise.resolve(makeDemande({ statut: "BROUILLON" }))
    )

    const factory = new DemandeFactory(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await factory.createDraft({
      ...createData,
      motif: ["mission_client", "autre"],
      motifAutre: "Conference",
    }, actor())

    const createCall = db.demandeDeplacement.create.mock.calls[0]?.[0] as any
    const motif = JSON.parse(createCall.data.motif)
    expect(motif).toContain("Autre: Conference")
  })

  it("createDraft creates a demande with BROUILLON status", async () => {
    const db = mockDb()
    const notifications = mockNotifications()
    const audit = mockAudit()

    db.utilisateur.findUnique.mockResolvedValue(makeUser())
    db.demandeDeplacement.create.mockResolvedValue(makeDemande({ statut: "BROUILLON" }))

    const factory = new DemandeFactory(db as unknown as PrismaClient, notifications, audit)
    const result = await factory.createDraft(createData, actor())

    expect(result.demande.statut).toBe("BROUILLON")
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATION" }))
    expect(notifications.dispatch).not.toHaveBeenCalled()
  })
})
