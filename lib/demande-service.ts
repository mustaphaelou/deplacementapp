import type { Prisma, PrismaClient } from "@prisma/client"
import { prisma } from "./prisma"
import { notificationBus } from "./notification-bus"
import type { NotificationPayload } from "./notification-bus"
import { auditBus } from "./audit-bus"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
} from "./errors"
import { canTransition, buildTransition, fromLegacyStatus } from "./workflow"
import type { WorkflowAction } from "./workflow"
import {
  mapToDemandeSummary,
  notifyAndAudit,
} from "./demande-utils"
import type { CreateDemandeData } from "./demande-utils"
import { DemandeQueries } from "./demande-queries"
import type { DemandeQueryParams } from "./demande-queries"
import { DemandeFactory } from "./demande-factory"
import type { Actor } from "./demande-factory"

export {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
  mapToDemandeSummary,
}
export type { Actor, CreateDemandeData, DemandeQueryParams }

export type ExecuteParams =
  | { action: "create"; data: CreateDemandeData; actor: Actor }
  | { action: "submit"; data: CreateDemandeData; actor: Actor }
  | { action: "approuver"; demandeId: string; actor: Actor; comment?: string }
  | { action: "rejeter"; demandeId: string; actor: Actor; comment: string }
  | { action: "retirer"; demandeId: string; actor: Actor }

// ─── Service ───────────────────────────────────────────────────────────────

export class DemandeDeplacementService {
  private queries: DemandeQueries
  private factory: DemandeFactory

  constructor(
    private db: PrismaClient,
    private notifications = notificationBus,
    private audit = auditBus,
    factory?: DemandeFactory
  ) {
    this.queries = new DemandeQueries(db)
    this.factory = factory ?? new DemandeFactory(db, this.notifications, this.audit)
  }

  async executeAction(params: ExecuteParams) {
    switch (params.action) {
      case "create":
      case "submit":
        return this.handleCreate(params)
      case "approuver":
      case "rejeter":
      case "retirer":
        return this.handleTransition(params)
    }
  }

  // ── Read queries (delegated) ──────────────────────────────────────

  findById(id: string) {
    return this.queries.findById(id)
  }

  findMany(
    role: string,
    userId: string,
    params: DemandeQueryParams
  ) {
    return this.queries.findMany(role, userId, params)
  }

  findByEmployeeId(userId: string, limit?: number) {
    return this.queries.findByEmployeeId(userId, limit)
  }

  findByStatuts(statuts: string[], opts?: { limit?: number; includeEmployee?: boolean; orderBy?: any }) {
    return this.queries.findByStatuts(statuts as any, opts)
  }

  countByStatut(statut: string, userId?: string) {
    return this.queries.countByStatut(statut as any, userId)
  }

  aggregateBudget(statuts: string[]) {
    return this.queries.aggregateBudget(statuts as any)
  }

  // ── Create (draft or submit-and-transition) ──────────────────────────

  private async handleCreate(
    params: Extract<ExecuteParams, { action: "create" | "submit" }>
  ) {
    const { action, data, actor } = params

    if (action === "submit") {
      return this.factory.createAndSubmit(data, actor)
    }
    return this.factory.createDraft(data, actor)
  }

  // ── Transition (approve / reject / withdraw) ──────────────────────────

  private async handleTransition(
    params: Extract<ExecuteParams, { action: "approuver" | "rejeter" | "retirer" }>
  ) {
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

    await notifyAndAudit({
      audit: this.audit,
      notifications: this.notifications,
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

// ─── Singleton ─────────────────────────────────────────────────────────────

export const demandeService = new DemandeDeplacementService(prisma)
