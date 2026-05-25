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

export const NAV_ITEMS: Record<string, { label: string; href: string; icon: string }[]> = {
  common: [
    { label: "Tableau de bord", href: "/", icon: "dashboard-square-01" },
  ],
  EMPLOYEE: [
    { label: "Mes Demandes", href: "/demandes", icon: "file-01" },
    { label: "Nouvelle Demande", href: "/demandes/nouvelle", icon: "file-plus" },
  ],
  MANAGER: [
    { label: "Demandes Équipe", href: "/demandes", icon: "users" },
    { label: "En Attente", href: "/demandes?statut=SOUMISE", icon: "clock" },
  ],
  FINANCE_ADMIN: [
    { label: "Approbations Budget", href: "/demandes", icon: "currency-dollar" },
    { label: "Utilisateurs", href: "/administration/utilisateurs", icon: "user-group" },
    { label: "Véhicules", href: "/administration/vehicules", icon: "car" },
    { label: "Rapports", href: "/administration/rapports", icon: "chart" },
  ],
  GENERAL_DIRECTION: [
    { label: "Approbations Finales", href: "/demandes?statut=APPROUVEE_FINANCE", icon: "checkmark-circle" },
    { label: "Rapports", href: "/administration/rapports", icon: "chart" },
  ],
}
