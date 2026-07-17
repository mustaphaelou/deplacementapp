import type { NotificationBus, NotificationEventType, NotificationPayload } from "./notification-bus"
import type { AuditBus } from "./audit-bus"
import { notificationBus } from "./notification-bus"
import { auditBus } from "./audit-bus"

export interface DemandeEventParams {
  utilisateurId: string
  action: string
  entiteId: string
  numero: string
  notificationEvent?: NotificationEventType | null
  notificationPayload?: Omit<NotificationPayload, "demandeId" | "numero"> | null
}

export class DemandeEventBus {
  constructor(
    private notifications: NotificationBus,
    private audit: AuditBus
  ) {}

  async dispatch(params: DemandeEventParams): Promise<void> {
    await this.audit.log({
      utilisateurId: params.utilisateurId,
      action: params.action,
      entite: "DemandeDeplacement",
      entiteId: params.entiteId,
      details: { numero: params.numero },
    })

    if (params.notificationEvent && params.notificationPayload) {
      await this.notifications.dispatch(params.notificationEvent, {
        demandeId: params.entiteId,
        numero: params.numero,
        ...params.notificationPayload,
      })
    }
  }
}

export const demandeEventBus = new DemandeEventBus(notificationBus, auditBus)
