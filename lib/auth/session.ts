import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "../../db"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { toAuthUser } from "./user-mapper"
import { auth } from "./better-auth"
import type { Role } from "./roles"
import { hasAnyRole } from "./roles"
import type { AuthUser } from "./user-mapper"

export type { AuthUser } from "./user-mapper"

export type AuthResult =
  { ok: true; user: AuthUser } | { ok: false; response: NextResponse }

export type AuthorizationResult =
  { ok: true } | { ok: false; response: NextResponse }

export { auth }

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
}

async function isActif(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ actif: utilisateurs.actif })
    .from(utilisateurs)
    .where(eq(utilisateurs.id, userId))
    .limit(1)
  return row?.actif ?? false
}

async function currentUser(): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  if (!(await isActif(session.user.id))) return null
  return toAuthUser(session.user)
}

export async function getAuthUser(): Promise<AuthUser | null> {
  return currentUser()
}

export async function requireAuth(): Promise<AuthResult> {
  const user = await currentUser()
  if (!user) return { ok: false, response: unauthorized() }
  return { ok: true, user }
}

// Re-exported rather than redefined: the predicate now lives in `roles.ts`,
// beside the Role union and ROLES_MANAGEMENT, so client components can ask the
// same question (#286). Server callers import it from here unchanged.
export { hasAnyRole } from "./roles"

export function requireRole(
  user: AuthUser,
  requiredRole: Role
): AuthorizationResult {
  if (!hasAnyRole(user.role, [requiredRole])) {
    return { ok: false, response: forbidden() }
  }
  return { ok: true }
}

export function requireAnyRole(
  user: AuthUser,
  requiredRoles: readonly Role[]
): AuthorizationResult {
  if (!hasAnyRole(user.role, requiredRoles)) {
    return { ok: false, response: forbidden() }
  }
  return { ok: true }
}
