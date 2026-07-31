import { eq, and } from "drizzle-orm"
import type { DrizzleTransactionClient } from "../../db"
import { utilisateurs } from "../../db/schema/utilisateurs"
import type {
  NotificationEventType,
  NotificationPayload,
} from "../notification-events"
import { EVENT_ROLE_MAP } from "../notification-events"

export function buildMessage(
  event: NotificationEventType,
  numero: string,
  prenom: string,
  nom: string
): { titre: string; message: string } {
  const fullName = `${prenom} ${nom}`
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
    default: {
      const _exhaustive: never = event
      throw new Error(`Unknown event type: ${_exhaustive}`)
    }
  }
}

const EMPLOYEE_EVENTS: NotificationEventType[] = [
  "DEMANDE_APPROBATION_FINALE",
  "DEMANDE_REJETEE",
]

const ASSIGNEE_EVENTS: NotificationEventType[] = ["DEMANDE_RETIREE"]

export async function resolveRecipients(
  event: NotificationEventType,
  payload: NotificationPayload,
  tx: DrizzleTransactionClient
): Promise<string[]> {
  const ids = new Set<string>()

  const roleTargets = EVENT_ROLE_MAP[event]
  for (const target of roleTargets) {
    const conditions = [
      eq(utilisateurs.role, target.role),
      eq(utilisateurs.actif, true),
    ]
    if (target.departmentScoped) {
      if (!payload.employe.departementId) continue
      conditions.push(
        eq(utilisateurs.departementId, payload.employe.departementId)
      )
    }

    const users = await tx
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
