import { describe, it, expect, vi } from "vitest"
import { DemandeWorkflow } from "./demande-workflow"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
} from "./errors"
import type { NotificationBus } from "./notification-bus"
import type { AuditBus } from "./audit-bus"
import type { PrismaClient, Role, StatutDemande } from "@prisma/client"

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
  demandeDeplacement: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

function mockDb(): MockedDb {
  return {
    demandeDeplacement: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }
}

const makeDemande = (overrides?: Partial<{
  id: string
  statut: StatutDemande
  employeId: string
  numero: string
  deletedAt: Date | null
  assigneAId: string | null
  employe: { id: string; prenom: string; nom: string }
}>) => ({
  id: "dd-1",
  statut: "SOUMISE" as StatutDemande,
  employeId: "u-1",
  numero: "DD-2025-0001",
  deletedAt: null,
  assigneAId: null,
  employe: { id: "u-1", prenom: "Jean", nom: "Dupont" },
  ...overrides,
})

const actor = (overrides?: Partial<{ id: string; role: Role }>) => ({ id: "u-1", role: "EMPLOYEE" as Role, ...overrides })

describe("DemandeWorkflow", () => {
  // ── Approve ───────────────────────────────────────────────────────────

  it("allows MANAGER to approve a SOUMISE demande", async () => {
    const db = mockDb()
    const notifications = mockNotifications()
    const audit = mockAudit()

    db.demandeDeplacement.findUnique.mockResolvedValue(makeDemande())
    db.demandeDeplacement.update.mockResolvedValue(makeDemande({ statut: "APPROUVEE_MANAGER" }))

    const workflow = new DemandeWorkflow(db as unknown as PrismaClient, notifications, audit)
    const result = await workflow.executeTransition({
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

    const workflow = new DemandeWorkflow(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    const result = await workflow.executeTransition({
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

    const workflow = new DemandeWorkflow(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    const result = await workflow.executeTransition({
      action: "approuver",
      demandeId: "dd-1",
      actor: actor({ id: "dir-1", role: "GENERAL_DIRECTION" }),
    })

    expect(result.demande.statut).toBe("APPROUVEE")
  })

  it("throws UnauthorizedActionError when EMPLOYEE tries to approve", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(makeDemande())

    const workflow = new DemandeWorkflow(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      workflow.executeTransition({
        action: "approuver",
        demandeId: "dd-1",
        actor: actor({ role: "EMPLOYEE" }),
      })
    ).rejects.toThrow(UnauthorizedActionError)
  })

  it("throws DemandeNotFoundError for missing demande", async () => {
    const db = mockDb()
    db.demandeDeplacement.findUnique.mockResolvedValue(null)

    const workflow = new DemandeWorkflow(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      workflow.executeTransition({
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

    const workflow = new DemandeWorkflow(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    const result = await workflow.executeTransition({
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

    const workflow = new DemandeWorkflow(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      workflow.executeTransition({
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
    const workflow = new DemandeWorkflow(db as unknown as PrismaClient, notifications, mockAudit())
    const result = await workflow.executeTransition({
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

    const workflow = new DemandeWorkflow(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      workflow.executeTransition({
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

    const workflow = new DemandeWorkflow(db as unknown as PrismaClient, mockNotifications(), mockAudit())
    await expect(
      workflow.executeTransition({
        action: "retirer",
        demandeId: "dd-1",
        actor: actor({ id: "u-1", role: "EMPLOYEE" }),
      })
    ).rejects.toThrow(UnauthorizedActionError)
  })
})
