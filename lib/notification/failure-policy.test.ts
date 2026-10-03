/**
 * #311 — the two entries' different failure promises, at the interface.
 *
 * The module writes Notification rows through two entries that agree on the
 * rows and disagree on what a failure means:
 *
 * - `dispatchRowsAllOrNothing` writes through the caller's transaction and
 *   REFUSES on the first failed write, so the caller's transaction rolls back:
 *   the caller's transaction is what makes the set atomic, and a partial
 *   Notification set is not a Notification set.
 * - `dispatchBestEffort` writes each recipient on its own and REPORTS a failed
 *   one through the domain error handler instead of throwing, because a read
 *   receipt that has already been recorded must not be undone by a mail server
 *   that is down.
 *
 * Before this ticket that difference was only visible by reading the class and
 * its call sites together, and it was carried by a result type no production
 * caller read. It is now two assertions on the exported names, against a real
 * in-process Postgres (ADR-0006), and the result type is gone.
 *
 * ## Why the failing write is injected at the adapter seam
 *
 * The failure is injected at the adapter — the module's own collaborator seam,
 * which ADR-0010 keeps — rather than provoked by breaking a database
 * constraint. A real constraint violation inside a transaction ABORTS it, and
 * Postgres then rolls it back whatever the caller does with the error: a test
 * that provoked one would see no surviving rows even if the module swallowed
 * the failure outright, so « the transaction rolled back » would be a fact
 * about Postgres, not about this module. Injecting the refusal keeps the
 * transaction healthy, which means every row missing afterwards was lost
 * because the module propagated the failure and the caller rolled back —
 * which is the promise under test.
 *
 * Every write that is not the injected one goes to the real adapter and real
 * SQL, so the rows these tests count were really written.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest"
import { eq, sql } from "drizzle-orm"
import * as schema from "../../db/schema"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { dispatchBestEffort, dispatchRowsAllOrNothing } from "./index"
import { DrizzleNotificationAdapter } from "./adapter"
import { emailSender } from "../email-sender"

vi.mock("../email-sender", () => ({
  emailSender: { send: vi.fn() },
}))

const TIMEOUT = 30_000
const REFUSAL = "notifications row write refused"

/** Captured before any spy replaces it: the writes that really reach SQL. */
const realSend = DrizzleNotificationAdapter.prototype.send

interface WriteAttempt {
  utilisateurId: string
  written: boolean
}

/**
 * Let the first recipient's row really be written, refuse the second one, and
 * hand back the log of what was attempted.
 *
 * Failing the SECOND attempt rather than a named Utilisateur makes the
 * interesting order the only order: one row is really in the caller's
 * transaction when the refusal arrives, whichever Utilisateur the resolver put
 * first. Failing a named one would leave the test passing for the wrong reason
 * whenever that Utilisateur happened to come first and nothing had been
 * written yet.
 */
function failTheSecondWrite() {
  const attempts: WriteAttempt[] = []
  vi.spyOn(DrizzleNotificationAdapter.prototype, "send").mockImplementation(
    async function (this: DrizzleNotificationAdapter, message, handle) {
      if (attempts.length === 1) {
        attempts.push({ utilisateurId: message.utilisateurId, written: false })
        return { success: false, error: new Error(REFUSAL) }
      }
      attempts.push({ utilisateurId: message.utilisateurId, written: true })
      return realSend.call(this, message, handle)
    }
  )
  return attempts
}

