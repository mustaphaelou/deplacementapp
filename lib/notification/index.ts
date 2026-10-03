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
import { NotificationNotFoundError, UnauthorizedActionError } from "../errors"
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

export interface DispatchFailure {
  utilisateurId: string
  error: string
}

export interface DispatchResult {
  total: number
  succeeded: number
  failed: number
  failures: DispatchFailure[]
}

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

  async dispatch(
    event: NotificationEventType,
    payload: NotificationPayload,
    tx: DrizzleTransactionClient
  ): Promise<DispatchResult> {
    const recipients = await resolveRecipients(event, payload, tx)

    const results = await Promise.allSettled(
      recipients.map(async (utilisateurId) => {
        const msg = buildNotificationMessage(event, payload, utilisateurId)
        const adapterResult = await this.adapter.send(msg, tx)
        if (adapterResult.success) {
          await sendEmail(msg, tx)
        }
        return adapterResult
      })
    )

    const failures: DispatchFailure[] = []
    let succeeded = 0
    let failed = 0

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === "fulfilled" && r.value.success) {
        succeeded++
      } else {
        failed++
        const error =
          r.status === "fulfilled"
            ? (r.value.error?.message ?? "Unknown adapter error")
            : (r.reason?.message ?? "Unknown rejection")
        failures.push({ utilisateurId: recipients[i], error })
      }
    }

    return { total: recipients.length, succeeded, failed, failures }
  }

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
 */
const _default = new NotificationModule(new DrizzleNotificationAdapter())
export const dispatch = (
  event: NotificationEventType,
  payload: NotificationPayload,
  tx: DrizzleTransactionClient = db
) => _default.dispatch(event, payload, tx)
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
