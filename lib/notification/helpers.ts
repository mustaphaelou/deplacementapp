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
 * turn one query into one-per-manager. The rule itself is the Utilisateur
 * module's — `conditionActif` is the same fragment the reader's per-Utilisateur
 * answer is derived from (#315) — so « only active Utilisateurs are notified »
 * cannot drift from « a Utilisateur may act only while active ».
 *
 * ALL THREE paths below are held to it (#355), and that is one decision rather
 * than three: an inactive Utilisateur neither RECEIVES nor PRODUCES a
 * Notification. Before this, `conditionActif` reached the role targets only,
 * and the employee and assignee additions were added outright — which made the
 * gap user-visible rather than academic, because `EVENT_ROLE_MAP` is EMPTY for
 * `DEMANDE_APPROBATION_FINALE` and `DEMANDE_REJETEE`
 * (`lib/notification-events.ts:48-49`). For those two events the employee
 * addition IS the whole notification surface: a Utilisateur deactivated after
 * filing their DemandeDeplacement was told, by mail, that it had been approved
 * or rejected.
 *
 * The narrower intent is superseded deliberately, not by accident. #315 moved
 * the activity rule into the Utilisateur reader and pinned « still adds the
 * employee and the assignee regardless of activity », which was a settled
 * reading at the time: the additions were the resolver's OWN recipient rules,
 * distinct from the role targets the rule had been moved for. It is now decided
 * the other way, because « a Utilisateur who cannot act is nonetheless told
 * about their own DemandeDeplacement » is not a distinction anyone can state
 * once it is written down — the deactivation is normally the answer, so the
 * Notification says nothing the Utilisateur needs and its MAIL reaches an
 * address nobody reads any more. The test that recorded the old intent was
 * rewritten to assert this rule rather than deleted (#355).
 *
 * Kept from the resolver's own rules: the role targets, the department scope,
 * and the CHOICE of which events carry the employee and which carry the
 * assignee. Activity now filters; it does not decide who is named.
 */
export async function resolveRecipients(
  event: NotificationEventType,
  payload: NotificationPayload,
  tx: DrizzleTransactionClient
): Promise<string[]> {
  const ids = new Set<string>()

  /**
   * The one place activity is asked, for every path. A named candidate is
   * admitted only if the Utilisateur module's rule admits it, so a Utilisateur
   * who does not exist is dropped as well — which is what an id from a stale
   * payload deserves, and it is the same answer `peutAgir` gives for one.
   *
   * `conditionActif` is spelled once, in `lib/utilisateur-service.ts:359`, and
   * is derived FROM the same fragment `peutAgir` composes, so the reader's
   * per-Utilisateur answer and this SET-shaped answer cannot disagree (#313,
   * #315). The additions read the same fragment rather than their own
   * predicate: « active » has one definition in this repo, and a second
   * spelling beside this one is how the rule was half-applied in the first
   * place.
   */
  const ifActif = async (utilisateurId: string): Promise<boolean> => {
    const [row] = await tx
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(and(eq(utilisateurs.id, utilisateurId), conditionActif))
      .limit(1)
    return row !== undefined
  }

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
    if (await ifActif(payload.employe.id)) {
      ids.add(payload.employe.id)
    }
  }

  if (ASSIGNEE_EVENTS.includes(event) && payload.assigneAId) {
    if (await ifActif(payload.assigneAId)) {
      ids.add(payload.assigneAId)
    }
  }

  return Array.from(ids)
}
