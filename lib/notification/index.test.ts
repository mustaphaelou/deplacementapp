/**
 * #312 — the Notification module's suite, against a real database.
 *
 * This file used to have two halves. One built `new NotificationModule(
 * mockAdapter())` and handed it a `mockDb()` — three hand-written fakes of the
 * query builder, each one stubbed to answer whatever the code under test asked
 * for. A fake like that cannot be wrong: the module asked for the managers and
 * the fake produced the managers, so « DEMANDE_SOUMISE reaches the employee's
 * own Department's managers » was a statement about the stub, not about the
 * module. The other half, added by #311, called the EXPORTED names against
 * PGlite and asserted rows.
 *
 * The fakes are gone. Everything below reaches the module through its public
 * entries — `dispatch`, `dispatchRows`, `markAsRead` — wired to the real
 * `DrizzleNotificationAdapter`, against ONE in-process Postgres for the whole
 * file. Every test states an OUTCOME: rows present, rows absent, a failure
 * reported. None of them asks which queries ran, because « the module called
 * `select` » is not a thing a reader cares about and « nobody was told » is.
 *
 * What that costs, plainly: the suite no longer says anything about the
 * `NotificationAdapter` interface being injectable. It never was a property
 * worth keeping — ADR-0010's adapter-mock seam was retained then because the
 * alternative was not yet written, and it hid the `countUnread` bug in the
 * process. The class is still exercised, because `_default` IS a
 * `NotificationModule` and these are its methods.
 *
 * ONE PGlite for the file. A `createPgliteDb()` per describe would work and
 * would cost a fresh Postgres boot each time; a `createPgliteDb()` per TEST
 * times out under full-suite load, which is why the describes carry an
 * explicit timeout rather than relying on vitest's 5s default.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { sql, eq } from "drizzle-orm"
import * as schema from "../../db/schema"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { dispatch, dispatchRows, markAsRead } from "./index"
import { sendEmail } from "./adapter"
import { NotificationMailError, NotificationWriteError } from "./dispatch-failure"
import type { NotificationFailureReporter } from "./dispatch-failure"
import type { NotificationPayload } from "./index"
import { NotificationNotFoundError, UnauthorizedActionError } from "../errors"
import { logAudit } from "../audit"

// The adapter's WRITER stays real — only the mail is stubbed. Every assertion
// below is about rows that are or are not in a real database, and a stubbed
// writer would make all of them vacuous: « these rows exist » is only a claim
// if something really inserted them. `sendEmail` has to be stubbed because
// without it every dispatch test tries to send real mail.
vi.mock("./adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adapter")>()
  return { ...actual, sendEmail: vi.fn() }
})

const TIMEOUT = 30_000

let pgliteDb: PgliteDb
let societeId: string
let departementId: string
let autreDepartementId: string
let employeId: string
let managerA: string
let managerB: string
// The inactive one. `conditionActif` is the Utilisateur reader's rule, and a
// seed with no inactive Utilisateur in the set cannot tell « filtered by
// activity » from « every MANAGER in the Department » — helpers.test.ts says
// the same thing about its own seed, and it is true here too.
let managerInactif: string
let managerAutreDept: string
// #355/#356 — an inactive EMPLOYEE, and an inactive Assignataire.
//
// The EMPLOYEE is the read-receipt PRODUCER: `markAsRead` dispatches
// `DEMANDE_NOTIFICATION_LUE` to the reader's Department's managers, so a seed
// holding no inactive employee cannot tell « refused the reader » from
// « marked the row and mailed the two managers ». The Assignataire is
// `DEMANDE_RETIREE`'s only recipient, which is what makes the inactive
// assignee observable through rows rather than through a returned set.
//
// Both are seeded Role EMPLOYEE, and the reason is that `EVENT_ROLE_MAP`
// targets MANAGER, FINANCE_ADMIN and GENERAL_DIRECTION and nothing else: a
// Utilisateur in one of those Roles would become a candidate for some other
// event in this file and every set assertion here would be reading two rules
// at once.
let employeInactif: string
let assigneInactif: string
let financeId: string
let demandeId: string

/** Every Notification row. */
const notificationRows = () => pgliteDb.select().from(schema.notifications)

