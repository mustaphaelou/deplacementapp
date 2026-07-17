import { describe, it, expect, vi } from "vitest"
import { DemandeDeplacementService } from "./demande-service"
import type { PrismaClient, Role } from "@prisma/client"
import type { DemandeEventBus } from "./demande-event-bus"

function mockDb(): any {
  return {} as unknown as PrismaClient
}

function mockEventBus(): DemandeEventBus & { dispatch: ReturnType<typeof vi.fn> } {
  return {
    dispatch: vi.fn().mockResolvedValue(undefined),
  } as unknown as DemandeEventBus & { dispatch: ReturnType<typeof vi.fn> }
}

describe("DemandeDeplacementService (facade smoke)", () => {
  it("exposes queries, factory, and workflow as public properties", () => {
    const svc = new DemandeDeplacementService(mockDb(), mockEventBus())
    expect(svc.queries).toBeDefined()
    expect(svc.factory).toBeDefined()
    expect(svc.workflow).toBeDefined()
  })

  it("executeAction with 'create' delegates to factory.createDraft", async () => {
    const db = mockDb()
    const events = mockEventBus()

    const svc = new DemandeDeplacementService(db, events)

    svc.factory.createDraft = vi.fn().mockResolvedValue({ demande: { id: "dd-1" } })

    const result = await svc.executeAction({
      action: "create",
      data: {
        motif: ["mission_client"],
        dateDepart: "2025-06-01",
        dateRetour: "2025-06-03",
        destination: "Casablanca",
        typeTransport: "AVION" as const,
      },
      actor: { id: "u-1", role: "EMPLOYEE" as Role },
    })

    expect(result).toEqual({ demande: { id: "dd-1" } })
    expect(svc.factory.createDraft).toHaveBeenCalledOnce()
  })

  it("executeAction with 'submit' delegates to factory.createAndSubmit", async () => {
    const db = mockDb()
    const events = mockEventBus()

    const svc = new DemandeDeplacementService(db, events)

    svc.factory.createAndSubmit = vi.fn().mockResolvedValue({ demande: { id: "dd-2" } })

    const result = await svc.executeAction({
      action: "submit",
      data: {
        motif: ["mission_client"],
        dateDepart: "2025-06-01",
        dateRetour: "2025-06-03",
        destination: "Casablanca",
        typeTransport: "AVION" as const,
      },
      actor: { id: "u-1", role: "EMPLOYEE" as Role },
    })

    expect(result).toEqual({ demande: { id: "dd-2" } })
    expect(svc.factory.createAndSubmit).toHaveBeenCalledOnce()
  })

  it("executeAction with 'approuver' delegates to workflow.executeTransition", async () => {
    const db = mockDb()
    const events = mockEventBus()

    const svc = new DemandeDeplacementService(db, events)

    svc.workflow.executeTransition = vi.fn().mockResolvedValue({ demande: { id: "dd-1", statut: "APPROUVEE_MANAGER" } })

    const result = await svc.executeAction({
      action: "approuver",
      demandeId: "dd-1",
      actor: { id: "mgr-1", role: "MANAGER" as Role },
    })

    expect(result).toEqual({ demande: { id: "dd-1", statut: "APPROUVEE_MANAGER" } })
    expect(svc.workflow.executeTransition).toHaveBeenCalledWith({
      demandeId: "dd-1",
      action: "approuver",
      actor: { id: "mgr-1", role: "MANAGER" },
      comment: undefined,
    })
  })

  it("executeAction with 'rejeter' delegates to workflow.executeTransition", async () => {
    const db = mockDb()
    const events = mockEventBus()

    const svc = new DemandeDeplacementService(db, events)

    svc.workflow.executeTransition = vi.fn().mockResolvedValue({ demande: { id: "dd-1", statut: "REJETEE_MANAGER" } })

    const result = await svc.executeAction({
      action: "rejeter",
      demandeId: "dd-1",
      actor: { id: "mgr-1", role: "MANAGER" as Role },
      comment: "Budget insuffisant",
    })

    expect(result).toEqual({ demande: { id: "dd-1", statut: "REJETEE_MANAGER" } })
    expect(svc.workflow.executeTransition).toHaveBeenCalledWith({
      demandeId: "dd-1",
      action: "rejeter",
      actor: { id: "mgr-1", role: "MANAGER" },
      comment: "Budget insuffisant",
    })
  })

  it("executeAction with 'retirer' delegates to workflow.executeTransition", async () => {
    const db = mockDb()
    const events = mockEventBus()

    const svc = new DemandeDeplacementService(db, events)

    svc.workflow.executeTransition = vi.fn().mockResolvedValue({ demande: { id: "dd-1", statut: "RETIREE" } })

    const result = await svc.executeAction({
      action: "retirer",
      demandeId: "dd-1",
      actor: { id: "u-1", role: "EMPLOYEE" as Role },
    })

    expect(result).toEqual({ demande: { id: "dd-1", statut: "RETIREE" } })
    expect(svc.workflow.executeTransition).toHaveBeenCalledWith({
      demandeId: "dd-1",
      action: "retirer",
      actor: { id: "u-1", role: "EMPLOYEE" },
      comment: undefined,
    })
  })

  it("recordDocument creates a Document row via the db seam", async () => {
    const db = { document: { create: vi.fn().mockResolvedValue({ id: "doc-1" }) } } as unknown as PrismaClient
    const events = mockEventBus()
    const svc = new DemandeDeplacementService(db, events)

    await svc.recordDocument("dd-1", { type: "PDF", chemin: "demande-DD-2025-0001.pdf" })

    expect(db.document.create).toHaveBeenCalledWith({
      data: {
        demandeId: "dd-1",
        type: "PDF",
        chemin: "demande-DD-2025-0001.pdf",
      },
    })
  })
})
