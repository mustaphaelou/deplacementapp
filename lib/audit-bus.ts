import type { PrismaClient } from "@prisma/client"
import { prisma } from "./prisma"

export interface AuditEvent {
  utilisateurId: string
  action: string
  entite: string
  entiteId?: string
  details?: Record<string, unknown>
}

export type AuditResult =
  | { success: true }
  | { success: false; error: string }

export interface AuditAdapter {
  log(event: AuditEvent): Promise<AuditResult>
}

class PrismaAuditAdapter implements AuditAdapter {
  constructor(private db: PrismaClient) {}

  async log(event: AuditEvent): Promise<AuditResult> {
    try {
      await this.db.journalAudit.create({
        data: {
          utilisateurId: event.utilisateurId,
          action: event.action,
          entite: event.entite,
          entiteId: event.entiteId ?? null,
          details: event.details ? JSON.stringify(event.details) : null,
        },
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

export class AuditBus {
  constructor(private adapter: AuditAdapter) {}

  async log(event: AuditEvent): Promise<void> {
    const result = await this.adapter.log(event)
    if (!result.success) {
      console.error("[AuditBus] log failed:", result.error)
    }
  }
}

const defaultAdapter = new PrismaAuditAdapter(prisma)
export const auditBus = new AuditBus(defaultAdapter)
