import { eq, and, count } from "drizzle-orm"
import type { DrizzleDb } from "./prisma"
import { db } from "./prisma"
import { notifications } from "../db/schema/notifications"
import { utilisateurs } from "../db/schema/utilisateurs"
import { emailService } from "./email-service"
import { NotificationNotFoundError, UnauthorizedActionError } from "./errors"

export { NotificationNotFoundError } from "./errors"

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationEventType =
  | "DEMANDE_SOUMISE"
  | "DEMANDE_APPROBATION_MANAGER"
  | "DEMANDE_APPROBATION_FINANCE"
  | "DEMANDE_APPROBATION_FINALE"
  | "DEMANDE_REJETEE"
  | "DEMANDE_RETIREE"
  | "DEMANDE_NOTIFICATION_LUE"

export interface NotificationPayload {
  demandeId: string
  numero: string
  employe: {
    id: string
    prenom: string
    nom: string
    departementId?: string
  }
  assigneAId?: string | null
}

export type NotificationMessage = {
  titre: string
  message: string
  utilisateurId: string
  demandeId: string
}

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
        await emailService.send({
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

// ─── Recipient resolver: who should receive which event ──────────────────────

interface RoleTarget {
  role: "EMPLOYEE" | "MANAGER" | "FINANCE_ADMIN" | "GENERAL_DIRECTION"
  departmentScoped: boolean
}

const EVENT_ROLE_MAP: Record<NotificationEventType, RoleTarget[]> = {
  DEMANDE_SOUMISE: [{ role: "MANAGER", departmentScoped: true }],
  DEMANDE_APPROBATION_MANAGER: [{ role: "FINANCE_ADMIN", departmentScoped: false }],
  DEMANDE_APPROBATION_FINANCE: [{ role: "GENERAL_DIRECTION", departmentScoped: false }],
  DEMANDE_APPROBATION_FINALE: [],
  DEMANDE_REJETEE: [],
  DEMANDE_RETIREE: [],
  DEMANDE_NOTIFICATION_LUE: [{ role: "MANAGER", departmentScoped: true }],
}

const EMPLOYEE_EVENTS: NotificationEventType[] = [
  "DEMANDE_APPROBATION_FINALE",
  "DEMANDE_REJETEE",
]

const ASSIGNEE_EVENTS: NotificationEventType[] = ["DEMANDE_RETIREE"]

async function resolveRecipients(
  event: NotificationEventType,
  payload: NotificationPayload,
  _db: DrizzleDb
): Promise<string[]> {
  const ids = new Set<string>()

  const roleTargets = EVENT_ROLE_MAP[event]
  for (const target of roleTargets) {
    const conditions = [eq(utilisateurs.role, target.role), eq(utilisateurs.actif, true)]
    if (target.departmentScoped && payload.employe.departementId) {
      conditions.push(eq(utilisateurs.departementId, payload.employe.departementId))
    }
    if (target.departmentScoped && !payload.employe.departementId) continue

    const users = await _db
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(and(...conditions))
    users.forEach((u) => ids.add(u.id))
  }

  if (EMPLOYEE_EVENTS.includes(event)) {
    ids.add(payload.employe.id)
  }

  if (ASSIGNEE_EVENTS.includes(event) && payload.assigneAId) {
    ids.add(payload.assigneAId)
  }

  return Array.from(ids)
}

function buildMessage(
  event: NotificationEventType,
  payload: NotificationPayload
): { titre: string; message: string } {
  const { numero, employe } = payload
  const fullName = `${employe.prenom} ${employe.nom}`

  switch (event) {
    case "DEMANDE_SOUMISE":
      return {
        titre: "Nouvelle demande de déplacement",
        message: `${fullName} a soumis une demande de déplacement.`,
      }
    case "DEMANDE_APPROBATION_MANAGER":
      return {
        titre: "Demande approuvée par le manager",
        message: `La demande ${numero} de ${fullName} a été approuvée par le manager.`,
      }
    case "DEMANDE_APPROBATION_FINANCE":
      return {
        titre: "Demande approuvée par les finances",
        message: `La demande ${numero} de ${fullName} est en attente d'approbation finale.`,
      }
    case "DEMANDE_APPROBATION_FINALE":
      return {
        titre: "Demande approuvée",
        message: `Votre demande ${numero} a été approuvée.`,
      }
    case "DEMANDE_REJETEE":
      return {
        titre: "Demande rejetée",
        message:
          "Votre demande de déplacement a été rejetée. Consultez les commentaires pour plus de détails.",
      }
    case "DEMANDE_RETIREE":
      return {
        titre: "Demande retirée",
        message: `${fullName} a retiré la demande ${numero}.`,
      }
    case "DEMANDE_NOTIFICATION_LUE":
      return {
        titre: "Notification lue par l'employé",
        message: `${fullName} a lu la notification concernant la demande ${numero}.`,
      }
    default:
      const _exhaustive: never = event
      throw new Error(`Unknown event type: ${_exhaustive}`)
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
    const recipients = await resolveRecipients(event, payload, this._db)
    const { titre, message } = buildMessage(event, payload)

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