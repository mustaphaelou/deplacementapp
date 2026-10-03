import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { NotificationModule } from "./index"
import { sendEmail } from "./adapter"
import { dispatch, dispatchRows } from "./index"
import { NotificationWriteError } from "./dispatch-failure"
import type { NotificationFailureReporter } from "./dispatch-failure"
import type {
  NotificationAdapter,
  NotificationMessage,
  NotificationPayload,
} from "./index"
import { NotificationNotFoundError, UnauthorizedActionError } from "../errors"
import { logAudit } from "../audit"
import * as schema from "../../db/schema"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"

// The adapter's WRITER stays real — only the mail is stubbed. The two tests
// below reach the module through its exported names, which are wired to the
// real `DrizzleNotificationAdapter`, and AC3/AC4 are about rows that are or are
// not in a real database; a stubbed writer would make both assertions vacuous.
// Everything else in this file builds `new NotificationModule(mockAdapter())`
// and is unaffected by which writer the singleton holds.
vi.mock("./adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adapter")>()
  return { ...actual, sendEmail: vi.fn() }
})

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
  it("dispatch sends correct message format to each recipient", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    db.select = mockSelectResult([{ id: "fin-1" }])

    const bus = new NotificationModule(adapter)
    await bus.dispatch("DEMANDE_APPROBATION_MANAGER", makePayload(), db as any)

    const call = adapter.send.mock.calls[0]?.[0] as
      NotificationMessage | undefined
    expect(call).toBeDefined()
    expect(call!.titre).toBe("Demande approuvée par le manager")
    expect(call!.utilisateurId).toBe("fin-1")
    expect(call!.demandeId).toBe("d-1")
  })

  it("dispatch notifies employee for rejection events", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationModule(adapter)

    const payload = makePayload()
    await bus.dispatch("DEMANDE_REJETEE", payload, db as any)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe(payload.employe.id)
    expect(call.titre).toBe("Demande rejetée")
  })

  it("dispatch notifies assignee on withdraw with assigneAId set", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationModule(adapter)

    await bus.dispatch(
      "DEMANDE_RETIREE",
      makePayload({ assigneAId: "approver-1" }),
      db as any
    )

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe("approver-1")
  })

  it("dispatch does not notify assignee on withdraw when assigneAId is null", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationModule(adapter)

    await bus.dispatch(
      "DEMANDE_RETIREE",
      makePayload({ assigneAId: null }),
      db as any
    )

    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("dispatch notifies employee on final approval", async () => {
    const adapter = mockAdapter()
    const db = mockDb()
    const bus = new NotificationModule(adapter)

    const payload = makePayload()
    await bus.dispatch("DEMANDE_APPROBATION_FINALE", payload, db as any)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe(payload.employe.id)
    expect(call.titre).toBe("Demande approuvée")
  })

  // This test used to read "dispatch passes the module's db to send
  // explicitly", and asserted the handle the module was constructed with. This
  // ticket deletes that handle, so the test's premise went with it; the
  // assertion it was reaching for — that `send` gets the handle the call is
  // working through — survives and is now stated in full.
  //
  // It is also the load-bearing assertion of the ticket, and the mirror of the
  // dispatchRows test below. Before, a caller holding a transaction could reach
  // dispatchRows with that transaction and could not reach dispatch at all:
  // dispatch wrote through the handle captured at construction. The module is
  // built here with an adapter and nothing else — there is no second handle it
  // could have reached for — so if every write below is `tx`, by identity, then
  // the transaction the caller holds is the transaction the rows are written in.
  it("dispatch writes every row and sends mail through the caller's transaction", async () => {
    const adapter = mockAdapter()
    const tx = mockDb()
    tx.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    await bus.dispatch("DEMANDE_SOUMISE", makePayload(), tx as any)

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

  it("dispatchRows resolves recipients from the caller's tx and calls send with (message, tx)", async () => {
    const adapter = mockAdapter()
    const tx = mockDb()
    tx.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    await bus.dispatchRows("DEMANDE_SOUMISE", makePayload(), tx as any)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const [message, dbArg] = adapter.send.mock.calls[0] as [
      NotificationMessage,
      unknown,
    ]
    expect(message.utilisateurId).toBe("mgr-hr")
    expect(message.demandeId).toBe("d-1")
    expect(dbArg).toBe(tx)
  })

  it("dispatchRows sends no email (rows-only invariant)", async () => {
    const adapter = mockAdapter()
    const tx = mockDb()
    tx.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    await bus.dispatchRows("DEMANDE_SOUMISE", makePayload(), tx as any)

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("dispatchRows throws when the adapter fails so the caller's transaction rolls back", async () => {
    const adapter = mockAdapter()
    adapter.send.mockResolvedValueOnce({
      success: false,
      error: new Error("DB write error"),
    })
    const tx = mockDb()
    tx.select = mockSelectResult([{ id: "mgr-hr" }])

    const bus = new NotificationModule(adapter)
    await expect(
      bus.dispatchRows("DEMANDE_SOUMISE", makePayload(), tx as any)
    ).rejects.toThrow("DB write error")
  })

  it("dispatchRows no-ops on zero recipients", async () => {
    const adapter = mockAdapter()
    const tx = mockDb()
    tx.select = mockSelectResult([{ id: "mgr-1" }])

    const bus = new NotificationModule(adapter)
    const payload = makePayload({
      employe: { id: "emp-1", prenom: "Jean", nom: "Dupont" },
    })
    await bus.dispatchRows("DEMANDE_NOTIFICATION_LUE", payload, tx as any)

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
    // The receipt names who read it and what they read. These two lines are
    // the only place the DEMANDE_NOTIFICATION_LUE message body is pinned; the
    // test that used to assert them alongside `result.total` is gone with the
    // result type, and the behaviour had to land somewhere.
    expect(call.message).toContain("Jean Dupont")
    expect(call.message).toContain("DD-2025-0001")
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

/**
 * #311 — the two entries' different failure promises, proved from outside.
 *
 * Everything above reaches the module through the class and a hand-written
 * query-builder fake, so it can say what the module was handed and what it did
 * with it. These two cannot: they call the EXPORTED names, wired to the real
 * `DrizzleNotificationAdapter`, and assert against a real database. That is
 * the point #310 bought and the reason these tests are written this way — the
 * promises are part of the interface now, so they have to be observable through
 * the interface.
 *
 * Both assertions are about ROWS. "The call threw" and "the call did not
 * throw" are about the call, not about the data, and a promise about what
 * survives a failure is only provable by looking at what survived.
 */
/**
 * Every message in an error's cause chain, outermost first.
 *
 * Drizzle wraps a driver error in its own before re-throwing, so the sentence
 * that says WHICH constraint refused the write is never the message the caller
 * catches. Matching on one message therefore proves only that a wrapper exists.
 */
const causesOf = (error: Error): string[] => {
  const messages: string[] = []
  let current: unknown = error
  for (let i = 0; i < 8 && current instanceof Error; i++) {
    messages.push(current.message)
    current = (current as Error & { cause?: unknown }).cause
  }
  return messages
}

describe("the two dispatch entries' failure promises", { timeout: 30_000 }, () => {
  let pgliteDb: PgliteDb
  let societeId: string
  let departementId: string
  let employeId: string
  let managerA: string
  let managerB: string
  let demandeId: string

  const notificationRows = () => pgliteDb.select().from(schema.notifications)

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()

    societeId = crypto.randomUUID()
    departementId = crypto.randomUUID()
    employeId = crypto.randomUUID()
    managerA = crypto.randomUUID()
    managerB = crypto.randomUUID()
    demandeId = crypto.randomUUID()

    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Acme",
      modifieLe: new Date(),
    })
    await pgliteDb.insert(schema.departements).values({
      id: departementId,
      nom: "RH",
      societeId,
    })
    // Three Utilisateurs in one Departement: the employee, and two managers who
    // are both `DEMANDE_SOUMISE` recipients. Two recipients is what lets the
    // best-effort test show one write surviving while another is reported.
    await pgliteDb.insert(schema.utilisateurs).values(
      [
        { id: employeId, role: "EMPLOYEE" as const },
        { id: managerA, role: "MANAGER" as const },
        { id: managerB, role: "MANAGER" as const },
      ].map((row) => ({
        ...row,
        email: `${row.id}@acme.ma`,
        nom: "Dupont",
        prenom: "Jean",
        poste: "Dev",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      }))
    )
    await pgliteDb.insert(schema.demandesDeplacement).values({
      id: demandeId,
      numero: "DD-2026-0001",
      employeId,
      employeNom: "Dupont",
      employePrenom: "Jean",
      employePoste: "Dev",
      employeDepartement: "RH",
      etape: "MANAGER_REVIEW",
      decision: "PENDING",
      motif: JSON.stringify(["mission"]),
      dateDepart: new Date("2026-08-01"),
      dateRetour: new Date("2026-08-03"),
      destination: "Casablanca",
      typeTransport: "VOITURE_PERSONNELLE",
      modifieLe: new Date(),
    } as never)
  })

  const payloadFor = (overrides?: Partial<NotificationPayload>) =>
    makePayload({
      demandeId,
      employe: {
        id: employeId,
        prenom: "Jean",
        nom: "Dupont",
        departementId,
      },
      ...overrides,
    })

  /**
   * AC3 — the all-or-nothing half, proved by rollback rather than by the throw.
   *
   * The failing write is the Notification's: its `demandeId` names a
   * DemandeDeplacement this database does not hold, so the foreign key refuses
   * the row. Which constraint refuses it is the premise, not the point. The
   * point is what the refusal costs: the first dispatch had already written
   * two Notification rows, and the audit row the caller wrote alongside them is
   * the transition's own work. A promise about atomicity is only worth
   * something if the rows that DID get written are taken back with the rest —
   * so the assertion is that every row is gone, not that an exception came out.
   *
   * The rows are read back through the module's own exported name, not through
   * `new NotificationModule(...)`: a test that reached for the class would be
   * testing something the production call site never does.
   */
  it("dispatchRows lets a failed write out of the caller's transaction, and the transaction takes its own rows with it", async () => {
    const thrown = await pgliteDb
      .transaction(async (tx) => {
        // The transition's own row, in the caller's transaction — the shape
        // `appliquerEffets` runs in: an audit insert, then the dispatch.
        await logAudit(
          {
            utilisateurId: employeId,
            action: "SOUMISSION",
            entite: "DemandeDeplacement",
            entiteId: demandeId,
            details: { numero: "DD-2026-0001" },
          },
          tx as never
        )
        // Both managers are notified; both rows are written.
        await dispatchRows("DEMANDE_SOUMISE", payloadFor(), tx as never)
        // The second dispatch names a DemandeDeplacement that is not here, so
        // the database refuses the write and the entry throws.
        await dispatchRows(
          "DEMANDE_SOUMISE",
          payloadFor({ demandeId: "demande-absente" }),
          tx as never
        )
      })
      .then(
        () => undefined,
        (e: unknown) => e
      )

    // It propagated, and what propagated is the constraint refusal rather than
    // some wrapper of ours. Drizzle re-throws the driver's error as the `cause`
    // of its own, so the violation is one link down — asserted on the CHAIN,
    // because a `/foreign key/i` match against the outer message reads as
    // "the entry refused" while actually only proving Drizzle formats queries.
    expect(thrown).toBeInstanceOf(Error)
    expect(causesOf(thrown as Error).join(" | ")).toMatch(/foreign key/i)

    // The Notification rows the first dispatch had already written are absent,
    // and so is the row the caller wrote before dispatching anything.
    expect(await notificationRows()).toHaveLength(0)
    expect(await pgliteDb.select().from(schema.journalAudit)).toHaveLength(0)
  })

  /**
   * AC4 — the best-effort half: the write that succeeded is still there, and
   * the failure that did not throw is reported on a channel the caller named.
   *
   * The failing write is a real one. Both recipients' rows are given the same
   * primary key, so the database refuses the second insert the way it refuses
   * any duplicate key — no stub, no fake writer, and the surviving row is a row
   * that was really inserted. `dispatch` neither throws nor undoes the write
   * that worked, which is the whole reason the entry is best-effort: a receipt
   * the caller already recorded must not be lost to a write that failed beside
   * it.
   *
   * The report is a `NotificationWriteError`, and the assertions pin the two
   * things that make it answerable by the route's existing `handleServiceError`:
   * it names the Utilisateur whose write failed, and it carries a numeric
   * `status` — the only thing that handler reads besides the message.
   */
  it("dispatch reports the failed write without throwing and leaves the write that succeeded in place", async () => {
    const reported: NotificationWriteError[] = []
    const report: NotificationFailureReporter = (failure) => {
      reported.push(failure)
    }

    // Both Notification rows get the same primary key, so the second insert is
    // refused by the database. Scoped to this call: the seeds above were built
    // with real UUIDs.
    const ids = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("00000000-0000-0000-0000-00000000000f")
    try {
      await expect(
        dispatch(
          "DEMANDE_SOUMISE",
          payloadFor(),
          pgliteDb as never,
          report
        )
      ).resolves.toBeUndefined()
    } finally {
      ids.mockRestore()
    }

    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].utilisateurId).not.toBe(reported[0]?.utilisateurId)

    expect(reported).toHaveLength(1)
    expect(reported[0]).toBeInstanceOf(NotificationWriteError)
    expect([managerA, managerB]).toContain(reported[0].utilisateurId)
    // The report names the Utilisateur, so an operator reading it knows whose
    // receipt is missing rather than only that something was.
    expect(reported[0].message).toContain(reported[0].utilisateurId)
    // And it carries the status `handleServiceError` answers in, so the route
    // it reaches needs no second translation.
    expect(reported[0].status).toBe(500)
  })
})
