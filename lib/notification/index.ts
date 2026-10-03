import { eq } from "drizzle-orm"
import type { DrizzleTransactionClient } from "../../db"
import { db } from "../../db"
import { DrizzleNotificationAdapter } from "./adapter"
import type { NotificationAdapter } from "./adapter"
import { sendEmail } from "./adapter"
import { buildNotificationMessage, resolveRecipients } from "./helpers"
import type {
  NotificationEventType,
  NotificationPayload,
} from "../notification-events"
import {
  NotificationNotFoundError,
  UnauthorizedActionError,
  reportServiceError,
} from "../errors"
import { notifications } from "../../db/schema/notifications"

export { NotificationNotFoundError, UnauthorizedActionError } from "../errors"
export type {
  NotificationEventType,
  NotificationPayload,
  NotificationMessage,
} from "../notification-events"
export type { NotificationAdapter, AdapterResult } from "./adapter"
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
 *
 * It also holds no dispatch result. The two entries make different promises
 * about failure — one refuses, one reports — so there is no single shape both
 * could return, and a shape only the tests read is a test asserting a shape.
 */
export class NotificationModule {
  constructor(private adapter: NotificationAdapter) {}

  /**
   * Writes one Notification row per recipient and mails them. **Best effort.**
   *
   * Each recipient is written on its own; a write that fails is reported
   * through the domain error handler, naming the recipient it failed for and
   * the cause it failed with (ADR-0002, ADR-0022), and this entry returns
   * normally. Work already recorded is never undone by work that failed — a
   * read receipt that has already been written must not disappear because a
   * mail server is down.
   *
   * When the caller's transaction is the whole write, and a partial
   * Notification set is not a Notification set, use
   * {@link NotificationModule.dispatchRowsAllOrNothing} instead.
   */
  async dispatchBestEffort(
    event: NotificationEventType,
    payload: NotificationPayload,
    tx: DrizzleTransactionClient
  ): Promise<void> {
    const recipients = await resolveRecipients(event, payload, tx)
    if (recipients.length === 0) return

    const results = await Promise.allSettled(
      recipients.map(async (utilisateurId) => {
        const msg = buildNotificationMessage(event, payload, utilisateurId)
        const adapterResult = await this.adapter.send(msg, tx)
        if (!adapterResult.success) {
          throw (
            adapterResult.error ?? new Error("Notification row write failed")
          )
        }
        await sendEmail(msg, tx)
      })
    )

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === "fulfilled") continue
      reportServiceError(
        new Error(
          `Notification ${event} non livrée à ${recipients[i]} : ${r.reason?.message ?? "raison inconnue"}`,
          { cause: r.reason }
        )
      )
    }
  }

  /**
   * Writes one Notification row per recipient and sends no mail. **All or
   * nothing.**
   *
   * The first failed write propagates, so the caller's transaction rolls back
   * and no partial set is left behind. The handle is required for the same
   * reason: the caller's transaction is what makes the set atomic, so a caller
   * must not be able to write these rows outside one while believing they were
   * inside it.
   */
  async dispatchRowsAllOrNothing(
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
      await this.dispatchBestEffort(
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
 * The module's public surface: three entries, each taking the handle it writes
 * through, and the two of them that write Notification rows naming their own
 * failure promise.
 *
 * The default lives here, in the free function that already imports `db`, and
 * not in the class — a class that defaults to a handle it captured is the
 * capture this ticket exists to remove. A caller holding a transaction passes
 * it and every write goes through it; a caller with no transaction to hand
 * (the read-receipt route) gets the module's own.
 */
const _default = new NotificationModule(new DrizzleNotificationAdapter())

/**
 * Writes a Notification row per recipient and mails them. **Best effort** — a
 * failed write is reported through the domain error handler and this resolves;
 * it never throws, because a read receipt that has already been recorded must
 * not be undone by a mail server that is down. Pass a handle to write inside
 * the caller's transaction; without one, the module's own `db` is used.
 */
export const dispatchBestEffort = (
  event: NotificationEventType,
  payload: NotificationPayload,
  tx: DrizzleTransactionClient = db
): Promise<void> => _default.dispatchBestEffort(event, payload, tx)

/**
 * Writes a Notification row per recipient, sends no mail, and **refuses on the
 * first failed write** so the caller's transaction rolls back. The handle is
 * required: this entry's promise is only true when the caller supplies the
 * transaction the write is atomic in.
 */
export const dispatchRowsAllOrNothing = (
  event: NotificationEventType,
  payload: NotificationPayload,
  tx: DrizzleTransactionClient
): Promise<void> => _default.dispatchRowsAllOrNothing(event, payload, tx)

export const markAsRead = (
  notificationId: string,
  userId: string,
  tx: DrizzleTransactionClient = db
): Promise<void> => _default.markAsRead(notificationId, userId, tx)
