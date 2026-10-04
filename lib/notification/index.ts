import { eq } from "drizzle-orm"
import type { DrizzleTransactionClient } from "../../db"
import { db } from "../../db"
import { DrizzleNotificationAdapter } from "./adapter"
import type { NotificationAdapter } from "./adapter"
import { sendEmail } from "./adapter"
import { buildNotificationMessage, resolveRecipients } from "./helpers"
import {
  NotificationMailError,
  NotificationWriteError,
  reportNotificationFailure,
} from "./dispatch-failure"
import type { NotificationFailureReporter } from "./dispatch-failure"
import type {
  NotificationEventType,
  NotificationPayload,
} from "../notification-events"
import { NotificationNotFoundError, UnauthorizedActionError } from "../errors"
import { notifications } from "../../db/schema/notifications"

export { NotificationNotFoundError, UnauthorizedActionError } from "../errors"
// Re-exported so the module's whole failure vocabulary reaches a caller through
// one import; declared in `lib/errors.ts` per ADR-0002.
export {
  NotificationMailError,
  NotificationWriteError,
} from "../errors"
export type {
  NotificationEventType,
  NotificationPayload,
  NotificationMessage,
} from "../notification-events"
export type { NotificationAdapter } from "./adapter"
export type { NotificationFailureReporter } from "./dispatch-failure"
export { EVENT_ROLE_MAP } from "../notification-events"
export { listForUser, countUnread } from "./queries"

/**
 * Every write the module performs goes through the handle it is given.
 *
 * The class holds the adapter and nothing else: no database handle, because a
 * captured handle can only ever be the one the module was built with, and the
 * caller who holds a transaction has no way to hand it over. Both entry points
 * take a handle per call instead, so a caller can write Notification rows in
 * the same transaction as the DemandeDeplacement transition that produced them.
 */
export class NotificationModule {
  constructor(private adapter: NotificationAdapter) {}

  /**
   * Best-effort: writes what it can and reports what it could not, and never
   * throws.
   *
   * The caller reaches this entry holding something already recorded — the
   * `lu` a read receipt just set, inside the caller's own transaction — so an
   * exception here would undo it. Every failure therefore leaves through
   * `reportFailure`, INCLUDING the ones that used to escape: resolving
   * recipients runs a query and can fail before any row is attempted.
   *
   * The reporter is a parameter for the reason the handle is one: a reporter
   * captured at construction could only ever be the one the module was built
   * with, which is a seam no caller can reach.
   *
   * Nothing is returned. A tally of who was told what is a shape, and the
   * module's whole reporting duty is the one thing the report says.
   *
   * How this differs from `dispatchRows`, and why neither can stand in for the
   * other, is argued once — at the exported `dispatch`, below.
   */
  async dispatch(
    event: NotificationEventType,
    payload: NotificationPayload,
    tx: DrizzleTransactionClient,
    reportFailure: NotificationFailureReporter = reportNotificationFailure
  ): Promise<void> {
    // Resolving recipients is inside the promise on purpose. It runs a real
    // query, so it can fail like any other write, and if it threw out of here
    // the caller — the read-receipt path, which has already written `lu` inside
    // its own transaction — would lose the receipt to a query that failed
    // before a single Notification row was attempted. That is precisely the
    // outcome this entry exists to prevent, so a failure to resolve is
    // reported like any other: nobody is notified, and saying so is the whole
    // of what this entry owes its caller.
    let recipients: string[]
    try {
      recipients = await resolveRecipients(event, payload, tx)
    } catch (cause) {
      reportFailure(
        new NotificationWriteError(
          `every ${event} recipient could not be resolved`,
          cause
        )
      )
      return
    }

    const results = await Promise.allSettled(
      recipients.map(async (utilisateurId) => {
        const msg = buildNotificationMessage(event, payload, utilisateurId)
        const adapterResult = await this.adapter.send(msg, tx)
        if (!adapterResult.success) return adapterResult

        // The mail is a SECOND step, and its failure is not the same fact as a
        // failed row. Reporting a transport outage as « the Notification was not
        // written » would send an operator looking at rows that exist and an
        // in-app Notification that was delivered. So the two are kept apart: the
        // row's failure comes back as the adapter's own answer, and a mail
        // failure comes back as its own outcome with the row already written.
        try {
          await sendEmail(msg, tx)
        } catch (cause) {
          return { success: true as const, error: cause, mailed: false }
        }
        return { success: true as const }
      })
    )

    for (let i = 0; i < results.length; i++) {
      const result = results[i]

      if (result.status === "rejected") {
        reportFailure(
          new NotificationWriteError(
            recipients[i],
            result.reason ?? new Error("Notification write rejected")
          )
        )
        continue
      }

      // A row that could not be written. The Utilisateur is named because the
      // report's question is « whose Notification is missing ».
      if (!result.value.success) {
        reportFailure(
          new NotificationWriteError(
            recipients[i],
            result.value.error ?? new Error("Notification write failed")
          )
        )
        continue
      }

      // The row is there and the mail did not go. Same entry, same status, but
      // the message says what actually happened — the Notification was written
      // and only its mail was lost.
      if ("mailed" in result.value && result.value.mailed === false) {
        reportFailure(
          new NotificationMailError(recipients[i], result.value.error)
        )
      }
    }
  }

