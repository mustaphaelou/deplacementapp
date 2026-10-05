// The queue links below are COMPOSED by the pipeline module rather than typed
// here (#303). This file used to hand-write `?etape=MANAGER_REVIEW&…` and
// `?etape=DIRECTION_REVIEW&…` — the copies nobody can regenerate, because this
// table had no way to ask what lane a Role waits on. A lane rename therefore
// left the navigation pointing at a lane that no longer exists, and the click
// came back as a bare « Erreur interne ».
//
// `lib/workflow.ts` owns the link because it owns the lane, and it names this
// route on purpose: one composition, so no site can drift. The cost —
// presentation vocabulary inside the pipeline module — is accepted and recorded
// there.
import { lienFileAttente } from "../workflow"

/**
 * The Roles this build names, as a value — the ONE place the vocabulary is
 * spelled, and the `Role` union is DERIVED from it rather than the reverse.
 *
 * Spelling it once here rather than once per consumer is what keeps the copies
 * from reappearing. This module is deliberately importable by a client bundle
 * (see `hasAnyRole` below), so it may not import the database to read the
 * vocabulary off the column — that would pull `next/headers` and drizzle into
 * every client that asks the question. So the two declarations of the
 * vocabulary — this one, and the column's own in `db/schema/enums.ts` — are
 * written independently and tied together by a RUNTIME WITNESS:
 * `roles.test.ts` reads `[...roleEnum.enumValues]` off the column and asserts
 * set-equality with this list. Neither is derived from the other, so the
 * witness can fail; see `demande-types.row-types.test.ts` for the same pattern
 * over `Etape` and `Decision`.
 *
 * The hazard this exists to prevent is a LOCKOUT, not a crash: ADR-0021 adds a
 * fifth Role (the deployment's Administrateur), and on the day that Role
 * reaches the database and not this set, every Administrateur is refused at the
 * seam and the guaranteed administrator of a live deployment cannot sign in.
 * The witness beside it is what turns that into a failing test instead.
 */
export const TOUS_LES_ROLES = [
  "EMPLOYEE",
  "MANAGER",
  "FINANCE_ADMIN",
  "GENERAL_DIRECTION",
] as const

/**
 * The Roles this build names, as a type. Derived from the list above so the
 * union cannot name a member the value does not carry, and so adding a Role is
 * one edit in one place rather than two edits in two files.
 */
export type Role = (typeof TOUS_LES_ROLES)[number]

/**
 * The validating reader of the Role — the seam narrowing its own output.
 *
 * It is total, has no default, and cannot return a Role it cannot justify: a
 * stored value it does not name yields `null`, never a guess and never an
 * exception. The absent value is refused too, which is the Utilisateur-visible
 * tightening of #297 — a stored Role outside this vocabulary used to arrive as
 * a plain string and be silently redirected between pages.
 *
 * It reads a field the authentication engine has ALREADY returned and runs
 * after the session exists. It adds no column, changes no insert and no engine
 * configuration, and it is a predicate over the union rather than a
 * substitutable strategy: one implementation, always.
 */
export function lireRole(stored: string | null | undefined): Role | null {
  if (typeof stored !== "string") return null
  return TOUS_LES_ROLES.find((role) => role === stored) ?? null
}

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
//
// The parameter takes the vocabulary, not `string` (#297). It is NOT left
// permissive, and that is a measured decision rather than a default: every
// caller passes a signed-in Utilisateur's Role — `session.ts`'s two guards,
// `rapports/page.tsx`, `demandes/page.tsx`, and `navItemsForRole` below — and
// since #297 all four receive the union, because the seam refuses a Utilisateur
// whose stored Role it cannot name. The old cast could not police itself; a
// signature that only accepts what the reader vouched for can.
export function hasAnyRole(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role)
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
// to the management set, so they stay hand-written per Role and unchanged — the
// queue LINKS are composed by that module (#303) and the entries themselves
// (label, icon, description) are still written here.
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
      href: lienFileAttente("MANAGER"),
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
      href: lienFileAttente("GENERAL_DIRECTION"),
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
  // OUT OF SCOPE FOR #297, DELIBERATELY: this `as Role` stays.
  //
  // The ticket's criterion says no `as Role` remains in production; its Out of
  // Scope says the navigation table's keys are « keyed permissively on purpose
  // — a navigation entry for a Role this build does not have must not crash a
  // page ». Those two cannot both hold here, and the specific carve-out wins:
  // removing the cast would force the key type to be exactly `Role`, so a Role
  // stored in the database but absent from this build's union would throw while
  // `NAV_ITEMS` is being assembled — on every request, not only on that
  // Utilisateur's. The widening was removed from the SEAM (so no Utilisateur is
  // signed in carrying it at all); this cast guards the one lookup that must
  // still tolerate a key the seam has refused.
  //
  // The property at risk is pinned: `roles.test.ts` calls the table with a Role
  // this build does not have and gets a result, not a throw.
  ...Object.fromEntries(
    Object.keys(NAV_LANES).map((role) => [role, navItemsForRole(role as Role)])
  ),
}
