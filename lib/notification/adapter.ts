import { eq } from "drizzle-orm"
import type { DrizzleDb } from "../../db"
import { notifications } from "../../db/schema/notifications"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { emailSender } from "../email-sender"
import type { NotificationMessage } from "../notification-events"

export interface AdapterResult {
  success: boolean
  error?: Error
}

export interface NotificationAdapter {
  send(notification: NotificationMessage): Promise<AdapterResult>
}

export class DrizzleNotificationAdapter implements NotificationAdapter {
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
      return { success: true }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }
}

export async function sendEmail(
  notification: NotificationMessage,
  db: DrizzleDb
): Promise<void> {
  const [recipient] = await db
    .select({
      email: utilisateurs.email,
      prenom: utilisateurs.prenom,
      nom: utilisateurs.nom,
    })
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
}
