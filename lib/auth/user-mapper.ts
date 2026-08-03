/**
 * The single domain shape both the server seam (`lib/auth/session.ts`) and the
 * client seam (`lib/auth/client.ts`) expose.  Maps the Better Auth session
 * user (core fields + server-owned additional fields) onto `AuthUser` so no
 * library shape leaks into callers.
 */
export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
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

export function toAuthUser(user: BetterAuthSessionUser): AuthUser {
  const prenom = user.prenom?.trim() ?? ""
  const nom = user.name?.trim() ?? ""
  return {
    id: user.id ?? user.email ?? "",
    email: user.email ?? "",
    name: [prenom, nom].filter(Boolean).join(" "),
    role: user.role ?? "",
    departementId: user.departementId ?? "",
    departement: "",
    poste: user.poste ?? "",
    avatarUrl: user.image ?? null,
  }
}
