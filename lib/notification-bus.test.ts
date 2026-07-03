import { describe, it, expect, vi } from "vitest"
import { NotificationBus } from "./notification-bus"
import type { NotificationAdapter, NotificationMessage, NotificationPayload } from "./notification-bus"
import type { PrismaClient, Role } from "@prisma/client"
import { NotificationNotFoundError, UnauthorizedActionError } from "./errors"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockAdapter(): NotificationAdapter & { send: ReturnType<typeof vi.fn> } {
  return { send: vi.fn().mockResolvedValue({ success: true }) }
}

function mockPrisma(usersByRole: Array<{ id: string; role: Role; departementId?: string }>): PrismaClient {
  return {
    utilisateur: {
      findMany: vi.fn().mockImplementation((args: { where: { role: Role; actif: boolean; departementId?: string } }) => {
        const where = args.where
        let matches = usersByRole.filter((u) => u.role === where.role)
        if (where.departementId) {
          matches = matches.filter((u) => u.departementId === where.departementId)
        }
        return Promise.resolve(matches.map((u) => ({ id: u.id })))
      }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    notification: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient
}

const makePayload = (overrides?: Partial<NotificationPayload>): NotificationPayload => ({
  demandeId: "d-1",
  numero: "DD-2025-0001",
  employe: { id: "emp-1", prenom: "Jean", nom: "Dupont", departementId: "dept-hr" },
  ...overrides,
})

// ─── dispatch() tests ────────────────────────────────────────────────────────

describe("NotificationBus", () => {
  it("dispatch sends DEMANDE_SOUMISE only to managers in the employee's department", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([
      { id: "mgr-hr", role: "MANAGER", departementId: "dept-hr" },
      { id: "mgr-it", role: "MANAGER", departementId: "dept-it" },
    ])
    const bus = new NotificationBus(adapter, prisma)

    const result = await bus.dispatch("DEMANDE_SOUMISE", makePayload())

    expect(result.total).toBe(1)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.failures).toEqual([])
    const call = adapter.send.mock.calls[0][0] as NotificationMessage
    expect(call.utilisateurId).toBe("mgr-hr")
  })

  it("dispatch reports per-recipient failures when adapter fails", async () => {
    const adapter = mockAdapter()
    adapter.send.mockResolvedValueOnce({ success: false, error: new Error("DB write error") })
    const prisma = mockPrisma([{ id: "mgr-hr", role: "MANAGER", departementId: "dept-hr" }])
    const bus = new NotificationBus(adapter, prisma)

    const result = await bus.dispatch("DEMANDE_SOUMISE", makePayload())

    expect(result.total).toBe(1)
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.failures[0]).toMatchObject({ utilisateurId: "mgr-hr", error: "DB write error" })
  })

  it("dispatch aggregates mixed success/failure across multiple department recipients", async () => {
    const adapter = mockAdapter()
    adapter.send
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: new Error("Network timeout") })

    const prisma = mockPrisma([
      { id: "mgr-hr-1", role: "MANAGER", departementId: "dept-hr" },
      { id: "mgr-hr-2", role: "MANAGER", departementId: "dept-hr" },
    ])
    const bus = new NotificationBus(adapter, prisma)

    const result = await bus.dispatch("DEMANDE_SOUMISE", makePayload())

    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].utilisateurId).toBe("mgr-hr-2")
  })

  it("dispatch succeeds with zero notifications when no roles match and no employee/assignee", async () => {
    const adapter = mockAdapter()
    // FINANCE_ADMIN role is not targeted by DEMANDE_REJETEE; only employee is
    // but we use a fresh adapter that hasn't been configured for role lookup
    const prisma = mockPrisma([]) as unknown as PrismaClient
    const bus = new NotificationBus(adapter, prisma)

    const result = await bus.dispatch("DEMANDE_APPROBATION_FINALE", makePayload())

    // DEMANDE_APPROBATION_FINALE notifies the employee (1 recipient)
    expect(result.total).toBe(1)
    expect(adapter.send).toHaveBeenCalled()
  })

  it("dispatch sends correct message format to each recipient", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([{ id: "fin-1", role: "FINANCE_ADMIN" }])
    const bus = new NotificationBus(adapter, prisma)

    await bus.dispatch("DEMANDE_APPROBATION_MANAGER", makePayload())

    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage | undefined
    expect(call).toBeDefined()
    expect(call!.titre).toBe("Demande approuvée par le manager")
    expect(call!.utilisateurId).toBe("fin-1")
    expect(call!.demandeId).toBe("d-1")
  })

  it("dispatch notifies employee for rejection events", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])
    const bus = new NotificationBus(adapter, prisma)

    const payload = makePayload()
    await bus.dispatch("DEMANDE_REJETEE", payload)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe(payload.employe.id)
    expect(call.titre).toBe("Demande rejetée")
  })

  it("dispatch notifies assignee on withdraw with assigneAId set", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])
    const bus = new NotificationBus(adapter, prisma)

    await bus.dispatch("DEMANDE_RETIREE", makePayload({ assigneAId: "approver-1" }))

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe("approver-1")
  })

  it("dispatch does not notify assignee on withdraw when assigneAId is null", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])
    const bus = new NotificationBus(adapter, prisma)

    await bus.dispatch("DEMANDE_RETIREE", makePayload({ assigneAId: null }))

    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("dispatch notifies employee on final approval", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])
    const bus = new NotificationBus(adapter, prisma)

    const payload = makePayload()
    await bus.dispatch("DEMANDE_APPROBATION_FINALE", payload)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe(payload.employe.id)
    expect(call.titre).toBe("Demande approuvée")
  })

  // ─── DEMANDE_NOTIFICATION_LUE (read receipt) dispatch tests ──────────────

  it("dispatch routes DEMANDE_NOTIFICATION_LUE to department managers only", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([
      { id: "mgr-hr", role: "MANAGER", departementId: "dept-hr" },
      { id: "mgr-it", role: "MANAGER", departementId: "dept-it" },
    ])
    const bus = new NotificationBus(adapter, prisma)

    const payload = makePayload({
      employe: { id: "emp-1", prenom: "Jean", nom: "Dupont", departementId: "dept-hr" },
    })
    const result = await bus.dispatch("DEMANDE_NOTIFICATION_LUE", payload)

    // Only the HR manager should receive — not the IT manager
    expect(result.total).toBe(1)
    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0][0] as NotificationMessage
    expect(call.utilisateurId).toBe("mgr-hr")
    expect(call.titre).toBe("Notification lue par l'employé")
    expect(call.message).toContain("Jean Dupont")
    expect(call.message).toContain("DD-2025-0001")
  })

  it("dispatch sends zero notifications for DEMANDE_NOTIFICATION_LUE when no departementId", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([{ id: "mgr-1", role: "MANAGER", departementId: "dept-hr" }])
    const bus = new NotificationBus(adapter, prisma)

    // No departementId on the employee — should skip department manager routing
    const payload = makePayload({
      employe: { id: "emp-1", prenom: "Jean", nom: "Dupont" },
    })
    const result = await bus.dispatch("DEMANDE_NOTIFICATION_LUE", payload)

    expect(result.total).toBe(0)
    expect(adapter.send).not.toHaveBeenCalled()
  })

  // ─── markAsRead() tests ───────────────────────────────────────────────────

  it("markAsRead marks the notification as read and dispatches read receipt for the owner employee", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([{ id: "mgr-hr", role: "MANAGER", departementId: "dept-hr" }])

    // Mock notification.findUnique to return an unread notification from an employee
    ;(prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: false,
      utilisateur: { id: "emp-1", prenom: "Jean", nom: "Dupont", role: "EMPLOYEE", departementId: "dept-hr" },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationBus(adapter, prisma)
    await bus.markAsRead("notif-1", "emp-1")

    // Should have marked as read
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "notif-1" },
      data: { lu: true },
    })

    // Should have dispatched read receipt to the manager
    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0][0] as NotificationMessage
    expect(call.titre).toBe("Notification lue par l'employé")
    expect(call.utilisateurId).toBe("mgr-hr")
  })

  it("markAsRead is a no-op when notification is already read", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])

    ;(prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: true, // already read
      utilisateur: { id: "emp-1", prenom: "Jean", nom: "Dupont", role: "EMPLOYEE", departementId: "dept-hr" },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationBus(adapter, prisma)
    await bus.markAsRead("notif-1", "emp-1")

    // Should NOT have updated or dispatched anything
    expect(prisma.notification.update).not.toHaveBeenCalled()
    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("markAsRead does not dispatch read receipt for non-EMPLOYEE roles", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])

    ;(prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "notif-1",
      utilisateurId: "mgr-1",
      lu: false,
      utilisateur: { id: "mgr-1", prenom: "Admin", nom: "User", role: "MANAGER", departementId: "dept-hr" },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationBus(adapter, prisma)
    await bus.markAsRead("notif-1", "mgr-1")

    // Should mark as read
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "notif-1" },
      data: { lu: true },
    })

    // Should NOT dispatch read receipt (reader is a MANAGER, not an EMPLOYEE)
    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("markAsRead throws NotificationNotFoundError when the notification does not exist", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])

    ;(prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const bus = new NotificationBus(adapter, prisma)

    await expect(bus.markAsRead("notif-nonexistent", "emp-1")).rejects.toBeInstanceOf(
      NotificationNotFoundError
    )
  })

  it("markAsRead throws UnauthorizedActionError when the reader does not own the notification", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])

    ;(prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: false,
      utilisateur: { id: "emp-1", prenom: "Jean", nom: "Dupont", role: "EMPLOYEE", departementId: "dept-hr" },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationBus(adapter, prisma)

    // Tried by a different user
    const promise = bus.markAsRead("notif-1", "emp-2")
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedActionError)
    await expect(promise).rejects.toMatchObject({ status: 403, message: "Non autorisé" })

    // Should NOT have updated or dispatched anything
    expect(prisma.notification.update).not.toHaveBeenCalled()
    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("markAsRead enforces ownership even when the owner is not an EMPLOYEE", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])

    ;(prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "notif-1",
      utilisateurId: "mgr-1",
      lu: false,
      utilisateur: { id: "mgr-1", prenom: "Admin", nom: "User", role: "MANAGER", departementId: "dept-hr" },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationBus(adapter, prisma)
    // Owner is mgr-1, requester is mgr-2 → should throw UnauthorizedActionError
    await expect(bus.markAsRead("notif-1", "mgr-2")).rejects.toBeInstanceOf(
      UnauthorizedActionError
    )
    expect(prisma.notification.update).not.toHaveBeenCalled()
  })

  it("markAsRead does not dispatch read receipt when notification has no demande", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])

    ;(prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: false,
      utilisateur: { id: "emp-1", prenom: "Jean", nom: "Dupont", role: "EMPLOYEE", departementId: "dept-hr" },
      demande: null, // no linked demande
    })

    const bus = new NotificationBus(adapter, prisma)
    await bus.markAsRead("notif-1", "emp-1")

    // Should mark as read
    expect(prisma.notification.update).toHaveBeenCalled()

    // Should NOT dispatch read receipt (no demande linked)
    expect(adapter.send).not.toHaveBeenCalled()
  })
})
