export type NotificationEventType =
  | "DEMANDE_SOUMISE"
  | "DEMANDE_APPROBATION_MANAGER"
  | "DEMANDE_APPROBATION_FINANCE"
  | "DEMANDE_APPROBATION_FINALE"
  | "DEMANDE_REJETEE"
  | "DEMANDE_RETIREE"
  | "DEMANDE_NOTIFICATION_LUE"

export interface NotificationPayload {
  demandeId: string
  numero: string
  employe: {
    id: string
    prenom: string
    nom: string
    departementId?: string
  }
  assigneAId?: string | null
}

export type NotificationMessage = {
  titre: string
  message: string
  utilisateurId: string
  demandeId: string
}

interface RoleTarget {
  role: "EMPLOYEE" | "MANAGER" | "FINANCE_ADMIN" | "GENERAL_DIRECTION"
  departmentScoped: boolean
}

export const EVENT_ROLE_MAP: Record<NotificationEventType, RoleTarget[]> = {
  DEMANDE_SOUMISE: [{ role: "MANAGER", departmentScoped: true }],
  DEMANDE_APPROBATION_MANAGER: [{ role: "FINANCE_ADMIN", departmentScoped: false }],
  DEMANDE_APPROBATION_FINANCE: [{ role: "GENERAL_DIRECTION", departmentScoped: false }],
  DEMANDE_APPROBATION_FINALE: [],
  DEMANDE_REJETEE: [],
  DEMANDE_RETIREE: [],
  DEMANDE_NOTIFICATION_LUE: [{ role: "MANAGER", departmentScoped: true }],
}
