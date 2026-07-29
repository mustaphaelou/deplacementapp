import type { PgDatabase } from "drizzle-orm/pg-core"
import { journalAudit } from "../../db/schema/journal-audit"
import { notifications } from "../../db/schema/notifications"
import type { NotificationEventType, NotificationPayload } from "../notification-events"
import { buildMessage, resolveRecipients } from "../notification/helpers"

export async function appliquerEffets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: PgDatabase<any, any, any>,
  params: {
    audit: { utilisateurId: string; action: string; entiteId: string; numero: string }
    notification: {
      event: NotificationEventType
      demandeId: string
      numero: string
      employe: { id: string; prenom: string; nom: string; departementId: string }
      assigneAId?: string | null
    } | null
  },
): Promise<void> {
  await tx.insert(journalAudit).values({
    id: crypto.randomUUID(),
    utilisateurId: params.audit.utilisateurId,
    action: params.audit.action,
    entite: "DemandeDeplacement",
    entiteId: params.audit.entiteId,
    details: JSON.stringify({ numero: params.audit.numero }),
  })

  if (params.notification) {
    const { event, demandeId, numero, employe, assigneAId } = params.notification
    const { titre, message } = buildMessage(event, numero, employe.prenom, employe.nom)

    const payload: NotificationPayload = { demandeId, numero, employe, assigneAId }
    const recipientIds = await resolveRecipients(event, payload, tx)

    if (recipientIds.length > 0) {
      await tx.insert(notifications).values(
        recipientIds.map((utilisateurId) => ({
          id: crypto.randomUUID(),
          utilisateurId,
          demandeId,
          titre,
          message,
        })),
      )
    }
  }
}
