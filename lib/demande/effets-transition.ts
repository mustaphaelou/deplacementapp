import type { DrizzleTransactionClient } from "../../db"
import { logAudit } from "../audit"
import { dispatchRowsAllOrNothing } from "../notification"
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
  // The all-or-nothing entry: this is the one path where a failed write must
  // take the caller's transition down with it, because the transition and the
  // Notification rows it produced are one unit of work.
  await dispatchRowsAllOrNothing(event, payload, tx)
}
