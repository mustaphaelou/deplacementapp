import type { TypeTransport } from "@prisma/client"
import type { DashboardDemandeSummary } from "./dashboard"
import type { AuditBus } from "./audit-bus"
import type { NotificationBus, NotificationEventType, NotificationPayload } from "./notification-bus"

export interface CreateDemandeData {
  motif: string[]
  motifAutre?: string
  dateDepart: string
  dateRetour: string
  destination: string
  typeTransport: TypeTransport
  autreTransport?: string
  vehiculeId?: string
  fraisTransport?: string
  fraisHebergement?: string
  fraisRepas?: string
  fraisDivers?: string
  avanceRequise?: boolean
  montantAvance?: string
  description?: string
}

export function parseDecimal(value?: string): number {
  return parseFloat(value || "0")
}

export function processMotif(motif: string[], motifAutre?: string): string[] {
  const arr = [...motif]
  if (arr.includes("autre") && motifAutre) {
    const idx = arr.indexOf("autre")
    arr[idx] = `Autre: ${motifAutre}`
  }
  return arr
}

export function computeTotalEstime(data: CreateDemandeData): number {
  return (
    parseDecimal(data.fraisTransport) +
    parseDecimal(data.fraisHebergement) +
    parseDecimal(data.fraisRepas) +
    parseDecimal(data.fraisDivers)
  )
}

export function mapToDemandeSummary(demande: any): DashboardDemandeSummary {
  return {
    id: demande.id,
    numero: demande.numero,
    destination: demande.destination,
    dateDepart: demande.dateDepart,
    dateRetour: demande.dateRetour,
    totalEstime: demande.totalEstime ? Number(demande.totalEstime) : null,
    statut: demande.statut,
    employe: demande.employe
      ? { prenom: demande.employe.prenom, nom: demande.employe.nom }
      : null,
  }
}

export async function notifyAndAudit(params: {
  audit: AuditBus
  notifications: NotificationBus
  utilisateurId: string
  action: string
  entiteId: string
  numero: string
  notificationEvent?: NotificationEventType | null
  notificationPayload?: Omit<NotificationPayload, "demandeId" | "numero"> | null
}) {
  const { audit, notifications, ...rest } = params

  await audit.log({
    utilisateurId: rest.utilisateurId,
    action: rest.action,
    entite: "DemandeDeplacement",
    entiteId: rest.entiteId,
    details: { numero: rest.numero },
  })

  if (rest.notificationEvent && rest.notificationPayload) {
    await notifications.dispatch(rest.notificationEvent, {
      demandeId: rest.entiteId,
      numero: rest.numero,
      ...rest.notificationPayload,
    })
  }
}
