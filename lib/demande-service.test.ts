import { describe, it, expect, vi } from "vitest"
import { DemandeDeplacementService } from "./demande-service"
import type { Role } from "@prisma/client"
import type { DemandeQueryPort } from "./demande/ports/demande-query-port"
import type { DemandeFactoryPort } from "./demande/ports/demande-factory-port"
import type { DemandeWorkflowPort } from "./demande/ports/demande-workflow-port"

function mockQueryPort(): DemandeQueryPort {
  return {
    findById: vi.fn(),
    findMany: vi.fn(),
    findByEmployeeId: vi.fn(),
    findByStatuts: vi.fn(),
    countByStatut: vi.fn(),
    aggregateBudget: vi.fn(),
    findAllForExport: vi.fn(),
  }
}

function mockFactoryPort(): DemandeFactoryPort {
  return {
    createDraft: vi.fn(),
    createAndSubmit: vi.fn(),
  }
}

function mockWorkflowPort(): DemandeWorkflowPort {
  return {
    executeTransition: vi.fn(),
  }
}

describe("DemandeDeplacementService (facade smoke)", () => {
  it("exposes queries, factory, and workflow as public properties", () => {
    const queries = mockQueryPort()
    const factory = mockFactoryPort()
    const workflow = mockWorkflowPort()
    const svc = new DemandeDeplacementService(queries, factory, workflow)
    expect(svc.queries).toBe(queries)
    expect(svc.factory).toBe(factory)
    expect(svc.workflow).toBe(workflow)
  })

  it("executeAction with 'create' delegates to factory.createDraft", async () => {
    const queries = mockQueryPort()
    const factory = mockFactoryPort()
    const workflow = mockWorkflowPort()
    factory.createDraft = vi.fn().mockResolvedValue({ demande: { id: "dd-1" } })

    const svc = new DemandeDeplacementService(queries, factory, workflow)

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
    expect(factory.createDraft).toHaveBeenCalledOnce()
  })

  it("executeAction with 'submit' delegates to factory.createAndSubmit", async () => {
    const queries = mockQueryPort()
    const factory = mockFactoryPort()
    const workflow = mockWorkflowPort()
    factory.createAndSubmit = vi.fn().mockResolvedValue({ demande: { id: "dd-2" } })

    const svc = new DemandeDeplacementService(queries, factory, workflow)

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
    expect(factory.createAndSubmit).toHaveBeenCalledOnce()
  })

  it("executeAction with 'approuver' delegates to workflow.executeTransition", async () => {
    const queries = mockQueryPort()
    const factory = mockFactoryPort()
    const workflow = mockWorkflowPort()
    workflow.executeTransition = vi.fn().mockResolvedValue({ demande: { id: "dd-1", statut: "APPROUVEE_MANAGER" } })

    const svc = new DemandeDeplacementService(queries, factory, workflow)

    const result = await svc.executeAction({
      action: "approuver",
      demandeId: "dd-1",
      actor: { id: "mgr-1", role: "MANAGER" as Role },
    })

    expect(result).toEqual({ demande: { id: "dd-1", statut: "APPROUVEE_MANAGER" } })
    expect(workflow.executeTransition).toHaveBeenCalledWith({
      demandeId: "dd-1",
      action: "approuver",
      actor: { id: "mgr-1", role: "MANAGER" },
      comment: undefined,
    })
  })

  it("executeAction with 'rejeter' delegates to workflow.executeTransition", async () => {
    const queries = mockQueryPort()
    const factory = mockFactoryPort()
    const workflow = mockWorkflowPort()
    workflow.executeTransition = vi.fn().mockResolvedValue({ demande: { id: "dd-1", statut: "REJETEE_MANAGER" } })

    const svc = new DemandeDeplacementService(queries, factory, workflow)

    const result = await svc.executeAction({
      action: "rejeter",
      demandeId: "dd-1",
      actor: { id: "mgr-1", role: "MANAGER" as Role },
      comment: "Budget insuffisant",
    })

    expect(result).toEqual({ demande: { id: "dd-1", statut: "REJETEE_MANAGER" } })
    expect(workflow.executeTransition).toHaveBeenCalledWith({
      demandeId: "dd-1",
      action: "rejeter",
      actor: { id: "mgr-1", role: "MANAGER" },
      comment: "Budget insuffisant",
    })
  })

  it("executeAction with 'retirer' delegates to workflow.executeTransition", async () => {
    const queries = mockQueryPort()
    const factory = mockFactoryPort()
    const workflow = mockWorkflowPort()
    workflow.executeTransition = vi.fn().mockResolvedValue({ demande: { id: "dd-1", statut: "RETIREE" } })

    const svc = new DemandeDeplacementService(queries, factory, workflow)

    const result = await svc.executeAction({
      action: "retirer",
      demandeId: "dd-1",
      actor: { id: "u-1", role: "EMPLOYEE" as Role },
    })

    expect(result).toEqual({ demande: { id: "dd-1", statut: "RETIREE" } })
    expect(workflow.executeTransition).toHaveBeenCalledWith({
      demandeId: "dd-1",
      action: "retirer",
      actor: { id: "u-1", role: "EMPLOYEE" },
      comment: undefined,
    })
  })

  it("recordDocument creates a Document row via the db seam", async () => {
    const db = { document: { create: vi.fn().mockResolvedValue({ id: "doc-1" }) } }
    const queries = mockQueryPort()
    const factory = mockFactoryPort()
    const workflow = mockWorkflowPort()
    const svc = new DemandeDeplacementService(queries, factory, workflow, db as any)

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