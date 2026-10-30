"use client"

import { createAuthClient } from "better-auth/react"
import type { BetterAuthSessionUser } from "./user-mapper"
import { toAuthUser } from "./user-mapper"
import type { AuthUser } from "./user-mapper"

/**
 * The client half of the auth seam (`lib/auth/client.ts`).  Mirrors the
 * `AuthUser` shape of the server seam (`lib/auth/server.ts`) so no library
 * shape leaks into client components: `useAuthUser()` reads the session,
 * `signInWithCredentials` / `signInWithGoogle` sign in, and `signOut`
 * revokes the session and redirects.
 */
export const authClient = createAuthClient()

export function useAuthUser(): {
  user: AuthUser | null
  isPending: boolean
  refetch: () => void
} {
  const { data: session, isPending, refetch } = authClient.useSession()
  // Read through the SAME `toAuthUser` the server seam reads through, so the
  // two halves cannot drift: a stored Role `lireRole` cannot name is a `null`
  // here exactly as it is in `currentUser` (#297). `user` was already nullable,
  // so the refusal needed no new shape.
  const user = session?.user
    ? toAuthUser(session.user as BetterAuthSessionUser)
    : null
  return { user, isPending, refetch }
}

export async function signInWithCredentials(
  email: string,
  password: string,
  rememberMe = true
) {
  // `rememberMe` is a documented field of the sign-in request body.  It must
  // default to `true`, not `false`: the engine's schema is
  // `rememberMe: z.boolean().default(true)` and it decides the session with
  // `createSession(userId, rememberMe === false)`.  Omitting the field — what
  // every caller did before #245 — therefore yields a LONG-LIVED session, so a
  // `false` default here would silently shorten every session to 24h, the
  // setup wizard's post-Amorçage sign-in included.
  return authClient.signIn.email({ email, password, rememberMe })
}

export async function signInWithGoogle() {
  await authClient.signIn.social({
    provider: "google",
    callbackURL: "/",
    // A refused sign-in must land where the refusal vocabulary is rendered,
    // not on a raw engine error page: the engine redirects it to the login
    // page carrying the code and the French message (google-refusals.ts).
    errorCallbackURL: "/login",
    // `disableImplicitSignUp` is set on the provider, so the engine refuses an
    // unknown e-mail before the gate unless the request asks for sign-up; the
    // request carries the ask and the gate (user.validateUserInfo) decides.
    requestSignUp: true,
  })
}

export async function signOut(redirectTo = "/login") {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.assign(redirectTo)
      },
    },
  })
}
