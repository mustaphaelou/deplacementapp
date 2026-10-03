import { describe, it, expect, vi, beforeEach } from "vitest"
import { NotificationModule } from "./index"
import { sendEmail } from "./adapter"
import type {
  NotificationAdapter,
  NotificationMessage,
  NotificationPayload,
} from "./index"
import { NotificationNotFoundError, UnauthorizedActionError } from "../errors"

vi.mock("./adapter", () => ({
  DrizzleNotificationAdapter: vi.fn(),
  sendEmail: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function mockAdapter(): NotificationAdapter & {
  send: ReturnType<typeof vi.fn>
} {
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

const makePayload = (
  overrides?: Partial<NotificationPayload>
): NotificationPayload => ({
  demandeId: "d-1",
  numero: "DD-2025-0001",
  employe: {
    id: "emp-1",
    prenom: "Jean",
    nom: "Dupont",
    departementId: "dept-hr",
  },
  ...overrides,
})

describe("NotificationModule", () => {
  // The counters this test used to read (`total`, `succeeded`, `failed`,
  // `failures`) are gone with the result type #311 deleted: they described a
  // returned object no caller reads, and « only managers of the employee's
  // department » is a claim about WHICH rows were written, so it is asserted
  // as the one row the adapter was handed — and, from outside the class,
  // through the module's own entry point in `failure-policy.test.ts`.
  it("dispatchBestEffort writes one row per resolved recipient, managers of the employee's department only", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    await bus.dispatchBestEffort("DEMANDE_SOUMISE", makePayload(), db as any)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0][0] as NotificationMessage
    expect(call.utilisateurId).toBe("mgr-hr")
  })

  it("dispatchBestEffort sends correct message format to each recipient", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.select = mockSelectResult([{ id: "fin-1" }])

    const bus = new NotificationModule(adapter)
    await bus.dispatchBestEffort(
      "DEMANDE_APPROBATION_MANAGER",
      makePayload(),
      db as any
    )

    const call = adapter.send.mock.calls[0]?.[0] as
      NotificationMessage | undefined
    expect(call).toBeDefined()
    expect(call!.titre).toBe("Demande approuvée par le manager")
    expect(call!.utilisateurId).toBe("fin-1")
    expect(call!.demandeId).toBe("d-1")
  })

  it("dispatchBestEffort notifies employee for rejection events", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationModule(adapter)

    const payload = makePayload()
    await bus.dispatchBestEffort("DEMANDE_REJETEE", payload, db as any)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe(payload.employe.id)
    expect(call.titre).toBe("Demande rejetée")
  })

  it("dispatchBestEffort notifies assignee on withdraw with assigneAId set", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationModule(adapter)

    await bus.dispatchBestEffort(
      "DEMANDE_RETIREE",
      makePayload({ assigneAId: "approver-1" }),
      db as any
    )

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe("approver-1")
  })

  it("dispatchBestEffort does not notify assignee on withdraw when assigneAId is null", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationModule(adapter)

    await bus.dispatchBestEffort(
      "DEMANDE_RETIREE",
      makePayload({ assigneAId: null }),
      db as any
    )

    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("dispatchBestEffort notifies employee on final approval", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationModule(adapter)

    const payload = makePayload()
    await bus.dispatchBestEffort(
      "DEMANDE_APPROBATION_FINALE",
      payload,
      db as any
    )

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe(payload.employe.id)
    expect(call.titre).toBe("Demande approuvée")
  })

  it("dispatchBestEffort routes DEMANDE_NOTIFICATION_LUE to department managers only", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    const payload = makePayload({
      employe: {
        id: "emp-1",
        prenom: "Jean",
        nom: "Dupont",
        departementId: "dept-hr",
      },
    })
    await bus.dispatchBestEffort("DEMANDE_NOTIFICATION_LUE", payload, db as any)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0][0] as NotificationMessage
    expect(call.utilisateurId).toBe("mgr-hr")
    expect(call.titre).toBe("Notification lue par l'employé")
    expect(call.message).toContain("Jean Dupont")
    expect(call.message).toContain("DD-2025-0001")
  })

  it("dispatchBestEffort writes no row for DEMANDE_NOTIFICATION_LUE when no departementId", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.select = mockSelectResult([{ id: "mgr-1" }])

    const bus = new NotificationModule(adapter)
    const payload = makePayload({
      employe: { id: "emp-1", prenom: "Jean", nom: "Dupont" },
    })
    await bus.dispatchBestEffort("DEMANDE_NOTIFICATION_LUE", payload, db as any)

    expect(adapter.send).not.toHaveBeenCalled()
  })

  // This test used to read "dispatch passes the module's db to send
  // explicitly", and asserted the handle the module was constructed with. #310
  // deleted that handle, so the test's premise went with it; the assertion it
  // was reaching for — that `send` gets the handle the call is working
  // through — survives and is now stated in full.
  //
  // It is also the load-bearing assertion of #310, and the mirror of the
  // all-or-nothing test below. The module is built here with an adapter and
  // nothing else — there is no second handle it could have reached for — so if
  // every write below is `tx`, by identity, then the transaction the caller
  // holds is the transaction the rows are written in.
  it("dispatchBestEffort writes every row and sends mail through the caller's transaction", async () => {
    const adapter = mockAdapter()
    const tx = mockDb()
    tx.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    await bus.dispatchBestEffort("DEMANDE_SOUMISE", makePayload(), tx as any)

    // Recipients resolved from the caller's transaction.
    expect(tx.select).toHaveBeenCalled()
    // The Notification row written through it.
    expect(adapter.send).toHaveBeenCalledTimes(1)
    const [message, sendArg] = adapter.send.mock.calls[0] as [
      NotificationMessage,
      unknown,
    ]
    expect(message.utilisateurId).toBe("mgr-hr")
    expect(sendArg).toBe(tx)
    // And the mail read through it, not through a handle of its own.
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const [emailMessage, emailArg] = vi.mocked(sendEmail).mock.calls[0] as [
      NotificationMessage,
      unknown,
    ]
    expect(emailMessage).toBe(message)
    expect(emailArg).toBe(tx)
  })

  it("dispatchRowsAllOrNothing resolves recipients from the caller's tx and calls send with (message, tx)", async () => {
    const adapter = mockAdapter()
    const tx = mockDb()
    tx.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    await bus.dispatchRowsAllOrNothing(
      "DEMANDE_SOUMISE",
      makePayload(),
      tx as any
    )

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const [message, dbArg] = adapter.send.mock.calls[0] as [
      NotificationMessage,
      unknown,
    ]
    expect(message.utilisateurId).toBe("mgr-hr")
    expect(message.demandeId).toBe("d-1")
    expect(dbArg).toBe(tx)
  })

  it("dispatchRowsAllOrNothing sends no email (rows-only invariant)", async () => {
    const adapter = mockAdapter()
    const tx = mockDb()
    tx.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    await bus.dispatchRowsAllOrNothing(
      "DEMANDE_SOUMISE",
      makePayload(),
      tx as any
    )

    expect(sendEmail).not.toHaveBeenCalled()
  })

  // The propagation half of this entry's promise. What it cannot show is the
  // half that matters: that the transaction actually rolls back. That is
  // asserted against a real in-process Postgres, from the module's exported
  // name, in `failure-policy.test.ts`.
  it("dispatchRowsAllOrNothing throws when the adapter fails so the caller's transaction rolls back", async () => {
    const adapter = mockAdapter()
    adapter.send.mockResolvedValueOnce({
      success: false,
      error: new Error("DB write error"),
    })
    const tx = mockDb()
    tx.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    await expect(
      bus.dispatchRowsAllOrNothing("DEMANDE_SOUMISE", makePayload(), tx as any)
    ).rejects.toThrow("DB write error")
  })

  it("dispatchRowsAllOrNothing no-ops on zero recipients", async () => {
    const adapter = mockAdapter()
    const tx = mockDb()
    tx.select = mockSelectResult([{ id: "mgr-1" }])

    const bus = new NotificationModule(adapter)
    const payload = makePayload({
      employe: { id: "emp-1", prenom: "Jean", nom: "Dupont" },
    })
    await bus.dispatchRowsAllOrNothing(
      "DEMANDE_NOTIFICATION_LUE",
      payload,
      tx as any
    )

    expect(adapter.send).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("markAsRead marks the notification as read and dispatches read receipt for the owner employee", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: false,
      utilisateur: {
        id: "emp-1",
        prenom: "Jean",
        nom: "Dupont",
        role: "EMPLOYEE",
        departementId: "dept-hr",
      },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })
    db.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    await bus.markAsRead("notif-1", "emp-1", db as any)

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
      utilisateur: {
        id: "emp-1",
        prenom: "Jean",
        nom: "Dupont",
        role: "EMPLOYEE",
        departementId: "dept-hr",
      },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationModule(adapter)
    await bus.markAsRead("notif-1", "emp-1", db as any)

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
      utilisateur: {
        id: "mgr-1",
        prenom: "Admin",
        nom: "User",
        role: "MANAGER",
        departementId: "dept-hr",
      },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationModule(adapter)
    await bus.markAsRead("notif-1", "mgr-1", db as any)

    expect(db.update).toHaveBeenCalled()
    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("markAsRead throws NotificationNotFoundError when the notification does not exist", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue(null)

    const bus = new NotificationModule(adapter)
    await expect(
      bus.markAsRead("notif-nonexistent", "emp-1", db as any)
    ).rejects.toBeInstanceOf(NotificationNotFoundError)
  })

  it("markAsRead throws UnauthorizedActionError when the reader does not own the notification", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: false,
      utilisateur: {
        id: "emp-1",
        prenom: "Jean",
        nom: "Dupont",
        role: "EMPLOYEE",
        departementId: "dept-hr",
      },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationModule(adapter)
    const promise = bus.markAsRead("notif-1", "emp-2", db as any)
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedActionError)
    await expect(promise).rejects.toMatchObject({
      status: 403,
      message: "Non autorisé",
    })

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
      utilisateur: {
        id: "mgr-1",
        prenom: "Admin",
        nom: "User",
        role: "MANAGER",
        departementId: "dept-hr",
      },
      demande: { id: "d-1", numero: "DD-2025-0001" },
    })

    const bus = new NotificationModule(adapter)
    await expect(
      bus.markAsRead("notif-1", "mgr-2", db as any)
    ).rejects.toBeInstanceOf(UnauthorizedActionError)
    expect(db.update().set().where().returning).not.toHaveBeenCalled()
  })

  it("markAsRead does not dispatch read receipt when notification has no demande", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.query.notifications.findFirst = vi.fn().mockResolvedValue({
      id: "notif-1",
      utilisateurId: "emp-1",
      lu: false,
      utilisateur: {
        id: "emp-1",
        prenom: "Jean",
        nom: "Dupont",
        role: "EMPLOYEE",
        departementId: "dept-hr",
      },
      demande: null,
    })

    const bus = new NotificationModule(adapter)
    await bus.markAsRead("notif-1", "emp-1", db as any)

    expect(db.update).toHaveBeenCalled()
    expect(adapter.send).not.toHaveBeenCalled()
  })
})