beforeEach(() => {
  vi.clearAllMocks()
})

/**
 * Isolation. Every test below asserts « these rows exist » or « these rows do
 * not exist », and a row a previous test left behind would make the second
 * kind of claim false without anything being wrong. So each test starts from
 * an empty pair of tables. The Utilisateurs and the DemandeDeplacement are
 * seeded once and kept: they are the fixture, not the subject.
 */
beforeEach(async () => {
  await pgliteDb.execute(sql`DELETE FROM notifications`)
  await pgliteDb.execute(sql`DELETE FROM journal_audit`)
})

beforeAll(async () => {
  pgliteDb = await createPgliteDb()

  societeId = crypto.randomUUID()
  departementId = crypto.randomUUID()
  autreDepartementId = crypto.randomUUID()
  employeId = crypto.randomUUID()
  managerA = crypto.randomUUID()
  managerB = crypto.randomUUID()
  managerInactif = crypto.randomUUID()
  managerAutreDept = crypto.randomUUID()
  employeInactif = crypto.randomUUID()
  assigneInactif = crypto.randomUUID()
  financeId = crypto.randomUUID()
  demandeId = crypto.randomUUID()

  await pgliteDb.insert(schema.societes).values({
    id: societeId,
    nom: "Acme",
    modifieLe: new Date(),
  })
  await pgliteDb.insert(schema.departements).values([
    { id: departementId, nom: "RH", societeId },
    { id: autreDepartementId, nom: "Marketing", societeId },
  ])
  // Two MANAGERs in the employee's own Departement, one who is not active, and
  // one in another Departement: « the employee's own Department's managers »
  // is only a claim if there is a manager somewhere it does not hold.
  await pgliteDb.insert(schema.utilisateurs).values(
    [
      { id: employeId, role: "EMPLOYEE" as const, nom: "Dupont", prenom: "Jean" },
      { id: managerA, role: "MANAGER" as const, nom: "Dupont", prenom: "Jean" },
      { id: managerB, role: "MANAGER" as const, nom: "Dupont", prenom: "Jean" },
      { id: managerInactif, role: "MANAGER" as const, nom: "Petit", prenom: "Lucie", actif: false },
      // #355/#356 — the two inactive Utilisateurs the new rule is about. The
      // EMPLOYEE is in the reader's own Departement, so if `markAsRead` ever
      // dispatched a read receipt for them the two MANAGERs beside them would
      // receive it, and the assertion « no extra row » below would fail for a
      // reason the test can name.
      { id: employeInactif, role: "EMPLOYEE" as const, nom: "Roux", prenom: "Rena", actif: false },
      { id: assigneInactif, role: "EMPLOYEE" as const, nom: "Blanc", prenom: "Basile", actif: false },
      {
        id: managerAutreDept,
        role: "MANAGER" as const,
        nom: "Marchand",
        prenom: "Marc",
        departementId: autreDepartementId,
      },
      {
        id: financeId,
        role: "FINANCE_ADMIN" as const,
        nom: "Faure",
        prenom: "Fanny",
        departementId: autreDepartementId,
      },
    ].map((row) => ({
      email: `${row.id}@acme.ma`,
      poste: "Dev",
      departementId,
      societeId,
      actif: true,
      modifieLe: new Date(),
      // Spread LAST: the two rows that differ from the default — the inactive
      // MANAGER and the two in the other Departement — say so here, and a
      // default written after the spread would quietly undo both.
      ...row,
    }))
  )
  // Required even though no test reads it: `notifications.demandeId` is a
  // foreign key to this table, so without the row every write below is refused
  // and every assertion about what was written would be about nothing.
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
}, TIMEOUT)

