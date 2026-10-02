import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { peutAgir } from "../utilisateur-service"
import { toAuthUser } from "./user-mapper"
import { auth } from "./better-auth"
import type { Role } from "./roles"
import { hasAnyRole } from "./roles"
import type { AuthUser } from "./user-mapper"

/**
 * The server auth seam: who is signed in, and whether they may act.
 *
 * ## What a guarded call costs
 *
 * `getAuthUser` and `requireAuth` are NOT free of a query. Each call reads the
 * `utilisateurs` table once, to learn whether the signed-in Utilisateur is
 * still active, and asks `peutAgir` — the one reader that owns that rule
 * (#313). That read used to be a private helper in this file, and this
 * interface said nothing about it: a caller read signatures that looked like
 * the answer came off the session alone, and the suite had to mock a whole
 * query builder to keep the query out of the run. So the cost was hidden from
 * callers and from maintainers alike.
 *
 * #316 does not remove the read — the brief for this ticket keeps it, and the
 * spec records the query-free session record as a fallback rather than the
 * shape that lands here. What changes is that the cost is now part of the
 * interface instead of a fact hiding behind it: stated here, named in the
 * doc comments of the two guarded calls below, and measured by
 * `session.test.ts`, which counts the activity queries a guarded call issues
 * against a real in-process Postgres rather than mocking the query away. The
 * number is therefore a number the suite states, and one a future change
 * cannot alter silently.
 *
 * The RULE the read serves — « a Utilisateur may act only while active » — is
 * not written in this module. It lives once, in `peutAgir`
 * (`lib/utilisateur-service.ts`), which this module, the Google sign-in gate
 * and the Notification recipient resolver all ask. A fourth caller of the rule
 * cannot get it subtly wrong, because there is nothing here to copy.
 */

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

async function currentUser(): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  // The rule is asked, not spelled: one reader owns « a Utilisateur may act
  // only while active », and this module no longer carries a second copy of
  // the query. The cost is the same one the interface now states — one read of
  // `utilisateurs` per call, unchanged from the private helper this replaced.
  if (!(await peutAgir(session.user.id))) return null
  return toAuthUser(session.user)
}

/**
 * The signed-in Utilisateur, or `null` when nobody is signed in, when the
 * Utilisateur is not active, or when no Utilisateur row matches the session.
 *
 * Costs one query per call — the activity read stated in the module note.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  return currentUser()
}

/**
 * `getAuthUser` as a guard: 401 « Non autorisé » when there is no such
 * Utilisateur, 200-by-association otherwise. Same one-query cost as
 * `getAuthUser`, and the same cause named for an inactive Utilisateur.
 */
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
