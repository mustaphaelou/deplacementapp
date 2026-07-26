import type { DrizzleDb } from "./prisma"
import { documents } from "../db/schema/documents"
import type { DemandeQueryPort, DemandeQueryParams } from "./demande/ports/demande-query-port"
import type { DemandeFactoryPort } from "./demande/ports/demande-factory-port"
import type { DemandeWorkflowPort } from "./demande/ports/demande-workflow-port"
import type { CreateDemandeData } from "./demande-utils"

import type { Actor, ExecuteParams } from "./demande-types"
export { DemandeNotFoundError, UnauthorizedActionError, InvalidTransitionError } from "./errors"
export type { Actor, ExecuteParams, CreateDemandeData, DemandeQueryParams }

export class DemandeDeplacementService {
  constructor(
    readonly queries: DemandeQueryPort,
    readonly factory: DemandeFactoryPort,
    readonly workflow: DemandeWorkflowPort,
    private _db?: DrizzleDb
  ) {}

  async executeAction(params: ExecuteParams) {
    switch (params.action) {
      case "create":
        return this.factory.createDraft(params.data, params.actor)
      case "submit":
        return this.factory.createAndSubmit(params.data, params.actor)
      case "submit_draft":
        return this.workflow.executeTransition({
          demandeId: params.demandeId,
          action: "submit",
          actor: params.actor,
        })
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
    if (!this._db) throw new Error("DrizzleDb not available for recordDocument")
    await this._db.insert(documents).values({
      id: crypto.randomUUID(),
      demandeId,
      type: params.type,
      chemin: params.chemin,
    })
  }
}