const makePayload = (
  overrides?: Partial<NotificationPayload>
): NotificationPayload => ({
  demandeId,
  numero: "DD-2026-0001",
  employe: {
    id: employeId,
    prenom: "Jean",
    nom: "Dupont",
    departementId,
  },
  ...overrides,
})

const payloadFor = (overrides?: Partial<NotificationPayload>) =>
  makePayload(overrides)

/** The Utilisateur each written row went to, sorted so order never matters. */
const recipientsOf = (rows: Array<{ utilisateurId: string }>) =>
  rows.map((row) => row.utilisateurId).sort()

/** The Utilisateur each mail went to, read off the stubbed `sendEmail`. */
const mailedTo = () =>
  vi
    .mocked(sendEmail)
    .mock.calls.map((call) => call[0].utilisateurId)
    .sort()

/**
 * « No mail went out. »
 *
 * Asserted on the RECIPIENTS rather than as `expect(sendEmail).not
 * .toHaveBeenCalled()` and not even on `mock.calls` length. That form passes
 * quietly and then, when it FAILS — which is the only time it has anything to
 * say — sends vitest off to serialize the mock's own object graph, which holds
 * the Drizzle handle and everything it references. The worker died of heap
 * exhaustion before printing a line of failure output, twice, on a suite that
 * was otherwise green.
 *
 * `mailedTo()` reduces the calls to the ids they went to, so the failure prints
 * WHO was mailed instead of a count — the assertion a reader actually needs —
 * and a plain array of strings never drags the handle into the diff.
 */
const expectNoMail = () => {
  expect(mailedTo()).toEqual([])
}

/** The seeded Utilisateur as the database holds it — the seed, verified. */
const theSeededUtilisateur = (id: string) =>
  pgliteDb.query.utilisateurs.findFirst({ where: eq(schema.utilisateurs.id, id) })

/**
 * Insert the Notification row `markAsRead` is about to be handed. The module
 * reads it relationally — `with: { utilisateur, demande }` — so the row needs
 * a real Utilisateur and, unless the test is about a notification with no
 * DemandeDeplacement, a real DemandeDeplacement on the far side of the
 * foreign key. A fake answered that query whatever it was asked; this
 * database will not invent a notification for an id nobody inserted.
 */
const givenANotification = async (
  overrides?: Partial<{
    utilisateurId: string
    demandeId: string | null
    lu: boolean
    titre: string
  }>
) => {
  const id = crypto.randomUUID()
  await pgliteDb.insert(schema.notifications).values({
    id,
    utilisateurId: overrides?.utilisateurId ?? employeId,
    demandeId: overrides?.demandeId === undefined ? demandeId : overrides.demandeId,
    titre: overrides?.titre ?? "Nouvelle demande de déplacement",
    message: "Jean Dupont a soumis une demande de déplacement.",
    lu: overrides?.lu ?? false,
  })
  return id
}

