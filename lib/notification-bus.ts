import type { PrismaClient, Role } from "@prisma/client"
import { prisma } from "./prisma"

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationEventType =
  | "DEMANDE_SOUMISE"
  | "DEMANDE_APPAROUM_MANAGERIAL"
  | "DEMANDE_APPAROUM_FINANCE"
  | "DEMANDE_APPAROUM_FINALE"
  | "DEMANDE_REJETEE"
  | "DEMANDE_RETIREE"

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

export interface NotificationAdapter {
  /** Persist a single notification. Must throw on failure so the caller can decide to rollback. */
  send(notification: NotificationMessage): Promise<void>
}

// ─── Default Prisma adapter (the only production adapter for now) ──────────

class PrismaNotificationAdapter implements NotificationAdapter {
  constructor(private db: PrismaClient) {}

  async send(notification: NotificationMessage): Promise<void> {
    await this.db.notification.create({
      data: {
        utilisateurId: notification.utilisateurId,
        titre: notification.titre,
        message: notification.message,
        demandeId: notification.demandeId,
      },
    })
  }
}

// ─── Recipient resolver: who should receive which event ──────────────────────

// Map each event to the roles that should be notified.
const EVENT_ROLE_MAP: Record<NotificationEventType, Role[]> = {
  DEMANDE_SOUMISE: ["MANAGER"],
  DEMANDE_APPAROUM_MANAGERIAL: ["FINANCE_ADMIN"],
  DEMANDE_APPAROUM_FINANCE: ["GENERAL_DIRECTION"],
  DEMANDE_APPAROUM_FINALE: [],
  DEMANDE_REJETEE: [],
  DEMANDE_RETIREE: [],
}

// Events that go to the employee who owns the request.
const EMPLOYEE_EVENTS: NotificationEventType[] = [
  "DEMANDE_APPAROUM_FINALE",
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

  // 1. Role-based recipients
  const roles = EVENT_ROLE_MAP[event]
  if (roles && roles.length > 0) {
    const users = await db.utilisateur.findMany({
      where: { role: { in: roles }, actif: true },
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
    case "DEMANDE_APPAROUM_MANAGERIAL":
      return {
        titre: "Demande approuvée par le manager",
        message: `La demande ${numero} de ${fullName} a été approuvée par le manager.`,
      }
    case "DEMANDE_APPAROUM_FINANCE":
      return {
        titre: "Demande approuvée par les finances",
        message: `La demande ${numero} de ${fullName} est en attente d'approbation finale.`,
      }
    case "DEMANDE_APPAROUM_FINALE":
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
    default:
      // exhaustive check
      const _exhaustive: never = event
      throw new Error(`Unknown event type: ${_exhaustive}`)
  }
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

  async dispatch(event: NotificationEventType, payload: NotificationPayload): Promise<void> {
    const recipients = await resolveRecipients(event, payload, this.db)
    const { titre, message } = buildMessage(event, payload)

    // If any notification fails, we throw so the caller (e.g. an approval
    // transaction) can decide to rollback.
    await Promise.all(
      recipients.map((utilisateurId) =>
        this.adapter.send({
          titre,
          message,
          utilisateurId,
          demandeId: payload.demandeId,
        })
      )
    )
  }
}

// ─── Singleton for use in route handlers ───────────────────────────────────

const defaultAdapter = new PrismaNotificationAdapter(prisma)
export const notificationBus = new NotificationBus(defaultAdapter, prisma)
