import type { PrismaClient } from "@prisma/client"
import { prisma } from "./prisma"
import { demandeEventBus } from "./demande-event-bus"
import type { DemandeEventBus } from "./demande-event-bus"
import type { CreateDemandeData } from "./demande-utils"
import { DemandeQueries } from "./demande-queries"
import type { DemandeQueryParams } from "./demande-queries"
import { DemandeFactory } from "./demande-factory"
import { DemandeWorkflow } from "./demande-workflow"

import type { Actor, ExecuteParams } from "./demande-types"
export { DemandeWorkflow } from "./demande-workflow"
export { DemandeNotFoundError, UnauthorizedActionError, InvalidTransitionError } from "./errors"
export type { Actor, ExecuteParams, CreateDemandeData, DemandeQueryParams }

export class DemandeDeplacementService {
  queries: DemandeQueries
  factory: DemandeFactory
  workflow: DemandeWorkflow

  constructor(
    db: PrismaClient,
    events: DemandeEventBus = demandeEventBus
  ) {
    this.queries = new DemandeQueries(db)
    this.factory = new DemandeFactory(db, events)
    this.workflow = new DemandeWorkflow(db, events)
  }

  async executeAction(params: ExecuteParams) {
    switch (params.action) {
      case "create":
        return this.factory.createDraft(params.data, params.actor)
      case "submit":
        return this.factory.createAndSubmit(params.data, params.actor)
      case "approuver":
      case "rejeter":
      case "retirer":
        return this.workflow.executeTransition({
          demandeId: params.demandeId,
          action: params.action,
          actor: params.actor,
          comment: "comment" in params ? params.comment : undefined,
        })
    }
  }

  findById(id: string) {
    return this.queries.findById(id)
  }

  findMany(role: string, userId: string, params: DemandeQueryParams) {
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
}

export const demandeService = new DemandeDeplacementService(prisma)