describe(
  "the Notification module's two failure promises",
  { timeout: TIMEOUT },
  () => {
    let pgliteDb: PgliteDb
    let societeId: string
    let departementId: string
    let employeeId: string
    let readDemandeId: string
    /** The seeded MANAGERs' emails, by Utilisateur id. */
    const managerEmails = new Map<string, string>()

    const payload = (demandeId: string) => ({
      demandeId,
      numero: "DD-2026-0001",
      employe: {
        id: employeeId,
        prenom: "Jean",
        nom: "Dupont",
        departementId,
      },
    })

    const demandeRow = (id: string, numero: string) => ({
      id,
      numero,
      employeId: employeeId,
      employeNom: "Dupont",
      employePrenom: "Jean",
      employePoste: "Developpeur",
      employeDepartement: "Test Departement",
      etape: "MANAGER_REVIEW" as const,
      decision: "PENDING" as const,
      motif: JSON.stringify(["mission"]),
      dateDepart: new Date("2026-08-01"),
      dateRetour: new Date("2026-08-03"),
      destination: "Casablanca",
      typeTransport: "VOITURE_PERSONNELLE" as const,
      modifieLe: new Date(),
    })

    beforeAll(async () => {
      pgliteDb = await createPgliteDb()

      societeId = crypto.randomUUID()
      departementId = crypto.randomUUID()
      employeeId = crypto.randomUUID()
      readDemandeId = crypto.randomUUID()

      await pgliteDb.insert(schema.societes).values({
        id: societeId,
        nom: "Test Societe",
        modifieLe: new Date(),
      })

      await pgliteDb.insert(schema.departements).values({
        id: departementId,
        nom: "Test Departement",
        societeId,
      })

      // One EMPLOYEE (who submits) and two MANAGERs of that Departement (who are
      // notified): two recipients, so a failure of one write leaves the question
      // « what happens to the other? » open.
      await pgliteDb.insert(schema.utilisateurs).values([
        {
          id: employeeId,
          email: "employee@test.com",
          nom: "Dupont",
          prenom: "Jean",
          poste: "Developpeur",
          role: "EMPLOYEE",
          departementId,
          societeId,
          actif: true,
          modifieLe: new Date(),
        },
        ...["one", "two"].map((suffix) => {
          const id = crypto.randomUUID()
          const email = `manager-${suffix}@test.com`
          managerEmails.set(id, email)
          return {
            id,
            email,
            nom: "Martin",
            prenom: "Sophie",
            poste: "Chef d'equipe",
            role: "MANAGER" as const,
            departementId,
            societeId,
            actif: true,
            modifieLe: new Date(),
          }
        }),
      ])

      await pgliteDb
        .insert(schema.demandesDeplacement)
        .values(demandeRow(readDemandeId, "DD-2026-0001"))
    })

    // Every line this run's reports reached the server log, captured rather
    // than swallowed, so a test can assert that a failure was actually
    // recorded and not merely that a function was entered.
    let logged: unknown[][] = []

    beforeEach(async () => {
      vi.restoreAllMocks()
      await pgliteDb.execute(sql`DELETE FROM notifications`)
      logged = []
      vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        logged.push(args)
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    // The all-or-nothing promise, from outside the class: the refusal reaches
    // the caller, and the rows the caller had already written in that
    // transaction — its own row and the Notification row this module wrote — are
    // gone afterwards.
    it("dispatchRowsAllOrNothing refuses a failed write and leaves the caller's transaction empty", async () => {
      const attempts = failTheSecondWrite()
      const demandeId = crypto.randomUUID()

      await expect(
        pgliteDb.transaction(async (tx) => {
          // The row the transition itself writes, before it asks for the
          // Notification rows.
          await tx
            .insert(schema.demandesDeplacement)
            .values(demandeRow(demandeId, "DD-2026-9999"))

          await dispatchRowsAllOrNothing(
            "DEMANDE_SOUMISE",
            payload(demandeId),
            tx as any
          )
        })
      ).rejects.toThrow(REFUSAL)

      // Not vacuous: one Notification row really was written through the
      // caller's transaction before the refusal arrived, and one write really
      // failed. Both went through this module's exported name.
      expect(attempts).toHaveLength(2)
      expect(attempts.filter((a) => a.written)).toHaveLength(1)
      expect(attempts.filter((a) => !a.written)).toHaveLength(1)

      const transitionRows = await pgliteDb
        .select()
        .from(schema.demandesDeplacement)
        .where(eq(schema.demandesDeplacement.id, demandeId))
      expect(transitionRows).toHaveLength(0)

      const notificationRows = await pgliteDb
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.demandeId, demandeId))
      expect(notificationRows).toHaveLength(0)
    })

    // The best-effort promise, from outside the class: the write that succeeded
    // is still there, and the failure was reported instead of thrown.
    it("dispatchBestEffort reports a failed write through the domain error handler and does not throw", async () => {
      const attempts = failTheSecondWrite()

      await expect(
        dispatchBestEffort(
          "DEMANDE_SOUMISE",
          payload(readDemandeId),
          pgliteDb as any
        )
      ).resolves.toBeUndefined()

      // The half of the promise that is about work already done: the recipient
      // whose write succeeded is still notified, in the database.
      const rows = await pgliteDb.select().from(schema.notifications)
      expect(rows).toHaveLength(1)
      const written = attempts.find((a) => a.written)
      const refused = attempts.find((a) => !a.written)
      expect(rows[0].utilisateurId).toBe(written?.utilisateurId)
      expect(written?.utilisateurId).not.toBe(refused?.utilisateurId)
      // ...and only that recipient was mailed: the refused one has no row to
      // announce, so nothing is sent on its behalf.
      expect(emailSender.send).toHaveBeenCalledTimes(1)
      expect(
        (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][0].to
      ).toBe(managerEmails.get(written?.utilisateurId as string))

      // The other half: the failure was reported, and the report names the
      // recipient it failed for and the cause it failed with (ADR-0022).
      //
      // Asserted on the log line the failure actually produces, NOT on a count
      // of calls to a function whose return value this module discards. The
      // first version of this test spied on `handleServiceError` and counted
      // calls; that passed with the logging deleted, because a spy on a call
      // whose result is thrown away cannot see whether anything was recorded.
      expect(logged).toHaveLength(1)
      const [label, reported] = logged[0]
      expect(label).toBe("Service error:")
      const failure = reported as Error
      expect(failure.message).toContain(refused?.utilisateurId as string)
      expect(failure.message).toContain(REFUSAL)
      expect((failure as Error & { cause?: Error }).cause?.message).toBe(
        REFUSAL
      )
    })
  }
)
