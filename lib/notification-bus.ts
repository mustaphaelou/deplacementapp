import { eq } from "drizzle-orm"
import type { DrizzleDb } from "../db"
import { db } from "../db"
import { notifications } from "../db/schema/notifications"
import { utilisateurs } from "../db/schema/utilisateurs"
import { emailSender } from "./email-sender"
import { NotificationNotFoundError, UnauthorizedActionError } from "./errors"
import type { NotificationEventType, NotificationPayload, NotificationMessage } from "./notification-events"
import { buildMessage, resolveRecipients } from "./notification/helpers"

export { NotificationNotFoundError } from "./errors"
export type { NotificationEventType, NotificationPayload, NotificationMessage } from "./notification-events"
export { EVENT_ROLE_MAP } from "./notification-events"

// ─── Adapter interface ─────────────────────────────────────────────────────

export interface AdapterResult {
  success: boolean
  error?: Error
}

export interface NotificationAdapter {
  send(notification: NotificationMessage): Promise<AdapterResult>
}

// ─── Default Drizzle adapter (the only production adapter for now) ──────────

class DrizzleNotificationAdapter implements NotificationAdapter {
  constructor(private _db: DrizzleDb) {}

  async send(notification: NotificationMessage): Promise<AdapterResult> {
    try {
      await this._db.insert(notifications).values({
        id: crypto.randomUUID(),
        utilisateurId: notification.utilisateurId,
        titre: notification.titre,
        message: notification.message,
        demandeId: notification.demandeId,
      })

      const [recipient] = await this._db
        .select({ email: utilisateurs.email, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
        .from(utilisateurs)
        .where(eq(utilisateurs.id, notification.utilisateurId))
        .limit(1)

      if (recipient?.email) {
        await emailSender.send({
          to: recipient.email,
          subject: notification.titre,
          text: notification.message,
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1e3a5f, #2d5a8e); padding: 24px; border-radius: 8px 8px 0 0;">
                <h2 style="color: #ffffff; margin: 0; font-size: 18px;">${notification.titre}</h2>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">${notification.message}</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">Cet email a été envoyé automatiquement par le système de gestion des déplacements.</p>
              </div>
            </div>
          `,
        })
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }
}

// ─── Dispatch result ─────────────────────────────────────────────────────

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

// ─── Notification Bus ─────────────────────────────────────────────────────

export class NotificationBus {
  constructor(
    private adapter: NotificationAdapter,
    private _db: DrizzleDb
  ) {}

  async dispatch(event: NotificationEventType, payload: NotificationPayload): Promise<DispatchResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recipients = await resolveRecipients(event, payload, this._db as any)
    const { titre, message } = buildMessage(event, payload.numero, payload.employe.prenom, payload.employe.nom)

    const results = await Promise.allSettled(
      recipients.map((utilisateurId) =>
        this.adapter.send({
          titre,
          message,
          utilisateurId,
          demandeId: payload.demandeId,
        })
      )
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

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this._db.query.notifications.findFirst({
      where: eq(notifications.id, notificationId),
      with: {
        utilisateur: { columns: { id: true, prenom: true, nom: true, role: true, departementId: true } },
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

// ─── Singleton ───────────────────────────────────────────────────────────────

const defaultAdapter = new DrizzleNotificationAdapter(db)
export const notificationBus = new NotificationBus(defaultAdapter, db)