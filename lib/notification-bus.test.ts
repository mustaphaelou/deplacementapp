import { describe, it, expect, vi } from "vitest"
import { NotificationBus } from "./notification-bus"
import type { NotificationAdapter, NotificationMessage, NotificationPayload } from "./notification-bus"
import { NotificationNotFoundError, UnauthorizedActionError } from "./errors"

function mockAdapter(): NotificationAdapter & { send: ReturnType<typeof vi.fn> } {
  return { send: vi.fn().mockResolvedValue({ success: true }) }
}

function mockSelectResult(users: Array<{ id: string }> = []) {
  return vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(users),
    })),
  }))
}

function mockDb() {
  return {
    select: mockSelectResult([]),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "n-1" }]),
        })),
      })),
    })),
    query: {
      notifications: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  }
}

const makePayload = (overrides?: Partial<NotificationPayload>): NotificationPayload => ({
  demandeId: "d-1",
  numero: "DD-2025-0001",
  employe: { id: "emp-1", prenom: "Jean", nom: "Dupont", departementId: "dept-hr" },
  ...overrides,
})

describe("NotificationBus", () => {
  it("dispatch sends DEMANDE_SOUMISE only to managers in the employee's department", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationBus(adapter, db as any)
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
    const db = mockDb()
    db.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationBus(adapter, db as any)
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
    const db = mockDb()
    db.select = mockSelectResult([{ id: "mgr-hr-1" }, { id: "mgr-hr-2" }])

    const bus = new NotificationBus(adapter, db as any)
    const result = await bus.dispatch("DEMANDE_SOUMISE", makePayload())

    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].utilisateurId).toBe("mgr-hr-2")
  })

  it("dispatch succeeds with zero notifications when no roles match and no employee/assignee", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.select = mockSelectResult([])

    const bus = new NotificationBus(adapter, db as any)
    const result = await bus.dispatch("DEMANDE_APPROBATION_FINALE", makePayload())

    expect(result.total).toBe(1)
    expect(adapter.send).toHaveBeenCalled()
  })

  it("dispatch sends correct message format to each recipient", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.select = mockSelectResult([{ id: "fin-1" }])

    const bus = new NotificationBus(adapter, db as any)
    await bus.dispatch("DEMANDE_APPROBATION_MANAGER", makePayload())

    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage | undefined
    expect(call).toBeDefined()
    expect(call!.titre).toBe("Demande approuvée par le manager")
    expect(call!.utilisateurId).toBe("fin-1")
    expect(call!.demandeId).toBe("d-1")
  })

  it("dispatch notifies employee for rejection events", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationBus(adapter, db as any)

    const payload = makePayload()
    await bus.dispatch("DEMANDE_REJETEE", payload)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe(payload.employe.id)
    expect(call.titre).toBe("Demande rejetée")
  })

  it("dispatch notifies assignee on withdraw with assigneAId set", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationBus(adapter, db as any)

    await bus.dispatch("DEMANDE_RETIREE", makePayload({ assigneAId: "approver-1" }))

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe("approver-1")
  })

  it("dispatch does not notify assignee on withdraw when assigneAId is null", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationBus(adapter, db as any)

    await bus.dispatch("DEMANDE_RETIREE", makePayload({ assigneAId: null }))

    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("dispatch notifies employee on final approval", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationBus(adapter, db as any)

    const payload = makePayload()
    await bus.dispatch("DEMANDE_APPROBATION_FINALE", payload)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe(payload.employe.id)
    expect(call.titre).toBe("Demande approuvée")
  })

  it("dispatch routes DEMANDE_NOTIFICATION_LUE to department managers only", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationBus(adapter, db as any)
    const payload = makePayload({
      employe: { id: "emp-1", prenom: "Jean", nom: "Dupont", departementId: "dept-hr" },
    })
    const result = await bus.dispatch("DEMANDE_NOTIFICATION_LUE", payload)

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
    const db = mockDb()
    db.select = mockSelectResult([{ id: "mgr-1" }])

    const bus = new NotificationBus(adapter, db as any)
    const payload = makePayload({
      employe: { id: "emp-1", prenom: "Jean", nom: "Dupont" },
    })
    const result = await bus.dispatch("DEMANDE_NOTIFICATION_LUE", payload)

    expect(result.total).toBe(0)
    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("markAsRead marks the notification as read and dispatches read receipt for the owner employee", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: false,
      utilisateur: { id: "emp-1", prenom: "Jean", nom: "Dupont", role: "EMPLOYEE", departementId: "dept-hr" },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })
    db.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationBus(adapter, db as any)
    await bus.markAsRead("notif-1", "emp-1")

    expect(db.update).toHaveBeenCalled()
    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0][0] as NotificationMessage
    expect(call.titre).toBe("Notification lue par l'employé")
    expect(call.utilisateurId).toBe("mgr-hr")
  })

  it("markAsRead is a no-op when notification is already read", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: true,
      utilisateur: { id: "emp-1", prenom: "Jean", nom: "Dupont", role: "EMPLOYEE", departementId: "dept-hr" },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationBus(adapter, db as any)
    await bus.markAsRead("notif-1", "emp-1")

    expect(db.update().set().where().returning).not.toHaveBeenCalled()
    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("markAsRead does not dispatch read receipt for non-EMPLOYEE roles", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue({
      id: "notif-1",
      utilisateurId: "mgr-1",
      lu: false,
      utilisateur: { id: "mgr-1", prenom: "Admin", nom: "User", role: "MANAGER", departementId: "dept-hr" },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationBus(adapter, db as any)
    await bus.markAsRead("notif-1", "mgr-1")

    expect(db.update).toHaveBeenCalled()
    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("markAsRead throws NotificationNotFoundError when the notification does not exist", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue(null)

    const bus = new NotificationBus(adapter, db as any)
    await expect(bus.markAsRead("notif-nonexistent", "emp-1")).rejects.toBeInstanceOf(
      NotificationNotFoundError
    )
  })

  it("markAsRead throws UnauthorizedActionError when the reader does not own the notification", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: false,
      utilisateur: { id: "emp-1", prenom: "Jean", nom: "Dupont", role: "EMPLOYEE", departementId: "dept-hr" },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationBus(adapter, db as any)
    const promise = bus.markAsRead("notif-1", "emp-2")
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedActionError)
    await expect(promise).rejects.toMatchObject({ status: 403, message: "Non autorisé" })

    expect(db.update().set().where().returning).not.toHaveBeenCalled()
    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("markAsRead enforces ownership even when the owner is not an EMPLOYEE", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue({
      id: "notif-1",
      utilisateurId: "mgr-1",
      lu: false,
      utilisateur: { id: "mgr-1", prenom: "Admin", nom: "User", role: "MANAGER", departementId: "dept-hr" },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationBus(adapter, db as any)
    await expect(bus.markAsRead("notif-1", "mgr-2")).rejects.toBeInstanceOf(
      UnauthorizedActionError
    )
    expect(db.update().set().where().returning).not.toHaveBeenCalled()
  })

  it("markAsRead does not dispatch read receipt when notification has no demande", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: false,
      utilisateur: { id: "emp-1", prenom: "Jean", nom: "Dupont", role: "EMPLOYEE", departementId: "dept-hr" },
      demande: null,
    })

    const bus = new NotificationBus(adapter, db as any)
    await bus.markAsRead("notif-1", "emp-1")

    expect(db.update).toHaveBeenCalled()
    expect(adapter.send).not.toHaveBeenCalled()
  })
})