describe("the dispatch entries write the rows they resolved", { timeout: TIMEOUT }, () => {
  /**
   * The recipient rule for a department-scoped event, stated as the rows it
   * produced. A MANAGER in another Departement is seeded precisely so « own
   * Department's » has something to exclude, and the employee is seeded so
   * « reaches nobody else » has somebody to exclude.
   */
  it("DEMANDE_SOUMISE reaches the employee's own Department's managers, and no one else", async () => {
    await dispatch("DEMANDE_SOUMISE", payloadFor(), pgliteDb as never)

    const rows = await notificationRows()
    expect(recipientsOf(rows)).toEqual([managerA, managerB].sort())
    // Three people it did NOT reach, each for a different reason.
    expect(recipientsOf(rows)).not.toContain(managerAutreDept)
    expect(recipientsOf(rows)).not.toContain(employeId)
    expect(recipientsOf(rows)).not.toContain(financeId)
  })

  /**
   * AC3 — the mixed set, against a real database. The claim is the negative
   * one and it is the whole point: an Utilisateur who cannot act gets nothing
   * at all, on BOTH channels. The mail line is not redundant with the row
   * line: a module that filtered the recipient set but still mailed the
   * inactive manager would pass a rows-only assertion, and « received nothing »
   * means neither.
   */
  it("an inactive Utilisateur receives nothing — no row and no mail", async () => {
    // The candidate is real before the negative means anything: an inactive
    // MANAGER in the employee's own Departement, read back out of the table
    // rather than assumed from the seed. Without this line a resolver that
    // ignored `actif` entirely would still pass every other assertion here.
    expect(await theSeededUtilisateur(managerInactif)).toMatchObject({
      role: "MANAGER",
      departementId,
      actif: false,
    })

    await dispatch("DEMANDE_SOUMISE", payloadFor(), pgliteDb as never)

    expect(recipientsOf(await notificationRows())).not.toContain(managerInactif)
    expect(mailedTo()).not.toContain(managerInactif)
    // And the active pair were reached, so the negative above is the rule at
    // work rather than an event nobody was a recipient of.
    expect(recipientsOf(await notificationRows())).toEqual(
      [managerA, managerB].sort()
    )
  })

  /**
   * The message an event produces is now the row. Before, it was an argument
   * a stub captured; here the titre and the message are columns, so the test
   * that pins them is also the test that proves the row carries them.
   */
  it("DEMANDE_APPROBATION_MANAGER writes the manager-approval message for the finance admin", async () => {
    await dispatch(
      "DEMANDE_APPROBATION_MANAGER",
      payloadFor(),
      pgliteDb as never
    )

    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].utilisateurId).toBe(financeId)
    expect(rows[0].demandeId).toBe(demandeId)
    expect(rows[0].titre).toBe("Demande approuvée par le manager")
    // The message names who and which DemandeDeplacement — the two things a
    // reader of the notification needs and the row is what carries them now.
    expect(rows[0].message).toContain("Jean Dupont")
    expect(rows[0].message).toContain("DD-2026-0001")
  })

  it("DEMANDE_APPROBATION_FINALE reaches the employee's own notifications", async () => {
    await dispatch("DEMANDE_APPROBATION_FINALE", payloadFor(), pgliteDb as never)

    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].utilisateurId).toBe(employeId)
    expect(rows[0].titre).toBe("Demande approuvée")
  })

  it("DEMANDE_REJETEE reaches the employee's own notifications", async () => {
    await dispatch("DEMANDE_REJETEE", payloadFor(), pgliteDb as never)

    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].utilisateurId).toBe(employeId)
    expect(rows[0].titre).toBe("Demande rejetée")
  })

  /**
   * The assignee, and only the assignee: this event has no role targets, so
   * the recipient set is exactly what the payload named.
   */
  it("DEMANDE_RETIREE reaches the assignee when assigneAId is set", async () => {
    await dispatch(
      "DEMANDE_RETIREE",
      payloadFor({ assigneAId: financeId }),
      pgliteDb as never
    )

    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].utilisateurId).toBe(financeId)
    expect(rows[0].titre).toBe("Demande retirée")
    expect(rows[0].message).toContain("Jean Dupont")
    expect(rows[0].message).toContain("DD-2026-0001")
  })

  /**
   * The negative of the test above, and the one a tally-free entry point can
   * still make: no assignee, nobody to write to, so no row and no mail. The
   * two MANAGERs in the employee's Department are the seed that makes the
   * empty set a decision rather than an accident — they are not recipients of
   * this event.
   */
  it("DEMANDE_RETIREE reaches nobody when assigneAId is null", async () => {
    await dispatch(
      "DEMANDE_RETIREE",
      payloadFor({ assigneAId: null }),
      pgliteDb as never
    )

    expect(await notificationRows()).toHaveLength(0)
    expectNoMail()
  })

  /**
   * `dispatch` writes every row AND sends the mail — one mail per row, not one
   * per call and not one per event. Counting both and pairing them is what
   * makes it « per row»: the mails went to the Utilisateurs the rows went to.
   */
  it("dispatch writes every row and sends one mail per row", async () => {
    await dispatch("DEMANDE_SOUMISE", payloadFor(), pgliteDb as never)

    const rows = await notificationRows()
    expect(rows).toHaveLength(2)
    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(mailedTo()).toEqual(recipientsOf(rows))
  })

  /**
   * The rows-only invariant, which is the reason the transition module has its
   * own entry (ADR-0007): `dispatchRows` writes and does not mail. Before, the
   * fake asserted a stub had not been called; now the mail that did NOT go out
   * is the assertion.
   */
  it("dispatchRows writes the rows and sends no mail", async () => {
    await dispatchRows("DEMANDE_SOUMISE", payloadFor(), pgliteDb as never)

    const rows = await notificationRows()
    expect(rows).toHaveLength(2)
    expect(recipientsOf(rows)).toEqual([managerA, managerB].sort())
    expectNoMail()
  })

  /**
   * AC4 — the recipient set resolves to nobody, and the entry does nothing
   * about it: no rows, no mail, no throw. The payload's employee has no
   * `departementId`, so the department-scoped recipient query cannot be asked
   * and the set is empty before any row is written.
   */
  it("dispatchRows writes nothing when the recipient set resolves to nobody", async () => {
    await dispatchRows(
      "DEMANDE_NOTIFICATION_LUE",
      payloadFor({
        employe: { id: employeId, prenom: "Jean", nom: "Dupont" },
      }),
      pgliteDb as never
    )

    expect(await notificationRows()).toHaveLength(0)
    expectNoMail()
  })
})

