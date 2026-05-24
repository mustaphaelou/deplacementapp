import type { PrismaClient } from "@prisma/client"
import { prisma } from "./prisma"

export interface AuditEvent {
  utilisateurId: string
  action: string
  entite: string
  entiteId?: string
  details?: Record<string, unknown>
}

export class AuditBus {
  constructor(private db: PrismaClient) {}

  async log(event: AuditEvent): Promise<void> {
    await this.db.journalAudit.create({
      data: {
        utilisateurId: event.utilisateurId,
        action: event.action,
        entite: event.entite,
        entiteId: event.entiteId ?? null,
        details: event.details ? JSON.stringify(event.details) : null,
      },
    })
  }
}

export const auditBus = new AuditBus(prisma)
