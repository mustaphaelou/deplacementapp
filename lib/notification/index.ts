import { eq } from "drizzle-orm"
import type { DrizzleDb, DrizzleTransactionClient } from "../../db"
import { db } from "../../db"
import { DrizzleNotificationAdapter } from "./adapter"
import type { NotificationAdapter, AdapterResult } from "./adapter"
import { sendEmail } from "./adapter"
import { buildMessage, resolveRecipients } from "./helpers"
import { listForUser, countUnread } from "./queries"
import type {
  NotificationEventType,
  NotificationPayload,
  NotificationMessage,
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

export class NotificationModule {
  constructor(
    private adapter: NotificationAdapter,
    private _db: DrizzleDb
  ) {}

  async dispatch(
    event: NotificationEventType,
    payload: NotificationPayload
  ): Promise<DispatchResult> {
    const recipients = await resolveRecipients(event, payload, this._db)
    const { titre, message } = buildMessage(
      event,
      payload.numero,
      payload.employe.prenom,
      payload.employe.nom
    )

    const results = await Promise.allSettled(
      recipients.map(async (utilisateurId) => {
        const msg: NotificationMessage = {
          titre,
          message,
          utilisateurId,
          demandeId: payload.demandeId,
        }
        const adapterResult = await this.adapter.send(msg, this._db)
        if (adapterResult.success) {
          await sendEmail(msg, this._db)
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

    const { titre, message } = buildMessage(
      event,
      payload.numero,
      payload.employe.prenom,
      payload.employe.nom
    )

    for (const utilisateurId of recipients) {
      const msg: NotificationMessage = {
        titre,
        message,
        utilisateurId,
        demandeId: payload.demandeId,
      }
      const adapterResult = await this.adapter.send(msg, tx)
      if (!adapterResult.success) {
        throw adapterResult.error ?? new Error("Notification row write failed")
      }
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this._db.query.notifications.findFirst({
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

    await this._db
      .update(notifications)
      .set({ lu: true })
      .where(eq(notifications.id, notificationId))

    if (notification.utilisateur.role === "EMPLOYEE" && notification.demande) {
      await this.dispatch("DEMANDE_NOTIFICATION_LUE", {
        demandeId: notification.demande.id,
        numero: notification.demande.numero,
        employe: {
          id: notification.utilisateur.id,
          prenom: notification.utilisateur.prenom,
          nom: notification.utilisateur.nom,
          departementId: notification.utilisateur.departementId,
        },
      })
    }
  }
}

const _default = new NotificationModule(new DrizzleNotificationAdapter(), db)
export const dispatch = _default.dispatch.bind(_default)
export const dispatchRows = _default.dispatchRows.bind(_default)
export const markAsRead = _default.markAsRead.bind(_default)