  /**
   * All-or-nothing: the first failed write throws.
   *
   * The throw is the whole report. There is no channel for it to leave by
   * because the caller has one place to act on the failure and that place is
   * deciding not to commit: its transaction is what makes the set atomic, so
   * the rows written before the failure go with it.
   *
   * Contrast with `dispatch` is at the exported `dispatch`, below.
   */
  async dispatchRows(
    event: NotificationEventType,
    payload: NotificationPayload,
    tx: DrizzleTransactionClient
  ): Promise<void> {
    const recipients = await resolveRecipients(event, payload, tx)
    if (recipients.length === 0) return

    for (const utilisateurId of recipients) {
      const msg = buildNotificationMessage(event, payload, utilisateurId)
      const adapterResult = await this.adapter.send(msg, tx)
      if (!adapterResult.success) {
        throw adapterResult.error ?? new Error("Notification row write failed")
      }
    }
  }

  /**
   * Marks a Notification read, and — for the Employé who owns it — tells the
   * department's managers it was read.
   *
   * The handle is a parameter for the same reason as on the other two entry
   * points: the read, the `lu` write and the read-receipt dispatch all go
   * through the handle the caller hands over, so all three are one unit of
   * work. The default export supplies the module's own `db` for the route that
   * has no transaction to hand.
   */
  async markAsRead(
    notificationId: string,
    userId: string,
    tx: DrizzleTransactionClient
  ): Promise<void> {
    const notification = await tx.query.notifications.findFirst({
      where: eq(notifications.id, notificationId),
      with: {
        utilisateur: {
          columns: {
            id: true,
            prenom: true,
            nom: true,
            role: true,
            departementId: true,
          },
        },
        demande: { columns: { id: true, numero: true } },
      },
    })

    if (!notification) {
      throw new NotificationNotFoundError()
    }

    if (notification.utilisateurId !== userId) {
      throw new UnauthorizedActionError("Non autorisé")
    }

    if (notification.lu) {
      return
    }

    await tx
      .update(notifications)
      .set({ lu: true })
      .where(eq(notifications.id, notificationId))

    if (notification.utilisateur.role === "EMPLOYEE" && notification.demande) {
      await this.dispatch(
        "DEMANDE_NOTIFICATION_LUE",
        {
          demandeId: notification.demande.id,
          numero: notification.demande.numero,
          employe: {
            id: notification.utilisateur.id,
            prenom: notification.utilisateur.prenom,
            nom: notification.utilisateur.nom,
            departementId: notification.utilisateur.departementId,
          },
        },
        tx
      )
    }
  }
}

/**
 * The module's public surface: the same three entries, each defaulting to the
 * module's own `db` so the existing call sites are unchanged.
 *
 * The default lives here, in the free function that already imports `db`, and
 * not in the class — a class that defaults to a handle it captured is the
 * capture this ticket exists to remove. A caller holding a transaction passes
 * it and every write goes through it; a caller with no transaction to hand
 * (the read-receipt route) gets the module's own.
 *
 * The two dispatch entries make different promises about failure, and the
 * signatures are where a reader learns it rather than having to infer it from
 * the bodies:
 *
 * - `dispatchRows(event, payload, tx)` — ALL-OR-NOTHING. The first failed write
 *   throws and the caller's transaction rolls the whole write back, the
 *   transition's own rows included. It reports by refusing, and it takes no
 *   reporting channel because it has nothing to report to.
 * - `dispatch(event, payload, tx?, reportFailure?)` — BEST-EFFORT. It never
 *   throws; it hands each failed write to `reportFailure` as a
 *   `NotificationWriteError` carrying the failing Utilisateur and the cause.
 *   The channel is a parameter precisely so a caller can observe it and
 *   production can send it wherever reporting goes.
 *
 * Neither can stand in for the other. `dispatchRows` inside a read-receipt
 * would undo the receipt; `dispatch` inside a DemandeDeplacement transition
 * would let a half-applied transition commit.
 */
const _default = new NotificationModule(new DrizzleNotificationAdapter())
export const dispatch = (
  event: NotificationEventType,
  payload: NotificationPayload,
  tx: DrizzleTransactionClient = db,
  reportFailure: NotificationFailureReporter = reportNotificationFailure
) => _default.dispatch(event, payload, tx, reportFailure)
export const dispatchRows = (
  event: NotificationEventType,
  payload: NotificationPayload,
  tx: DrizzleTransactionClient
) => _default.dispatchRows(event, payload, tx)
export const markAsRead = (
  notificationId: string,
  userId: string,
  tx: DrizzleTransactionClient = db
) => _default.markAsRead(notificationId, userId, tx)
