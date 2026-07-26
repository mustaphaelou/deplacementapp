import type { DrizzleDb } from "./prisma"
import { db } from "./prisma"
import { journalAudit } from "../db/schema/journal-audit"

export interface AuditEvent {
  utilisateurId: string
  action: string
  entite: string
  entiteId?: string
  details?: Record<string, unknown>
}

export class AuditBus {
  constructor(private _db: DrizzleDb) {}

  async log(event: AuditEvent): Promise<void> {
    await this._db.insert(journalAudit).values({
      id: crypto.randomUUID(),
      utilisateurId: event.utilisateurId,
      action: event.action,
      entite: event.entite,
      entiteId: event.entiteId ?? null,
      details: event.details ? JSON.stringify(event.details) : null,
    })
  }
}

export const auditBus = new AuditBus(db)