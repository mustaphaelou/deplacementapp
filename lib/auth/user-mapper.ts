import type { Role } from "./roles"
import { lireRole } from "./roles"

/**
 * The single domain shape both the server seam (`lib/auth/session.ts`) and the
 * client seam (`lib/auth/client.ts`) expose.  Maps the Better Auth session
 * user (core fields + server-owned additional fields) onto `AuthUser` so no
 * library shape leaks into callers.
 *
 * `role` carries the Role's own vocabulary (#297). It was a plain `string`,
 * which made every one of the eight call sites that need a Role cast it back
 * and state « this string is one of four » a ninth time, none of which could be
 * checked. The value is still whatever the engine returned; the DECLARATION is
 * what narrowed, and only a `Role` the validating reader vouched for can be
 * here.
 */
export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  departementId: string
  departement: string
  poste: string
  avatarUrl: string | null
}

export interface BetterAuthSessionUser {
  id?: string
  email?: string | null
  name?: string | null
  prenom?: string | null
  poste?: string | null
  role?: string | null
  departementId?: string | null
  image?: string | null
}

/**
 * Maps the session user onto `AuthUser`, or returns `null` when the stored Role
 * is one this instance cannot name.
 *
 * WHY THE REFUSAL LIVES HERE, rather than in the caller: this is the single
 * function both halves of the seam read through. `currentUser` (server) and
 * `useAuthUser` (client) already return a nullable user, so a `null` from here
 * is a refusal they propagate unchanged — and a check written at either call
 * site instead would be a second place for the two halves to drift apart, which
 * is the acceptance criterion this ticket exists to satisfy. The server half
 * receives it as the very `return null` that already means « this Utilisateur
 * may not act » (#316's `peutAgir` check), so a refused Role and a deactivated
 * Utilisateur are the same outcome reached at the same seam.
 *
 * The reader refuses rather than throws: a throwing mapper would turn a data
 * condition into a crash on a page that today at least renders.
 */
export function toAuthUser(user: BetterAuthSessionUser): AuthUser | null {
  const role = lireRole(user.role)
  if (role === null) return null
  const prenom = user.prenom?.trim() ?? ""
  const nom = user.name?.trim() ?? ""
  return {
    id: user.id ?? user.email ?? "",
    email: user.email ?? "",
    name: [prenom, nom].filter(Boolean).join(" "),
    role,
    departementId: user.departementId ?? "",
    departement: "",
    poste: user.poste ?? "",
    avatarUrl: user.image ?? null,
  }
}
