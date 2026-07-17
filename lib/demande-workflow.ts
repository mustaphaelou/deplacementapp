import type { Prisma, PrismaClient } from "@prisma/client"
import type { NotificationPayload } from "./notification-bus"
import type { DemandeEventBus } from "./demande-event-bus"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
} from "./errors"
import { canTransition, buildTransition, fromLegacyStatus } from "./workflow"
import type { WorkflowAction } from "./workflow"
import type { Actor } from "./demande-types"

export class DemandeWorkflow {
  constructor(
    private db: PrismaClient,
    private events: DemandeEventBus
  ) {}

  async executeTransition(params: {
    demandeId: string
    action: "submit" | "approuver" | "rejeter" | "retirer"
    actor: Actor
    comment?: string
  }) {
    const { action, demandeId, actor } = params

    const demande = await this.db.demandeDeplacement.findUnique({
      where: { id: demandeId },
      include: { employe: { select: { id: true, prenom: true, nom: true, departementId: true } } },
    })
    if (!demande || demande.deletedAt) throw new DemandeNotFoundError()

    const { etape, decision } = fromLegacyStatus(demande.statut)

    if ((action === "retirer" || action === "submit") && demande.employeId !== actor.id) {
      throw new UnauthorizedActionError("Seul le proprietaire peut " + (action === "submit" ? "soumettre" : "retirer") + " la demande")
    }

    if (!canTransition(actor.role, etape, action as WorkflowAction, decision)) {
      throw new UnauthorizedActionError()
    }

    const transitionParams: { comment?: string; assigneAId?: string; decision?: string } = { decision }
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

    const updated = await this.db.demandeDeplacement.update({
      where: { id: demandeId },
      data: transition.transition.fields as Prisma.DemandeDeplacementUncheckedUpdateInput,
    })

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

    return { demande: updated }
  }
}
