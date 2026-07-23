import type { PrismaTransactionClient } from "../../prisma"
import type { Actor, DemandeWithRelations } from "../../demande-types"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
} from "../../errors"

export interface DemandeWorkflowPort {
  executeTransition(
    params: {
      demandeId: string
      action: "submit" | "approuver" | "rejeter" | "retirer"
      actor: Actor
      comment?: string
    },
    tx?: PrismaTransactionClient
  ): Promise<{ demande: DemandeWithRelations }>
}