describe("markAsRead reads the row and then reports on it", { timeout: TIMEOUT }, () => {
  /**
   * The one entry point that reads a handle before it writes one, so it is the
   * one the fakes were hiding hardest: `findFirst` with `with: { utilisateur,
   * demande }` was answered by a stub. Here the notification, its Utilisateur
   * and its DemandeDeplacement are all rows somebody inserted.
   */
  it("sets lu on the row and writes the read receipt to the Department's managers", async () => {
    const notificationId = await givenANotification()

    await markAsRead(notificationId, employeId, pgliteDb as never)

    const rows = await notificationRows()
    const marked = rows.find((row) => row.id === notificationId)
    expect(marked?.lu).toBe(true)

    // The receipt is a NEW row, going to the managers of the READER's
    // Department — the two active ones, and not the inactive manager seeded
    // beside them.
    const receipts = rows.filter((row) => row.id !== notificationId)
    expect(recipientsOf(receipts)).toEqual([managerA, managerB].sort())
    expect(receipts[0].titre).toBe("Notification lue par l'employé")
    // The receipt names who read it and what they read. These two lines are the
    // only place the DEMANDE_NOTIFICATION_LUE body is pinned.
    expect(receipts[0].message).toContain("Jean Dupont")
    expect(receipts[0].message).toContain("DD-2026-0001")
  })

  /**
   * The no-op. Asserted as outcomes because the old assertion was a query: the
   * row is still read and still the only row there is, so no receipt was
   * written — a second row would be the receipt.
   */
  it("leaves an already-read notification alone", async () => {
    const notificationId = await givenANotification({ lu: true })

    await markAsRead(notificationId, employeId, pgliteDb as never)

    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].lu).toBe(true)
    expectNoMail()
  })

  /**
   * A MANAGER may read a notification without the read being announced to
   * their own Department's managers. `lu` is set either way — the read
   * happened — and the announcement is the part that does not happen.
   */
  it("sets lu without a receipt when the reader is not an EMPLOYEE", async () => {
    const notificationId = await givenANotification({
      utilisateurId: managerA,
    })

    await markAsRead(notificationId, managerA, pgliteDb as never)

    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].lu).toBe(true)
    expectNoMail()
  })

  /**
   * The 404. `NotificationNotFoundError` is what a route's `handleServiceError`
   * turns into « Notification introuvable », so what the test pins is that this
   * id — which nobody inserted — produces that error and nothing else.
   */
  it("reports NotificationNotFoundError for an id nobody inserted", async () => {
    await expect(
      markAsRead(crypto.randomUUID(), employeId, pgliteDb as never)
    ).rejects.toBeInstanceOf(NotificationNotFoundError)

    expect(await notificationRows()).toHaveLength(0)
  })

  /**
   * The 403, stated through the same exported name. `UnauthorizedActionError`
   * is a domain error and its shape IS the behaviour here: the message and the
   * numeric `status` are the two things `handleServiceError` reads.
   *
   * The negative half matters as much: the notification stays unread. The old
   * test asserted a stub had not been called; this asserts the row is exactly
   * as it was.
   */
  it("refuses a reader who does not own the notification", async () => {
    const notificationId = await givenANotification()

    await expect(
      markAsRead(notificationId, managerA, pgliteDb as never)
    ).rejects.toBeInstanceOf(UnauthorizedActionError)
    await expect(
      markAsRead(notificationId, managerA, pgliteDb as never)
    ).rejects.toMatchObject({ status: 403, message: "Non autorisé" })

    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].lu).toBe(false)
    expectNoMail()
  })

  /**
   * Ownership is checked before the role, so a MANAGER's notification is not
   * readable by another MANAGER either. Same error as the EMPLOYEE case above:
   * whether the owner is an EMPLOYEE decides whether a READ RECEIPT follows,
   * never whether the read is allowed.
   */
  it("enforces ownership even when the owner is not an EMPLOYEE", async () => {
    const notificationId = await givenANotification({
      utilisateurId: managerA,
    })

    await expect(
      markAsRead(notificationId, managerB, pgliteDb as never)
    ).rejects.toBeInstanceOf(UnauthorizedActionError)

    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].lu).toBe(false)
  })

  /**
   * A notification with no DemandeDeplacement cannot name one in its receipt.
   * `notifications.demandeId` is nullable, so this is reachable against a real
   * database — a fake's `demande: null` was a thing the stub said, not a thing
   * the schema allowed.
   */
  it("sets lu without a receipt when the notification has no demande", async () => {
    const notificationId = await givenANotification({ demandeId: null })

    await markAsRead(notificationId, employeId, pgliteDb as never)

    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].lu).toBe(true)
    expectNoMail()
  })

  /**
   * #356 — the activity rule on the read path, and the reason it belongs in
   * this module rather than at its one route.
   *
   * `app/api/notifications/[id]/route.ts` is already closed to an inactive
   * Utilisateur: `requireAuth()` → `currentUser()` asks `peutAgir` and answers
   * 401 « Non autorisé » before this entry is reached. That is a property of a
   * CALLER, and a module-level invariant that holds only because a caller
   * remembered a check is the defect class #309/#310 were opened for — this
   * entry takes a handle, so tests and any future caller reach it directly.
   * The check therefore lives here, and this test is the pin that says so.
   *
   * The refusal is stated as OUTCOMES rather than as a thrown class alone: the
   * row is still unread AND no second row exists. Both halves are load-bearing
   * — `lu` is written BEFORE the receipt dispatch, so an implementation that
   * checked activity only where the receipt is decided would set `lu` and
   * still pass a `rejects` assertion.
   *
   * The reader here OWNS the notification and is in the reader's own
   * Departement with two active MANAGERs beside them, so the receipt really
   * would have landed. The candidate is read back out of the table rather than
   * assumed from the seed, because without that line a resolver that ignored
   * `actif` entirely would pass every assertion here.
   */
  it("refuses an inactive reader and changes nothing", async () => {
    expect(await theSeededUtilisateur(employeInactif)).toMatchObject({
      role: "EMPLOYEE",
      departementId,
      actif: false,
    })

    const notificationId = await givenANotification({
      utilisateurId: employeInactif,
    })

    await expect(
      markAsRead(notificationId, employeInactif, pgliteDb as never)
    ).rejects.toBeInstanceOf(UnauthorizedActionError)
    await expect(
      markAsRead(notificationId, employeInactif, pgliteDb as never)
    ).rejects.toMatchObject({ status: 403 })

    // The state, which is the half a thrown class does not tell you: the row is
    // exactly as it was, and no read receipt was written to anybody.
    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].lu).toBe(false)
    expectNoMail()
  })

  /**
   * The same refusal for a reader whose Notification would produce no receipt
   * at all, and whose ownership is not in question. Without it, an
   * implementation that refused only inside the `role === "EMPLOYEE"` branch —
   * or only where the receipt is decided — would pass the case above for the
   * wrong reason, and this one would be the only thing holding it: the rule is
   * asked about the READER, not about the branch they happen to take
   * afterwards.
   *
   * The reader OWNS this notification (`utilisateurId: employeInactif`). An
   * earlier draft of this case left the default owner, and it passed for a
   * reason worth naming: the call then hit the OWNERSHIP refusal at
   * `index.ts:216` and threw the same class, so the case was green before the
   * fix and would have stayed green with the activity check deleted entirely.
   * A refusal case that passes for the wrong reason is the one failure mode an
   * assertion on the thrown class cannot see.
   *
   * `lu: true` makes the check the FIRST one to fire. On the other side of the
   * fix the already-read branch returns without throwing, so a refusal here can
   * only have come from the activity check — and a check placed AFTER that
   * branch would be unreachable rather than merely wrong.
   */
  it("refuses an inactive reader whose notification would produce no receipt", async () => {
    const notificationId = await givenANotification({
      utilisateurId: employeInactif,
      demandeId: null,
      lu: true,
    })

    await expect(
      markAsRead(notificationId, employeInactif, pgliteDb as never)
    ).rejects.toBeInstanceOf(UnauthorizedActionError)

    // Still exactly one row, still read — the refusal happened before the
    // already-read no-op, which is the order that makes « refused » and « had
    // nothing to do » different answers to the same call.
    const rows = await notificationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].lu).toBe(true)
    expectNoMail()
  })
})

