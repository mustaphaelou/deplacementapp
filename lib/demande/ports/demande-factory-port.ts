import type { CreateDemandeData } from "../../demande-utils"
import type { Actor, DemandeWithRelations } from "../../demande-types"
import type { PrismaTransactionClient } from "../../prisma"
import { UnauthorizedActionError, InvalidTransitionError } from "../../errors"

export interface DemandeFactoryPort {
  createDraft(
    data: CreateDemandeData,
    actor: Actor,
    tx?: PrismaTransactionClient
  ): Promise<{ demande: DemandeWithRelations }>

  createAndSubmit(
    data: CreateDemandeData,
    actor: Actor,
    tx?: PrismaTransactionClient
  ): Promise<{ demande: DemandeWithRelations }>
}