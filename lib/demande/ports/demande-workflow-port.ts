import type { DrizzleTransactionClient } from "../../prisma"
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
    tx?: DrizzleTransactionClient
  ): Promise<{ demande: DemandeWithRelations }>
}