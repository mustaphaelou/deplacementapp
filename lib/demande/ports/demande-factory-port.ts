import type { CreateDemandeData } from "../../demande-utils"
import type { Actor, DemandeWithRelations } from "../../demande-types"
import type { DrizzleTransactionClient } from "../../../db"
import { UnauthorizedActionError, InvalidTransitionError } from "../../errors"

export interface DemandeFactoryPort {
  createDraft(
    data: CreateDemandeData,
    actor: Actor,
    tx?: DrizzleTransactionClient
  ): Promise<{ demande: DemandeWithRelations }>

  createAndSubmit(
    data: CreateDemandeData,
    actor: Actor,
    tx?: DrizzleTransactionClient
  ): Promise<{ demande: DemandeWithRelations }>
}