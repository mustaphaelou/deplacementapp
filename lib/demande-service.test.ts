import { describe, it, expect, vi } from "vitest"
import { DemandeDeplacementService } from "./demande-service"
import type { PrismaClient, Role } from "@prisma/client"
import type { NotificationBus } from "./notification-bus"
import type { AuditBus } from "./audit-bus"

function mockDb(): any {
  return {} as unknown as PrismaClient
}

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

describe("DemandeDeplacementService (facade smoke)", () => {
  it("exposes queries, factory, and workflow as public properties", () => {
    const svc = new DemandeDeplacementService(mockDb(), mockNotifications(), mockAudit())
    expect(svc.queries).toBeDefined()
    expect(svc.factory).toBeDefined()
    expect(svc.workflow).toBeDefined()
  })

  it("executeAction with 'create' delegates to factory.createDraft", async () => {
    const db = mockDb()
    const notif = mockNotifications()
    const audit = mockAudit()

    const svc = new DemandeDeplacementService(db, notif, audit)

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
    const notif = mockNotifications()
    const audit = mockAudit()

    const svc = new DemandeDeplacementService(db, notif, audit)

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
    const notif = mockNotifications()
    const audit = mockAudit()

    const svc = new DemandeDeplacementService(db, notif, audit)

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
    const notif = mockNotifications()
    const audit = mockAudit()

    const svc = new DemandeDeplacementService(db, notif, audit)

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
    const notif = mockNotifications()
    const audit = mockAudit()

    const svc = new DemandeDeplacementService(db, notif, audit)

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

  it("delegates query methods to queries property", async () => {
    const db = mockDb()
    const notif = mockNotifications()
    const audit = mockAudit()

    const svc = new DemandeDeplacementService(db, notif, audit)

    svc.queries.findById = vi.fn().mockResolvedValue({ id: "dd-1" })
    svc.queries.findMany = vi.fn().mockResolvedValue({ demandes: [], total: 0 })
    svc.queries.findByEmployeeId = vi.fn().mockResolvedValue([])
    svc.queries.findByStatuts = vi.fn().mockResolvedValue([])
    svc.queries.countByStatut = vi.fn().mockResolvedValue(3)
    svc.queries.aggregateBudget = vi.fn().mockResolvedValue(1000)

    await expect(svc.findById("dd-1")).resolves.toEqual({ id: "dd-1" })
    await expect(svc.findMany("MANAGER", "u-1", { page: 1, limit: 10 })).resolves.toEqual({ demandes: [], total: 0 })
    await expect(svc.findByEmployeeId("u-1")).resolves.toEqual([])
    await expect(svc.findByStatuts(["SOUMISE"])).resolves.toEqual([])
    await expect(svc.countByStatut("SOUMISE")).resolves.toBe(3)
    await expect(svc.aggregateBudget(["APPROUVEE"])).resolves.toBe(1000)

    expect(svc.queries.findById).toHaveBeenCalledWith("dd-1")
    expect(svc.queries.findMany).toHaveBeenCalledWith("MANAGER", "u-1", { page: 1, limit: 10 })
    expect(svc.queries.findByEmployeeId).toHaveBeenCalledWith("u-1", undefined)
    expect(svc.queries.findByStatuts).toHaveBeenCalledWith(["SOUMISE"], undefined)
    expect(svc.queries.countByStatut).toHaveBeenCalledWith("SOUMISE", undefined)
    expect(svc.queries.aggregateBudget).toHaveBeenCalledWith(["APPROUVEE"])
  })
})
