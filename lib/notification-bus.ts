import type { PrismaClient, Role } from "@prisma/client"
import { prisma } from "./prisma"
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
  /** Demande identifier */
  demandeId: string
  /** Human readable request number */
  numero: string
  /** Employee who initiated the request */
  employe: {
    id: string
    prenom: string
    nom: string
    /** Department ID — required for read-receipt routing */
    departementId?: string
  }
  /** Optional: the assigned approver (for withdraw notifications) */
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
  /** Persist a single notification. Returns result so the caller can aggregate. */
  send(notification: NotificationMessage): Promise<AdapterResult>
}

// ─── Default Prisma adapter (the only production adapter for now) ──────────

class PrismaNotificationAdapter implements NotificationAdapter {
  constructor(private db: PrismaClient) {}

  async send(notification: NotificationMessage): Promise<AdapterResult> {
    try {
      // 1. Persist in-app notification
      await this.db.notification.create({
        data: {
          utilisateurId: notification.utilisateurId,
          titre: notification.titre,
          message: notification.message,
          demandeId: notification.demandeId,
        },
      })

      // 2. Send email (best-effort — failures are logged but don't fail the notification)
      const recipient = await this.db.utilisateur.findUnique({
        where: { id: notification.utilisateurId },
        select: { email: true, prenom: true, nom: true },
      })

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

// Map each event to the roles that should be notified.
// `departmentScoped: true` restricts to the employee's department.
interface RoleTarget {
  role: Role
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

// Events that go to the employee who owns the request.
const EMPLOYEE_EVENTS: NotificationEventType[] = [
  "DEMANDE_APPROBATION_FINALE",
  "DEMANDE_REJETEE",
]

// Events that go to the assignee (for withdraw).
const ASSIGNEE_EVENTS: NotificationEventType[] = ["DEMANDE_RETIREE"]

async function resolveRecipients(
  event: NotificationEventType,
  payload: NotificationPayload,
  db: PrismaClient
): Promise<string[]> {
  const ids = new Set<string>()

  // 1. Role-based recipients (department-scoped or org-wide)
  const roleTargets = EVENT_ROLE_MAP[event]
  for (const target of roleTargets) {
    const where: { role: Role; actif: boolean; departementId?: string } = {
      role: target.role,
      actif: true,
    }
    if (target.departmentScoped && payload.employe.departementId) {
      where.departementId = payload.employe.departementId
    }
    // Skip department-scoped lookups when no departementId is available
    if (target.departmentScoped && !payload.employe.departementId) continue

    const users = await db.utilisateur.findMany({
      where,
      select: { id: true },
    })
    users.forEach((u) => ids.add(u.id))
  }

  // 2. Specific employee (for final approval / reject)
  if (EMPLOYEE_EVENTS.includes(event)) {
    ids.add(payload.employe.id)
  }

  // 3. Assignee (for withdraw)
  if (ASSIGNEE_EVENTS.includes(event) && payload.assigneAId) {
    ids.add(payload.assigneAId)
  }

  return Array.from(ids)
}

// ─── Message builder: how each event is phrased ────────────────────────────

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
      // exhaustive check
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

// ─── Notification Bus (the deep module) ─────────────────────────────────────

/**
 * The NotificationBus is the single interface for dispatching domain events to
 * users.  It owns:
 *  - which events exist
 *  - who receives each event
 *  - how the message is phrased
 *  - how the notification is persisted (via the adapter)
 *
 * Callers only need to know the event type and payload.  All the rest is hidden
 * behind this module.
 */
export class NotificationBus {
  constructor(
    private adapter: NotificationAdapter,
    private db: PrismaClient
  ) {}

  async dispatch(event: NotificationEventType, payload: NotificationPayload): Promise<DispatchResult> {
    const recipients = await resolveRecipients(event, payload, this.db)
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

  /**
   * Mark a notification as read (lu) and, if the reader is an EMPLOYEE,
   * dispatch a DEMANDE_NOTIFICATION_LUE event to the managers of the
   * employee's department (AccuseLecture / read receipt).
   *
   * The bus owns the ownership check: the notifier must exist and must belong
   * to the requesting Utilisateur. Throws `NotificationNotFoundError` (404)
   * when the notification is missing and `UnauthorizedActionError("Non autorisé")`
   * (403) when the requester is not the owner.
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.db.notification.findUnique({
      where: { id: notificationId },
      include: {
        utilisateur: { select: { id: true, prenom: true, nom: true, role: true, departementId: true } },
        demande: { select: { id: true, numero: true } },
      },
    })

    if (!notification) {
      throw new NotificationNotFoundError()
    }

    // Ownership check: the requester must be the notification's recipient.
    if (notification.utilisateurId !== userId) {
      throw new UnauthorizedActionError("Non autorisé")
    }

    // Guard: already read — no-op
    if (notification.lu) {
      return
    }

    // Mark as read
    await this.db.notification.update({
      where: { id: notificationId },
      data: { lu: true },
    })

    // Dispatch read receipt only when the reader is an EMPLOYEE
    // and the notification is linked to a demande
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

// ─── Singleton for use in route handlers ───────────────────────────────────

const defaultAdapter = new PrismaNotificationAdapter(prisma)
export const notificationBus = new NotificationBus(defaultAdapter, prisma)
