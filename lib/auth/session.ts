import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { peutAgir } from "../utilisateur-service"
import { toAuthUser } from "./user-mapper"
import type { BetterAuthSessionUser } from "./user-mapper"
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

/**
 * A short, stable fingerprint of a stored value the vocabulary does not name.
 *
 * WHY NOT THE VALUE ITSELF: `stored` is untrusted input out of a session row.
 * Before #297 a mis-provisioned Role produced a redirect loop nobody could
 * see; the refusal that replaced it would be just as invisible if it logged an
 * arbitrary attacker-chosen string into production logs. A hash is grep-able
 * and log-injection-safe — no newlines, no terminal escapes, nothing that
 * could forge a second log line — while still telling an operator that two
 * Utilisateurs share one bad value, which is the thing worth knowing.
 */
function empreinteRole(stored: string): string {
  return createHash("sha256").update(stored, "utf8").digest("hex").slice(0, 12)
}

/**
 * One line per Utilisateur refused for a Role this build cannot name.
 *
 * This is the operator-facing half of the refusal: spec #294 asks for an
 * unrecognised Role to be VISIBLE as a refusal rather than as a redirect loop,
 * so a mis-provisioned Utilisateur is diagnosable. The redirect loop was
 * invisible; a silent `null` is no better. A log grep is what makes it
 * diagnosable, and this is the one line that turns it into a grep.
 *
 * The house style is `lib/auth/refusal-log.ts` — "one line per refusal here
 * turns that into a log grep" — but NOT its `logRefusal`: that function takes a
 * `Response` and reads a Google sign-in redirect's OAuth code, so calling it
 * here would name a data condition in a sign-in refusal's vocabulary, which
 * spec #294 explicitly rejects. This emits its own line.
 *
 * Logged: the Utilisateur's id and email, and a fingerprint of the stored
 * value. Withheld: the stored value itself (see `empreinteRole`), and the
 * reason is not restated per Role — the fingerprint is the discriminator.
 *
 * Observability, never part of the contract: a broken log sink must not turn
 * the refusal below into a 500, so the line is emitted inside a `try` that
 * swallows — exactly as `withRefusalLog` does.
 */
function logRoleRefus(
  user: BetterAuthSessionUser,
  stored: string | null | undefined
): void {
  try {
    console.warn("[RoleRefus] Rôle stocké non reconnu", {
      utilisateur: user.id ?? null,
      email: user.email ?? null,
      // `absent` is a distinct real case — `user.role ?? ""` used to hand the
      // pages an empty string — so it is named rather than folded into a hash.
      valeur: typeof stored === "string" ? empreinteRole(stored) : "absent",
    })
  } catch {
    /* a broken log sink must not turn a 401 into a 500 */
  }
}

async function currentUser(): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  // The rule is asked, not spelled: one reader owns « a Utilisateur may act
  // only while active », and this module no longer carries a second copy of the
  // query. The cost is the same one the interface now states — one read of
  // `utilisateurs` per call, unchanged from the private helper this replaced.
  if (!(await peutAgir(session.user.id))) return null
  // The Role check sits beside the `peutAgir` check because it IS the same
  // refusal: a stored Role `lireRole` cannot name yields the `null` below, the
  // one this function has always returned for a Utilisateur who may not act —
  // so `getAuthUser` hands back `null` and `requireAuth` answers 401 « Non
  // autorisé », identically to a deactivated Utilisateur. The check itself
  // lives in `toAuthUser` so the client half cannot forget it (#297).
  const user = toAuthUser(session.user)
  // …and a `null` HERE, with an active Utilisateur and a session that reads,
  // is that refusal and nothing else: `toAuthUser` returns `null` for exactly
  // one reason, a Role the vocabulary does not name. So the line goes here, at
  // the point the refusal is taken, where both causes are in view — and it
  // goes only on this branch, because a Utilisateur refused for ACTIVITY is
  // not a mis-provisioned one and must not be reported as one.
  if (!user) logRoleRefus(session.user, session.user.role)
  return user
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
