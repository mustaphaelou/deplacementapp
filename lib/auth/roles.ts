export type Role =
  "EMPLOYEE" | "MANAGER" | "FINANCE_ADMIN" | "GENERAL_DIRECTION"

export const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employé",
  MANAGER: "Responsable",
  FINANCE_ADMIN: "Administration & Finances",
  GENERAL_DIRECTION: "Direction Générale",
}

// The Roles that may manage the application — Utilisateurs, the Societe write,
// the Societe identity read, the fleet writes, the export and Rapports (spec
// #281). One declared set: a surface asks it instead of naming Roles.
export const ROLES_MANAGEMENT: readonly Role[] = ["FINANCE_ADMIN", "GENERAL_DIRECTION"]

// The guard's pure half: does this Role satisfy this set? It lives beside the
// Role union and ROLES_MANAGEMENT rather than in `session.ts` so a CLIENT
// component can ask the same question the server guards ask — the Demandes
// list page's export button (#286) needs it, and `session.ts` imports
// `next/headers` and the database, which a client bundle must not pull in.
// `session.ts` re-exports it, so server callers are unchanged.
export function hasAnyRole(role: string, allowed: readonly Role[]): boolean {
  return allowed.includes(role as Role)
}

export interface NavItem {
  label: string
  href: string
  icon: string
  description: string
}

// The administration block: the four /administration surfaces, declared ONCE.
// Which Roles see it is not written here — it is ROLES_MANAGEMENT's to say, so
// a Utilisateur is offered exactly what the guards admit (#285).
export const NAV_ADMINISTRATION: readonly NavItem[] = [
  {
    label: "Société",
    href: "/administration/societe",
    icon: "building",
    description: "Paramètres de la société",
  },
  {
    label: "Utilisateurs",
    href: "/administration/utilisateurs",
    icon: "users",
    description: "Gestion des comptes et rôles",
  },
  {
    label: "Véhicules",
    href: "/administration/vehicules",
    icon: "car",
    description: "Gestion du parc automobile",
  },
  {
    label: "Rapports",
    href: "/administration/rapports",
    icon: "bar-chart-3",
    description: "Statistiques et exports",
  },
]

// The pipeline lanes « Mes Demandes », « Nouvelle Demande », « Demandes Équipe »,
// « En Attente », « Approbations Budget » and « Approbations Finales » with their
// ?etape=…&decision=PENDING queue links. These belong to the workflow module, not
// to the management set, so they stay hand-written per Role and unchanged.
export const NAV_LANES: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    {
      label: "Mes Demandes",
      href: "/demandes",
      icon: "file-text",
      description: "Historique de vos demandes",
    },
    {
      label: "Nouvelle Demande",
      href: "/demandes/nouvelle",
      icon: "file-plus",
      description: "Créer une demande de déplacement",
    },
  ],
  MANAGER: [
    {
      label: "Demandes Équipe",
      href: "/demandes",
      icon: "users",
      description: "Demandes de votre équipe",
    },
    {
      label: "En Attente",
      href: "/demandes?etape=MANAGER_REVIEW&decision=PENDING",
      icon: "clock",
      description: "Demandes en attente d'action",
    },
  ],
  FINANCE_ADMIN: [
    {
      label: "Approbations Budget",
      href: "/demandes",
      icon: "dollar-sign",
      description: "Validation budgétaire des demandes",
    },
  ],
  GENERAL_DIRECTION: [
    {
      label: "Approbations Finales",
      href: "/demandes?etape=DIRECTION_REVIEW&decision=PENDING",
      icon: "check-circle",
      description: "Validation finale des demandes",
    },
  ],
}

/** The lanes a Role owns, then the administration block the declared set admits. */
function navItemsForRole(role: Role): NavItem[] {
  return [
    ...NAV_LANES[role],
    // The predicate, not `ROLES_MANAGEMENT.includes(role)` inlined: the
    // Demandes page was moved off that hand-rolled shape in #286, and the
    // navigation asking the same question by hand would be the second
    // spelling #281 removed.
    ...(hasAnyRole(role, ROLES_MANAGEMENT) ? NAV_ADMINISTRATION : []),
  ]
}

export const NAV_ITEMS: Record<string, NavItem[]> = {
  common: [
    {
      label: "Tableau de bord",
      href: "/",
      icon: "bar-chart-3",
      description: "Vue d'ensemble et statistiques",
    },
  ],
  ...Object.fromEntries(
    Object.keys(NAV_LANES).map((role) => [role, navItemsForRole(role as Role)])
  ),
}
