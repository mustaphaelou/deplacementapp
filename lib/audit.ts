import type { DrizzleDb } from "../db"
import { db } from "../db"
import { journalAudit } from "../db/schema/journal-audit"

export interface AuditEvent {
  utilisateurId: string
  action: string
  entite: string
  entiteId?: string
  details?: Record<string, unknown>
}

export async function logAudit(
  event: AuditEvent,
  dbOrTx: DrizzleDb = db
): Promise<void> {
  await dbOrTx.insert(journalAudit).values({
    id: crypto.randomUUID(),
    utilisateurId: event.utilisateurId,
    action: event.action,
    entite: event.entite,
    entiteId: event.entiteId ?? null,
    details: event.details ? JSON.stringify(event.details) : null,
  })
}
