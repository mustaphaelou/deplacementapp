import type { Prisma, PrismaClient } from "@prisma/client"
import type { NotificationEventType, NotificationBus, NotificationPayload } from "./notification-bus"
import type { AuditBus } from "./audit-bus"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
} from "./errors"
import { canTransition, buildTransition, fromLegacyStatus } from "./workflow"
import type { WorkflowAction } from "./workflow"
import type { Actor } from "./demande-factory"

export class DemandeWorkflow {
  constructor(
    private db: PrismaClient,
    private notifications: NotificationBus,
    private audit: AuditBus
  ) {}

  private async notifyAndAudit(params: {
    utilisateurId: string
    action: string
    entiteId: string
    numero: string
    notificationEvent?: NotificationEventType | null
    notificationPayload?: Omit<NotificationPayload, "demandeId" | "numero"> | null
  }) {
    await this.audit.log({
      utilisateurId: params.utilisateurId,
      action: params.action,
      entite: "DemandeDeplacement",
      entiteId: params.entiteId,
      details: { numero: params.numero },
    })

    if (params.notificationEvent && params.notificationPayload) {
      await this.notifications.dispatch(params.notificationEvent, {
        demandeId: params.entiteId,
        numero: params.numero,
        ...params.notificationPayload,
      })
    }
  }

  async executeTransition(params: {
    demandeId: string
    action: "approuver" | "rejeter" | "retirer"
    actor: Actor
    comment?: string
  }) {
    const { action, demandeId, actor } = params

    const demande = await this.db.demandeDeplacement.findUnique({
      where: { id: demandeId },
      include: { employe: { select: { id: true, prenom: true, nom: true } } },
    })
    if (!demande || demande.deletedAt) throw new DemandeNotFoundError()

    const { etape } = fromLegacyStatus(demande.statut)

    if (action === "retirer" && demande.employeId !== actor.id) {
      throw new UnauthorizedActionError("Seul le proprietaire peut retirer la demande")
    }

    if (!canTransition(actor.role, etape, action as WorkflowAction)) {
      throw new UnauthorizedActionError()
    }

    const transitionParams: { comment?: string; assigneAId?: string } = {}
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
      },
    }

    if (action === "retirer") {
      notificationPayload.assigneAId = demande.assigneAId
    }

    await this.notifyAndAudit({
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