/**
 * #355, observed through rows rather than through the resolver's return value:
 * the Assignataire is `DEMANDE_RETIREE`'s ONLY recipient — `EVENT_ROLE_MAP` is
 * empty for the event — so an inactive one means the dispatch writes nothing at
 * all. The pair of cases around it is what keeps this from passing vacuously.
 */
describe("an inactive Utilisateur named by the payload is not written a row", {
  timeout: TIMEOUT,
}, () => {
  it("DEMANDE_RETIREE writes nothing when the assignee is not active", async () => {
    expect(await theSeededUtilisateur(assigneInactif)).toMatchObject({
      actif: false,
    })

    await dispatch(
      "DEMANDE_RETIREE",
      payloadFor({ assigneAId: assigneInactif }),
      pgliteDb as never
    )

    expect(await notificationRows()).toHaveLength(0)
    expectNoMail()
  })

  it("DEMANDE_APPROBATION_FINALE writes nothing when the employee is not active", async () => {
    await dispatch(
      "DEMANDE_APPROBATION_FINALE",
      payloadFor({
        employe: { id: employeInactif, prenom: "Rena", nom: "Roux", departementId },
      }),
      pgliteDb as never
    )

    expect(await notificationRows()).toHaveLength(0)
    expectNoMail()
  })
})

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

