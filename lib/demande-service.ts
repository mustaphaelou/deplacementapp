import type { PrismaClient } from "@prisma/client"
import { prisma } from "./prisma"
import { demandeEventBus } from "./demande-event-bus"
import type { DemandeEventBus } from "./demande-event-bus"
import { DemandeQueries } from "./demande-queries"
import type { DemandeQueryParams } from "./demande-queries"
import type { CreateDemandeData } from "./demande-utils"
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
  private db: PrismaClient

  constructor(
    db: PrismaClient,
    events: DemandeEventBus = demandeEventBus
  ) {
    this.db = db
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

  async recordDocument(
    demandeId: string,
    params: { type: string; chemin: string }
  ) {
    await this.db.document.create({
      data: {
        demandeId,
        type: params.type,
        chemin: params.chemin,
      },
    })
  }
}

export const demandeService = new DemandeDeplacementService(prisma)
