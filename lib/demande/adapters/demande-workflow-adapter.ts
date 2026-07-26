import { eq, isNull } from "drizzle-orm"
import type { DrizzleDb, DrizzleTransactionClient } from "../../../db"
import { demandesDeplacement } from "../../../db/schema/demandes-deplacement"
import type { DemandeWorkflowPort } from "../ports/demande-workflow-port"
import type { Actor, DemandeWithRelations } from "../../demande-types"
import type { DemandeEventBus } from "../../demande-event-bus"
import type { NotificationPayload } from "../../notification-bus"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
} from "../../errors"
import { canTransition, buildTransition, fromLegacyStatus } from "../../workflow"
import type { WorkflowAction, Decision } from "../../workflow"

export class DemandeWorkflowAdapter implements DemandeWorkflowPort {
  constructor(
    private db: DrizzleDb,
    private events: DemandeEventBus
  ) {}

  async executeTransition(
    params: {
      demandeId: string
      action: "submit" | "approuver" | "rejeter" | "retirer"
      actor: Actor
      comment?: string
    },
    tx?: DrizzleTransactionClient
  ): Promise<{ demande: DemandeWithRelations }> {
    const db = tx ?? this.db
    const { action, demandeId, actor } = params

    const demande = await db.query.demandesDeplacement.findFirst({
      where: eq(demandesDeplacement.id, demandeId),
      with: {
        employe: { columns: { id: true, prenom: true, nom: true, departementId: true } },
      },
    })
    if (!demande || demande.deletedAt) throw new DemandeNotFoundError()

    const { etape, decision } = fromLegacyStatus(demande.statut as Parameters<typeof fromLegacyStatus>[0])

    if ((action === "retirer" || action === "submit") && demande.employeId !== actor.id) {
      throw new UnauthorizedActionError("Seul le proprietaire peut " + (action === "submit" ? "soumettre" : "retirer") + " la demande")
    }

    if (!canTransition(actor.role, etape, action as WorkflowAction, decision)) {
      throw new UnauthorizedActionError()
    }

    const transitionParams: { comment?: string; assigneAId?: string; decision?: Decision } = { decision }
    if (action === "approuver") {
      transitionParams.assigneAId = actor.id
      if (params.comment) transitionParams.comment = params.comment
    }
    if (action === "rejeter") {
      transitionParams.comment = params.comment
    }

    const transition = buildTransition(
      actor.role,
      etape,
      action as WorkflowAction,
      transitionParams
    )
    if (!transition) throw new InvalidTransitionError()

    const [updated] = await db
      .update(demandesDeplacement)
      .set(transition.transition.fields)
      .where(eq(demandesDeplacement.id, demandeId))
      .returning()

    const notificationPayload: Omit<NotificationPayload, "demandeId" | "numero"> = {
      employe: {
        id: demande.employe.id,
        prenom: demande.employe.prenom,
        nom: demande.employe.nom,
        departementId: demande.employe.departementId,
      },
    }

    if (action === "retirer") {
      notificationPayload.assigneAId = demande.assigneAId
    }

    await this.events.dispatch({
      utilisateurId: actor.id,
      action: transition.auditAction,
      entiteId: demandeId,
      numero: demande.numero,
      notificationEvent: transition.notificationEvent,
      notificationPayload,
    })

    return { demande: updated as unknown as DemandeWithRelations }
  }
}