/**
 * #311 — the two entries' different failure promises, proved from outside.
 *
 * Everything above reaches the module through its exported names and asserts
 * against a real database; these call the same names and assert the same way.
 * That is the point #310 bought and the reason they are written this way — the
 * promises are part of the interface now, so they have to be observable through
 * the interface.
 *
 * Both assertions are about ROWS. « The call threw » and « the call did not
 * throw » are about the call, not about the data, and a promise about what
 * survives a failure is only provable by looking at what survived.
 *
 * AC5 — the transition path — is NOT re-tested here. `appliquerEffets(tx, …)`
 * in `lib/demande/effets-transition.test.ts` already drives `dispatchRows`
 * through a real transaction against PGlite and asserts the audit row and the
 * notification rows together, which is the seam AC5 names: the module's own
 * entry, reached the way a DemandeDeplacement transition reaches it. Two
 * suites asserting one transition would be one seam tested twice and neither
 * better.
 */
describe("the two dispatch entries' failure promises", { timeout: TIMEOUT }, () => {
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

  /**
   * The promise the doc comment makes, on the one path that was breaking it.
   *
   * Resolving recipients is a real query, so it can fail — and it sat OUTSIDE
   * the settled work, which meant a failure there rejected `dispatch` outright.
   * The caller that matters is `markAsRead`, which has already written `lu`
   * inside its own transaction when it calls this: an exception here undid the
   * receipt, which is the one outcome this entry exists to prevent.
   *
   * The handle below refuses the recipient query and nothing else, so the
   * failure is exactly the one that used to escape.
   */
  it("dispatch reports a failing recipient query instead of throwing", async () => {
    const reported: Array<NotificationWriteError | NotificationMailError> = []
    const report: NotificationFailureReporter = (failure) => {
      reported.push(failure)
    }

    const broken = new Proxy(pgliteDb, {
      get(target, prop, receiver) {
        if (prop === "select") return () => {
          throw new Error("recipient query failed")
        }
        return Reflect.get(target, prop, receiver)
      },
    })

    await expect(
      dispatch("DEMANDE_SOUMISE", payloadFor(), broken as never, report)
    ).resolves.toBeUndefined()

    expect(reported).toHaveLength(1)
    expect(reported[0]).toBeInstanceOf(NotificationWriteError)
    // Nobody was named, because nobody was resolved — and saying so is more
    // useful than naming an arbitrary Utilisateur.
    expect(reported[0].message).toContain("recipient")
    expect(reported[0].cause).toMatchObject({ message: "recipient query failed" })
    // No row was written, because no recipient was ever found.
    expect(await notificationRows()).toHaveLength(0)
  })

  /**
   * A mail that could not be sent is not a Notification that was not written.
   *
   * Both happen inside the same `Promise.allSettled`, so reporting one as the
   * other was easy and would have sent an operator to look for rows that were
   * there all along. The two facts get separate classes so the report says which
   * one happened.
   *
   * ONE of the two mails fails and the other goes out, which is the shape that
   * makes the distinction observable: both rows exist, so « a row is missing »
   * is false for both recipients, and the one report that comes back has to be
   * about the mail or it is about nothing.
   */
  it("dispatch distinguishes a failed mail from a failed write", async () => {
    const reported: Array<NotificationWriteError | NotificationMailError> = []
    const report: NotificationFailureReporter = (failure) => {
      reported.push(failure)
    }

    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("smtp unreachable"))

    await expect(
      dispatch("DEMANDE_SOUMISE", payloadFor(), pgliteDb as never, report)
    ).resolves.toBeUndefined()

    // BOTH rows were written — that is the whole distinction — and neither
    // recipient is missing a Notification.
    expect(await notificationRows()).toHaveLength(2)
    expect(recipientsOf(await notificationRows())).toEqual(
      [managerA, managerB].sort()
    )
    // One report, and it is about the mail: an operator reading « the write
    // failed » here would go looking for rows that exist.
    expect(reported).toHaveLength(1)
    expect(reported[0]).toBeInstanceOf(NotificationMailError)
    expect(reported[0].message).toContain("not mailed")
    expect([managerA, managerB]).toContain(reported[0].utilisateurId)
  })
})
