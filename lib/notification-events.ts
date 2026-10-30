import type { Role } from "@/lib/auth/roles"

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
  // The `Role` union, not a fourth hand-written spelling of it. `import type`
  // so this adds no runtime import: `lib/workflow.ts` reads the event types
  // from here, and a client bundle must not reach the database through the
  // vocabulary.
  role: Role
  departmentScoped: boolean
}

export const EVENT_ROLE_MAP: Record<NotificationEventType, RoleTarget[]> = {
  DEMANDE_SOUMISE: [{ role: "MANAGER", departmentScoped: true }],
  DEMANDE_APPROBATION_MANAGER: [
    { role: "FINANCE_ADMIN", departmentScoped: false },
  ],
  DEMANDE_APPROBATION_FINANCE: [
    { role: "GENERAL_DIRECTION", departmentScoped: false },
  ],
  DEMANDE_APPROBATION_FINALE: [],
  DEMANDE_REJETEE: [],
  DEMANDE_RETIREE: [],
  DEMANDE_NOTIFICATION_LUE: [{ role: "MANAGER", departmentScoped: true }],
}
