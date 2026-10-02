import { eq, and } from "drizzle-orm"
import type { DrizzleTransactionClient } from "../../db"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { conditionActif } from "../utilisateur-service"
import type {
  NotificationEventType,
  NotificationMessage,
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

export function buildNotificationMessage(
  event: NotificationEventType,
  payload: NotificationPayload,
  utilisateurId: string
): NotificationMessage {
  const { titre, message } = buildMessage(
    event,
    payload.numero,
    payload.employe.prenom,
    payload.employe.nom
  )
  return { titre, message, utilisateurId, demandeId: payload.demandeId }
}

const EMPLOYEE_EVENTS: NotificationEventType[] = [
  "DEMANDE_APPROBATION_FINALE",
  "DEMANDE_REJETEE",
]

const ASSIGNEE_EVENTS: NotificationEventType[] = ["DEMANDE_RETIREE"]

/**
 * The Utilisateurs a Notification event goes to.
 *
 * A SET is being filtered here, so the activity rule is composed into the
 * query rather than asked per candidate: asking `peutAgir` once per row would
 * turn one query into one-per-manager. The rule itself is still the Utilisateur
 * module's — `conditionActif` is the same fragment the reader's per-Utilisateur
 * answer is derived from (#315), so « only active Utilisateurs are notified »
 * cannot drift from « a Utilisateur may act only while active ».  This module
 * keeps its own recipient rules: the role, the department scope, and the
 * employee/assignee additions are unchanged.
 */
export async function resolveRecipients(
  event: NotificationEventType,
  payload: NotificationPayload,
  tx: DrizzleTransactionClient
): Promise<string[]> {
  const ids = new Set<string>()

  const roleTargets = EVENT_ROLE_MAP[event]
  for (const target of roleTargets) {
    const conditions = [eq(utilisateurs.role, target.role), conditionActif]
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
