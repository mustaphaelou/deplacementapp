import type { PrismaClient } from "@prisma/client"
import { prisma } from "./prisma"
import { notificationBus } from "./notification-bus"
import { auditBus } from "./audit-bus"
import { DemandeNotFoundError, UnauthorizedActionError, InvalidTransitionError } from "./errors"
import { mapToDemandeSummary } from "./demande-utils"
import type { CreateDemandeData } from "./demande-utils"
import { DemandeQueries } from "./demande-queries"
import type { DemandeQueryParams } from "./demande-queries"
import { DemandeFactory } from "./demande-factory"
import type { Actor } from "./demande-factory"
import { DemandeWorkflow } from "./demande-workflow"

export { DemandeWorkflow } from "./demande-workflow"
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
  private workflow: DemandeWorkflow

  constructor(
    private db: PrismaClient,
    private notifications = notificationBus,
    private audit = auditBus,
    factory?: DemandeFactory,
    workflow?: DemandeWorkflow
  ) {
    this.queries = new DemandeQueries(db)
    this.factory = factory ?? new DemandeFactory(db, this.notifications, this.audit)
    this.workflow = workflow ?? new DemandeWorkflow(db, this.notifications, this.audit)
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

  private handleTransition(
    params: Extract<ExecuteParams, { action: "approuver" | "rejeter" | "retirer" }>
  ) {
    return this.workflow.executeTransition(params)
  }

}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const demandeService = new DemandeDeplacementService(prisma)
