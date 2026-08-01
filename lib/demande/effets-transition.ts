import type { DrizzleTransactionClient } from "../../db"
import { logAudit } from "../audit"
import { dispatchRows } from "../notification"
import type {
  NotificationEventType,
  NotificationPayload,
} from "../notification"

export async function appliquerEffets(
  tx: DrizzleTransactionClient,
  params: {
    audit: {
      utilisateurId: string
      action: string
      entiteId: string
      numero: string
    }
    notification: {
      event: NotificationEventType
      demandeId: string
      numero: string
      employe: {
        id: string
        prenom: string
        nom: string
        departementId: string
      }
      assigneAId?: string | null
    } | null
  }
): Promise<void> {
  await logAudit(
    {
      utilisateurId: params.audit.utilisateurId,
      action: params.audit.action,
      entite: "DemandeDeplacement",
      entiteId: params.audit.entiteId,
      details: { numero: params.audit.numero },
    },
    tx
  )

  if (!params.notification) return

  const { event, demandeId, numero, employe, assigneAId } =
    params.notification

  const payload: NotificationPayload = {
    demandeId,
    numero,
    employe,
    assigneAId,
  }
  await dispatchRows(event, payload, tx)
}
