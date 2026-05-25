import { BarChart3, FileText, FilePlus, Users, Clock, DollarSign, Car, CheckCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type Role = "EMPLOYEE" | "MANAGER" | "FINANCE_ADMIN" | "GENERAL_DIRECTION"

export const ROLE_HIERARCHY: Record<Role, number> = {
  EMPLOYEE: 0,
  MANAGER: 1,
  FINANCE_ADMIN: 2,
  GENERAL_DIRECTION: 3,
}

export function hasRole(userRole: string, requiredRole: Role): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as Role] ?? -1
  const requiredLevel = ROLE_HIERARCHY[requiredRole]
  return userLevel >= requiredLevel
}

export function isRole(userRole: string, role: Role): boolean {
  return userRole === role
}

export const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employé",
  MANAGER: "Responsable",
  FINANCE_ADMIN: "Administration & Finances",
  GENERAL_DIRECTION: "Direction Générale",
}

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  description: string
}

export const NAV_ITEMS: Record<string, NavItem[]> = {
  common: [
    { label: "Tableau de bord", href: "/", icon: BarChart3, description: "Vue d'ensemble et statistiques" },
  ],
  EMPLOYEE: [
    { label: "Mes Demandes", href: "/demandes", icon: FileText, description: "Historique de vos demandes" },
    { label: "Nouvelle Demande", href: "/demandes/nouvelle", icon: FilePlus, description: "Créer une demande de déplacement" },
  ],
  MANAGER: [
    { label: "Demandes Équipe", href: "/demandes", icon: Users, description: "Demandes de votre équipe" },
    { label: "En Attente", href: "/demandes?statut=SOUMISE", icon: Clock, description: "Demandes en attente d'action" },
  ],
  FINANCE_ADMIN: [
    { label: "Approbations Budget", href: "/demandes", icon: DollarSign, description: "Validation budgétaire des demandes" },
    { label: "Utilisateurs", href: "/administration/utilisateurs", icon: Users, description: "Gestion des comptes et rôles" },
    { label: "Véhicules", href: "/administration/vehicules", icon: Car, description: "Gestion du parc automobile" },
    { label: "Rapports", href: "/administration/rapports", icon: BarChart3, description: "Statistiques et exports" },
  ],
  GENERAL_DIRECTION: [
    { label: "Approbations Finales", href: "/demandes?statut=APPROUVEE_FINANCE", icon: CheckCircle, description: "Validation finale des demandes" },
    { label: "Rapports", href: "/administration/rapports", icon: BarChart3, description: "Statistiques et exports" },
  ],
}
